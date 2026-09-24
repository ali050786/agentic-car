/**
 * Critic + targeted revision (the REFLECT loop).
 *
 * v1 asked the same model that wrote the deck to grade it on vague criteria
 * and rewrote whatever it flagged, with no check that the rewrite was better.
 * v2 changes three things:
 *  1. A separate low-temperature critic role scores a rubric that depends on
 *     the content type, and must name the slide, the problem and the fix.
 *  2. Deterministic findings (unsupported numbers, missing fields, duplicates)
 *     are fed in, so the critic doesn't have to spot them and the reviser
 *     can't ignore them.
 *  3. A revision is only kept if it doesn't add rule violations; the loop stops
 *     early when the deck is good enough (score ≥ 8, no blocking issues).
 */

import type { TemplateId } from '../../../types';
import type { BlockKind, CritiqueResult, DraftSlide, HookChoice, Issue, Outline, PipelineContext } from './types';
import { limitsForPrompt } from './limits';
import { ask, briefBlock, factsBlock, languageRule, memoryBlock, relevantFacts } from './prompting';
import { asList, asText, dumpDraft } from './slides';
import { fixAccent, validateDeck } from './validate';
import { groundingIssues, repeatedNumberIssues } from './grounding';
import { shouldVerify, verifyClaims } from './verify';
import { SLIDES_SCHEMA } from './writer';
import { isCancel } from '../../llm/cancel';

interface Dimension { key: string; question: string }

const rubricFor = (ctx: PipelineContext): Dimension[] => {
    const type = ctx.brief.contentType;
    const dims: Dimension[] = [
        { key: 'hook', question: 'Does the cover make this audience want to swipe, with a specific promise the deck keeps?' },
        { key: 'flow', question: 'Does each slide lead to the next with no repetition, ending on a clear takeaway?' },
        { key: 'specificity', question: 'Concrete names, examples, numbers and verbs, instead of generic advice?' },
        { key: 'clarity', question: 'One idea per slide, understood at a glance?' },
        { key: 'audienceFit', question: 'Vocabulary, depth and voice right for this audience and the requested voice?' },
        { key: 'expectations', question: 'Does it deliver exactly what the request asked for: the format, time frame, scope and level of detail (e.g. a real day-by-day plan when a plan was asked for)?' },
    ];
    if (ctx.facts.length || ctx.brief.contentStrategy?.stayFactuallyAccurate) {
        dims.push({ key: 'accuracy', question: 'Every factual claim and number supported by FACTS; nothing invented or overstated?' });
    }
    if (type === 'ENTERTAINMENT' || type === 'EDUTAINMENT' || ctx.brief.creativeStyle?.humorAllowed) {
        dims.push({ key: 'fun', question: 'Is it actually entertaining: wit, surprise, personality?' });
    }
    if (type === 'HOW_TO' || type === 'PROFESSIONAL') {
        dims.push({ key: 'actionability', question: 'Could the reader act on it today? Are steps concrete?' });
    }
    if (type === 'STORYTELLING') {
        dims.push({ key: 'narrative', question: 'Is there a clear setup, tension, turn and resolution?' });
    }
    return dims;
};

const critiqueSchema = (dims: Dimension[]) => ({
    type: 'object',
    properties: {
        dimensions: {
            type: 'object',
            properties: Object.fromEntries(dims.map((d) => [d.key, { type: 'number' }])),
            required: dims.map((d) => d.key),
        },
        slides: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'number' },
                    severity: { type: 'string', enum: ['major', 'minor'] },
                    problem: { type: 'string' },
                    fix: { type: 'string' },
                },
                required: ['index', 'problem', 'fix'],
            },
        },
        summary: { type: 'string' },
    },
    required: ['dimensions', 'slides'],
});

/** Scores the deck and lists per-slide problems. Never throws. */
export const critiqueDeck = async (
    ctx: PipelineContext,
    drafts: DraftSlide[],
    outline: Outline,
    known: Issue[],
): Promise<CritiqueResult> => {
    const dims = rubricFor(ctx);
    const knownLines = known
        .filter((i) => i.index >= 0 && i.code !== 'over_limit')
        .map((i) => `- Slide ${i.index + 1}${i.field ? ` (${i.field})` : ''}: ${i.message}`);

    const prompt = `You are a demanding editor reviewing a social carousel before it ships. Judge it as the target reader would.

${briefBlock(ctx.brief, ctx.topic)}
${requestLine(ctx)}
${memoryBlock(ctx.memory)}
PREMISE: ${outline.premise}
TAKEAWAY: ${outline.takeaway}
${factsBlock(ctx.facts)}

DECK:
${drafts.map(dumpDraft).join('\n')}
${knownLines.length ? `\nAUTOMATED CHECKS ALREADY FOUND (include each in "slides" with a fix):\n${knownLines.join('\n')}` : ''}

Score 1-10 (10 = would stop the scroll and deliver; 7 = fine but forgettable; 4 = weak):
${dims.map((d) => `- ${d.key}: ${d.question}`).join('\n')}

Then list concrete problems per slide. "index" is the 1-based slide number. "fix" says exactly what to change (not "make it better").
Mark "major" only for problems a reader would notice: generic or vague copy, repetition, a broken promise, an unsupported claim, wrong tone for the audience.
Don't nitpick. A strong deck may have zero problems.

Return JSON: { "dimensions": { ${dims.map((d) => `"${d.key}": number`).join(', ')} }, "slides": [ { "index", "severity", "problem", "fix" } ], "summary": string }`;

    try {
        const r = await ask<any>({ role: 'critic', label: 'critic' }, prompt, critiqueSchema(dims));
        const dimensions: Record<string, number> = {};
        for (const d of dims) {
            const v = Number(r?.dimensions?.[d.key]);
            if (Number.isFinite(v)) dimensions[d.key] = Math.max(1, Math.min(10, v));
        }
        const values = Object.values(dimensions);
        const score = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0;
        const issues: Issue[] = (r?.slides || [])
            .map((s: any) => ({
                index: Number(s.index) - 1,
                code: 'critic' as const,
                message: `${String(s.problem || '').trim()}${s.fix ? ` → ${String(s.fix).trim()}` : ''}`,
                severity: s.severity === 'major' ? ('block' as const) : ('warn' as const),
            }))
            .filter((i: Issue) => Number.isInteger(i.index) && i.index >= 0 && i.index < drafts.length && i.message.length > 3);
        return { score, dimensions, issues, summary: String(r?.summary || '').trim() };
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.critic] critique failed:', err);
        return { score: 0, dimensions: {}, issues: [], summary: 'critique unavailable' };
    }
};

/** The user's own words, when the brief's topic is a rewrite of them. */
export const requestLine = (ctx: PipelineContext): string =>
    ctx.topic && ctx.topic.trim() !== (ctx.brief.topic || '').trim()
        ? `THE USER'S REQUEST (the deck must deliver this): ${ctx.topic.slice(0, 600)}`
        : '';

const draftText = (d: DraftSlide) =>
    [d.preHeader, d.headline, d.body, ...(d.listItems || []), d.footer, d.statNumber, d.statLabel, d.splitLeft, d.splitRight].filter(Boolean).join(' ');

/** Rewrites only the given slides, keeping their block type. Returns index → new draft. */
export const reviseSlides = async (
    ctx: PipelineContext,
    drafts: DraftSlide[],
    outline: Outline,
    notes: Map<number, string[]>,
): Promise<Map<number, DraftSlide>> => {
    const targets = Array.from(notes.keys()).sort((a, b) => a - b);
    if (!targets.length) return new Map();
    const blocks = Array.from(new Set(targets.map((i) => drafts[i].blockType))) as BlockKind[];
    // Only the facts these slides draw on (or whose numbers they use): shorter prompt, faster call.
    const facts = relevantFacts(
        ctx.facts,
        targets.flatMap((i) => [...(drafts[i].factIds || []), ...(outline.beats[i]?.factIds || [])]),
        targets.flatMap((i) => [draftText(drafts[i]), ...(notes.get(i) || []).map((n) => n.replace(/^Slide \d+/i, ''))]),
    );

    const prompt = `Revise ONLY the listed slides of this carousel to fix the editor's notes. Keep everything that already works.

${briefBlock(ctx.brief, ctx.topic)}
${memoryBlock(ctx.memory)}
PREMISE: ${outline.premise}
${factsBlock(facts)}

FULL DECK (for context and flow):
${drafts.map(dumpDraft).join('\n')}

SLIDES TO REVISE:
${targets.map((i) => `Slide ${i + 1} [${drafts[i].blockType}] (job: ${outline.beats[i]?.keyMessage || 'keep its role'})\n${notes.get(i)!.map((n) => `  - ${n}`).join('\n')}`).join('\n')}

LIMITS (hard, count characters):
${limitsForPrompt(ctx.templateId, blocks)}

Rules:
- Keep each slide's blockType. Don't repeat points made on other slides.
- Numbers, statistics and quotes ONLY from FACTS. If a note says a number is unsupported, remove it or use a FACTS number.
- Use facts faithfully: keep who a fact is about, its scope and its meaning. For a FACT CHECK note, change only the claim it names and keep the slide's voice, length and flow: slide copy, not the fact sentence pasted in.
- Never write fact ids (F1, F12) in slide text.
- accentPhrase: 1-3 words copied EXACTLY from the new headline.
- No emojis, no hashtags. ${languageRule(ctx.outputLanguage)}

Return JSON: { "slides": [ { "index" (1-based), "blockType", "preHeader", "headline", "body", "listItems", "footer", "accentPhrase", "statNumber", "statLabel", "quoteAuthor", "splitLeft", "splitRight", "icon" } ] } with one entry per slide to revise.`;

    const out = new Map<number, DraftSlide>();
    try {
        const r = await ask<{ slides: any[] }>({ role: 'writer', label: 'critic.revise', temperature: 0.5 }, prompt, SLIDES_SCHEMA);
        for (const row of r?.slides || []) {
            const i = Number(row?.index) - 1;
            if (!targets.includes(i) || !(asText(row?.headline) || '').trim()) continue;
            const old = drafts[i];
            const keep = (k: string) => asText(row[k]) ?? (old as any)[k];
            const next: DraftSlide = {
                ...old,
                preHeader: keep('preHeader'),
                headline: (asText(row.headline) || '').trim(),
                body: keep('body'),
                listItems: asList(row.listItems) || old.listItems,
                footer: keep('footer'),
                accentPhrase: asText(row.accentPhrase),
                statNumber: keep('statNumber'),
                statLabel: keep('statLabel'),
                quoteAuthor: keep('quoteAuthor'),
                splitLeft: keep('splitLeft'),
                splitRight: keep('splitRight'),
                icon: asText(row.icon) || old.icon,
            };
            fixAccent(next);
            out.set(i, next);
        }
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.critic] revision failed:', err);
    }
    return out;
};

/** Issues that a revision must not add (length is fixed later by tighten). */
const HARD: Issue['code'][] = ['unsupported_number', 'banned', 'missing_field', 'empty', 'duplicate', 'repeat_number'];

const hardCount = (issues: Issue[], index: number) =>
    issues.filter((i) => i.index === index && HARD.includes(i.code)).reduce((a, i) => a + (i.severity === 'block' ? 3 : 1), 0);

export interface ReflectOptions {
    templateId: TemplateId;
    banned: string[];
    pool: Set<string>;
    strictGrounding: boolean;
    hook: HookChoice | null;
    maxPasses?: number;
    /** Run the fact check alongside the first critique (default: when the deck has facts). */
    verify?: boolean;
    onPass?: (pass: number, total: number, flagged: number) => Promise<void> | void;
}

export interface ReflectOutcome {
    drafts: DraftSlide[];
    critique: CritiqueResult;
    passes: number;
    revised: number[];
    rejected: number;
    /** Claims the fact check flagged on the first pass. */
    factIssues: Issue[];
}

const checkAll = (drafts: DraftSlide[], opts: ReflectOptions) => [
    ...validateDeck(drafts, opts.templateId, { banned: opts.banned }),
    ...groundingIssues(drafts, opts.pool, opts.strictGrounding),
    ...repeatedNumberIssues(drafts),
];

/** Critique → revise flagged slides → keep only non-regressing rewrites. Bounded. */
export const reflectLoop = async (
    ctx: PipelineContext,
    input: DraftSlide[],
    outline: Outline,
    opts: ReflectOptions,
): Promise<ReflectOutcome> => {
    const maxPasses = opts.maxPasses ?? 2;
    let drafts: DraftSlide[] = input.map((d) => ({ ...d, listItems: d.listItems ? [...d.listItems] : undefined }));
    let critique: CritiqueResult = { score: 0, dimensions: {}, issues: [], summary: '' };
    const revised = new Set<number>();
    let rejected = 0;
    let passes = 0;
    let factIssues: Issue[] = [];
    const verify = opts.verify ?? shouldVerify(ctx);

    for (let pass = 1; pass <= maxPasses; pass++) {
        const auto = checkAll(drafts, opts);
        // The fact check reads the same draft as the editor, at the same time (first pass only).
        const [c, facts] = await Promise.all([
            critiqueDeck(ctx, drafts, outline, auto),
            verify && pass === 1 ? verifyClaims(ctx, drafts) : Promise.resolve([] as Issue[]),
        ]);
        critique = c;
        if (pass === 1) factIssues = facts;
        passes = pass;
        const blocking = [...auto.filter((i) => i.severity === 'block' && i.code !== 'over_limit'), ...facts];
        if (critique.score >= 8 && blocking.length === 0 && !critique.issues.some((i) => i.severity === 'block')) break;

        // Notes per slide: automated hard findings first, then the critic's major, then minor.
        const notes = new Map<number, string[]>();
        const add = (i: number, msg: string) => {
            if (i < 0 || i >= drafts.length) return;
            const list = notes.get(i) || [];
            if (!list.includes(msg)) list.push(msg);
            notes.set(i, list);
        };
        facts.forEach((i) => add(i.index, `${i.field ? `${i.field}: ` : ''}FACT CHECK: ${i.message}`));
        auto.filter((i) => HARD.includes(i.code)).forEach((i) => add(i.index, `${i.field ? `${i.field}: ` : ''}${i.message}`));
        critique.issues.filter((i) => i.severity === 'block').forEach((i) => add(i.index, i.message));
        if (critique.score < 7) critique.issues.filter((i) => i.severity === 'warn').forEach((i) => add(i.index, i.message));

        const budget = Math.max(3, Math.ceil(drafts.length / 2));
        const weight = (i: number) => hardCount(auto, i) + facts.filter((f) => f.index === i).length * 3;
        const ranked = Array.from(notes.entries())
            .sort((a, b) => weight(b[0]) - weight(a[0]) || b[1].length - a[1].length)
            .slice(0, budget);
        if (!ranked.length) break;
        await opts.onPass?.(pass, maxPasses, ranked.length);

        const rewrites = await reviseSlides(ctx, drafts, outline, new Map(ranked));
        if (!rewrites.size) break;

        let accepted = 0;
        for (const [i, next] of rewrites) {
            const trial = drafts.slice();
            trial[i] = next;
            // Keep the tournament-picked cover headline unless it carries an unsupported number.
            // A cover the fact check flagged may be rewritten like any other slide.
            const coverFlagged = auto.some((x) => x.index === 0 && x.code === 'unsupported_number' && x.field === 'headline')
                || facts.some((x) => x.index === 0 && (!x.field || x.field === 'headline' || x.field === 'preHeader'));
            if (i === 0 && opts.hook && !coverFlagged) {
                next.headline = drafts[0].headline;
                next.accentPhrase = drafts[0].accentPhrase;
            }
            const after = checkAll(trial, opts);
            if (hardCount(after, i) <= hardCount(auto, i)) {
                drafts = trial;
                revised.add(i);
                accepted++;
            } else {
                rejected++;
            }
        }
        if (!accepted) break;
    }

    return { drafts, critique, passes, revised: Array.from(revised).sort((a, b) => a - b), rejected, factIssues };
};
