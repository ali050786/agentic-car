/**
 * Fact check: every factual claim on the slides, checked against the fact sheet.
 *
 * The numeric grounding check (grounding.ts) only sees digits. It can't tell
 * that "using 100% of your brain would cause a seizure" twists a fact that says
 * "over a day you use 100% of your brain", or that one engineer's 15 offers
 * became a general promise. This call reads each claim next to FACTS and
 * reports the ones that are unsupported or distorted, with a fix. It runs at
 * the same time as the editor's critique, so it adds no wait, and its findings
 * go to the same targeted revision as blocking notes.
 */

import type { DraftSlide, Issue, PipelineContext } from './types';
import { ask, factsBlock, untrusted } from './prompting';
import { dumpDraft } from './slides';
import { isCancel } from '../../llm/cancel';

const VERIFY_SCHEMA = {
    type: 'object',
    properties: {
        problems: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'number' },
                    field: { type: 'string' },
                    claim: { type: 'string' },
                    verdict: { type: 'string', enum: ['unsupported', 'distorted'] },
                    why: { type: 'string' },
                    fix: { type: 'string' },
                },
                required: ['index', 'claim', 'verdict', 'fix'],
            },
        },
    },
    required: ['problems'],
};

const FIELDS = new Set(['preHeader', 'headline', 'body', 'listItems', 'statNumber', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight', 'footer']);

/** When a fact check is worth a call: the deck has facts, or the brief demands accuracy. */
export const shouldVerify = (ctx: PipelineContext): boolean => {
    const off = (() => { try { return /^(off|0|false)$/i.test((typeof process !== 'undefined' && process.env?.FACT_CHECK) || ''); } catch { return false; } })();
    if (off) return false;
    if (ctx.brief.contentType === 'ENTERTAINMENT' && !ctx.brief.contentStrategy?.stayFactuallyAccurate) return false;
    return ctx.facts.length > 0 || !!ctx.brief.contentStrategy?.stayFactuallyAccurate || ctx.sourceContent.length >= 300;
};

/** Returns one blocking issue per unsupported or distorted claim. Never throws (except on cancel). */
export const verifyClaims = async (ctx: PipelineContext, drafts: DraftSlide[]): Promise<Issue[]> => {
    const prompt = `You are the fact checker for a social carousel. Check every factual claim on the slides against FACTS${ctx.sourceContent && !ctx.facts.length ? ' and the SOURCE' : ''}. Report only the claims that fail.

${factsBlock(ctx.facts)}
${ctx.sourceContent && !ctx.facts.length ? untrusted('SOURCE', ctx.sourceContent, 6000) : ''}

SLIDES:
${drafts.map(dumpDraft).join('\n')}

Report ONLY serious problems a careful reader would call wrong or misleading. Be conservative: most decks have zero or one.
- "unsupported": a statistic, number, date, study, quote or named example that is not in FACTS and is not common knowledge (it was made up).
- "distorted": the slide says something FACTS does not: a wrong or changed number, a different subject (one person's or one company's result presented as typical or as a promise to the reader), a condition flipped ("over a day" turned into "all at once"), or two facts merged into a new claim.
NOT problems, never report these: paraphrase or shorter wording that keeps the meaning; leaving out a detail, a name from a list, or a minor qualifier; headline compression ("top companies" for a list of named companies); calculations that follow directly from FACTS; opinions, advice and framing; common knowledge; jokes in a humorous deck.

For each problem give: "index" (1-based slide), "field", "claim" (the words on the slide), "verdict", "why" (one short line), and "fix": what the slide should say instead, written as slide copy in the deck's own voice and about the same length (never paste the fact sentence, never write fact ids), or "remove".
If nothing is seriously wrong, return an empty list.

Return JSON: { "problems": [ { "index", "field", "claim", "verdict", "why", "fix" } ] }`;

    try {
        const r = await ask<{ problems: any[] }>({ role: 'critic', label: 'verify', temperature: 0 }, prompt, VERIFY_SCHEMA);
        const out: Issue[] = [];
        for (const p of r?.problems || []) {
            const index = Number(p?.index) - 1;
            if (!Number.isInteger(index) || index < 0 || index >= drafts.length) continue;
            const claim = String(p?.claim || '').trim();
            const fix = String(p?.fix || '').trim();
            if (!claim || !fix) continue;
            const field = FIELDS.has(String(p?.field)) ? String(p.field) : undefined;
            const verdict = p?.verdict === 'distorted' ? 'distorts the facts' : 'is not in the facts';
            out.push({
                index,
                field,
                code: 'unsupported_claim',
                message: `"${claim.slice(0, 160)}" ${verdict}${p?.why ? ` (${String(p.why).trim().slice(0, 160)})` : ''} → ${fix.slice(0, 240)}`,
                severity: 'block',
            });
        }
        // A handful of real problems at most: a long list means the checker is nitpicking.
        return out.slice(0, 4);
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.verify] fact check failed:', err);
        return [];
    }
};
