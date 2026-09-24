/**
 * Writer: turns the outline into slide copy.
 *
 * The writer runs at a creative temperature but on rails: the outline fixes
 * each slide's job and block, the hook is already chosen, the limits come from
 * the same table the validators enforce, and it may only use listed facts.
 * Decks with 6+ slides after the cover are written in two halves at the same
 * time (the outline already fixes each slide's message, so the halves don't
 * need each other). Smaller groups were measured slower: each call spends most
 * of its time reasoning over the whole outline, so more calls add work.
 * WRITER_CHUNK=n forces groups of at most n slides.
 *
 * The cover comes from the hook tournament (hooks.ts), which runs in parallel,
 * so the writer skips slide 1 when a tournament is running (`coverFromHook`).
 * If the tournament fails, writeCover() writes it afterwards.
 */

import { SHARED_ICONS } from '../../../config/constants';
import type { BlockKind, DraftSlide, HookChoice, Outline, OutlineBeat, PipelineContext } from './types';
import { limitsForPrompt } from './limits';
import { asList, asText } from './slides';
import { ask, briefBlock, factsBlock, languageRule, memoryBlock, untrusted } from './prompting';

export const SLIDE_ITEM_SCHEMA = {
    type: 'object',
    properties: {
        index: { type: 'number' },
        blockType: { type: 'string', enum: ['hero', 'body', 'list', 'stat', 'quote', 'split', 'closing'] },
        preHeader: { type: 'string' },
        headline: { type: 'string' },
        body: { type: 'string' },
        listItems: { type: 'array', items: { type: 'string' } },
        footer: { type: 'string' },
        accentPhrase: { type: 'string' },
        statNumber: { type: 'string' },
        statLabel: { type: 'string' },
        quoteAuthor: { type: 'string' },
        splitLeft: { type: 'string' },
        splitRight: { type: 'string' },
        icon: { type: 'string', enum: SHARED_ICONS },
    },
    required: ['index', 'headline'],
};

export const SLIDES_SCHEMA = {
    type: 'object',
    properties: { slides: { type: 'array', items: SLIDE_ITEM_SCHEMA } },
    required: ['slides'],
};

const caseRule = (templateId: string) =>
    templateId === 'template-4'
        ? 'Headlines in sentence case, quotable, no ALL CAPS.'
        : 'Headlines in sentence case, punchy and complete, no ALL CAPS.';

const beatLine = (b: OutlineBeat, i: number) =>
    `Slide ${i + 1} [${b.blockType}] ${b.purpose ? `(${b.purpose}) ` : ''}→ ${b.keyMessage}${b.factIds.length ? ` · facts: ${b.factIds.join(', ')}` : ''}`;

const writeRange = async (
    ctx: PipelineContext,
    outline: Outline,
    hook: HookChoice | null,
    from: number,
    to: number,
    previous: DraftSlide[],
    parallelParts = 1,
): Promise<any[]> => {
    const beats = outline.beats;
    const others = parallelParts > 1
        ? `\nThe other slides are being written at the same time from this same outline. Stick to your slides' key messages so nothing repeats.`
        : '';
    const blocksHere = Array.from(new Set(beats.slice(from, to).map((b) => b.blockType))) as BlockKind[];
    const prompt = `You write the copy for slides ${from + 1}-${to} of a ${beats.length}-slide carousel, following the outline exactly.

${briefBlock(ctx.brief, ctx.topic)}
${memoryBlock(ctx.memory)}
${ctx.customInstructions ? `USER INSTRUCTIONS: ${ctx.customInstructions}` : ''}
PREMISE: ${outline.premise}
TAKEAWAY: ${outline.takeaway}
${hook ? `COVER (already chosen, keep it): "${hook.headline}" / "${hook.subline}"` : ''}
${factsBlock(ctx.facts)}
${ctx.sourceContent && !ctx.facts.length ? untrusted('source_excerpt', ctx.sourceContent, 6000) : ''}

FULL OUTLINE (for flow; write only slides ${from + 1}-${to}):
${beats.map(beatLine).join('\n')}
${previous.length ? `\nALREADY WRITTEN (continue from here, don't repeat them):\n${previous.map((d, i) => (d ? `Slide ${i + 1}: ${d.headline}` : '')).filter(Boolean).join('\n')}` : ''}${others}

FIELDS AND LIMITS PER BLOCK (hard character limits; count before you answer):
${limitsForPrompt(ctx.templateId, blocksHere)}

Writing rules:
- One idea per slide. Concrete beats abstract: names, numbers from FACTS, examples, verbs.
- Every slide must move the argument forward; no filler, no repeating earlier slides.
- ${caseRule(ctx.templateId)}
- accentPhrase: 1-3 words copied EXACTLY from that slide's headline (the emotional pivot).
- icon: pick the most fitting from: ${SHARED_ICONS.join(', ')}.
- Numbers, statistics and quotes ONLY from FACTS. If a beat has no fact, make the point without numbers.
- Use each fact faithfully: keep who it is about, its scope, time frame and qualifiers ("about", "up to", "in one survey"). One person's or one company's result is an example, not a rule or a promise. Never merge two facts into a new claim.
- Each fact leads one slide only: don't lead with a number or claim another slide already leads with.
- Every body ends on a complete sentence. Never write fact ids (F1, F12) in slide text.
- No emojis, no hashtags. ${languageRule(ctx.outputLanguage)}
- Keep each slide's blockType exactly as in the outline. "index" is the 1-based slide number.

Return JSON: { "slides": [ { "index", "blockType", "preHeader", "headline", "body", "listItems", "footer", "accentPhrase", "statNumber", "statLabel", "quoteAuthor", "splitLeft", "splitRight", "icon" } ] }`;

    const r = await ask<{ slides: any[] }>({ role: 'writer', label: `writer.${from + 1}-${to}` }, prompt, SLIDES_SCHEMA);
    return Array.isArray(r?.slides) ? r.slides : [];
};

const toDraft = (raw: any, beat: OutlineBeat): DraftSlide => ({
    blockType: beat.blockType,
    preHeader: asText(raw?.preHeader),
    headline: (asText(raw?.headline) || '').trim(),
    body: asText(raw?.body),
    listItems: asList(raw?.listItems),
    footer: asText(raw?.footer),
    accentPhrase: asText(raw?.accentPhrase),
    statNumber: asText(raw?.statNumber),
    statLabel: asText(raw?.statLabel),
    quoteAuthor: asText(raw?.quoteAuthor),
    splitLeft: asText(raw?.splitLeft),
    splitRight: asText(raw?.splitRight),
    icon: asText(raw?.icon),
    factIds: beat.factIds,
});

/** Slides per parallel writer call: WRITER_CHUNK if set, else two halves from 6 slides up. */
const chunkSize = (slides: number) => {
    try {
        const v = Number(typeof process !== 'undefined' ? process.env?.WRITER_CHUNK : undefined);
        if (Number.isFinite(v) && v >= 1) return Math.floor(v);
    } catch { /* default below */ }
    return slides >= 6 ? Math.ceil(slides / 2) : slides;
};

/** Splits slides [from, to) into balanced groups of at most `size`. */
export const chunkRanges = (from: number, to: number, size: number): [number, number][] => {
    const n = to - from;
    if (n <= 0) return [];
    const parts = Math.ceil(n / Math.max(1, size));
    const base = Math.floor(n / parts);
    let extra = n % parts;
    const out: [number, number][] = [];
    let at = from;
    for (let k = 0; k < parts; k++) {
        const len = base + (extra > 0 ? 1 : 0);
        if (extra > 0) extra--;
        out.push([at, at + len]);
        at += len;
    }
    return out;
};

/** Locks the tournament's cover into slide 1. */
export const applyHook = (drafts: DraftSlide[], hook: HookChoice | null) => {
    if (!hook || !drafts[0]) return drafts;
    drafts[0].headline = hook.headline;
    drafts[0].body = hook.subline || drafts[0].body;
    drafts[0].preHeader = hook.preHeader || drafts[0].preHeader;
    drafts[0].accentPhrase = hook.accentPhrase || drafts[0].accentPhrase;
    return drafts;
};

/** Placeholder for a slide no call produced: the outline's own words. */
const fromBeat = (beat: OutlineBeat): DraftSlide => ({
    blockType: beat.blockType === 'stat' || beat.blockType === 'quote' || beat.blockType === 'split' ? 'body' : beat.blockType,
    headline: beat.keyMessage.slice(0, 60),
    body: beat.purpose || '',
    factIds: beat.factIds,
});

/**
 * Writes every slide in the outline, in parallel groups. With `coverFromHook`
 * slide 1 is left to the hook tournament (a placeholder stands in until
 * applyHook or writeCover replaces it). Missing slides are re-requested once,
 * then filled from the beat.
 */
export const writeSlides = async (
    ctx: PipelineContext,
    outline: Outline,
    hook: HookChoice | null,
    opts: { coverFromHook?: boolean } = {},
): Promise<DraftSlide[]> => {
    const n = outline.beats.length;
    const start = opts.coverFromHook && n > 1 ? 1 : 0;
    const ranges = chunkRanges(start, n, chunkSize(n - start));

    const byIndex = new Map<number, any>();
    const collect = (rows: any[], from: number, to: number) => {
        rows.forEach((row, pos) => {
            let idx = Number(row?.index) - 1;
            if (!Number.isInteger(idx) || idx < from || idx >= to) idx = from + pos;
            if (idx >= from && idx < to && !byIndex.has(idx)) byIndex.set(idx, row);
        });
    };

    const written: DraftSlide[] = [];
    // Both halves at once. A failed half is retried below as "missing slides".
    const errors: unknown[] = [];
    const parts = await Promise.all(ranges.map(([from, to]) =>
        writeRange(ctx, outline, hook, from, to, [], ranges.length).catch((err) => {
            if (ranges.length === 1 || /cancel/i.test(String(err?.message || err))) throw err;
            console.warn(`[v2.writer] slides ${from + 1}-${to} failed:`, err);
            errors.push(err);
            return [] as any[];
        })));
    if (errors.length === ranges.length) throw errors[0];
    parts.forEach((rows, k) => {
        const [from, to] = ranges[k];
        collect(rows, from, to);
        for (let i = from; i < to; i++) if (byIndex.has(i)) written[i] = toDraft(byIndex.get(i), outline.beats[i]);
    });

    // One targeted retry for any slide the model skipped.
    const missing = outline.beats.map((_, i) => i).filter((i) => i >= start && (!byIndex.has(i) || !(asText(byIndex.get(i)?.headline) || '').trim()));
    if (missing.length && missing.length < n - start) {
        try {
            const first = Math.min(...missing);
            const last = Math.max(...missing) + 1;
            const rows = await writeRange(ctx, outline, hook, first, last, written.slice(0, first));
            rows.forEach((row) => {
                const idx = Number(row?.index) - 1;
                if (missing.includes(idx) && (asText(row?.headline) || '').trim()) byIndex.set(idx, row);
            });
        } catch (err) {
            console.warn('[v2.writer] retry for missing slides failed:', err);
        }
    }

    const drafts = outline.beats.map((beat, i) => (byIndex.has(i) ? toDraft(byIndex.get(i), beat) : fromBeat(beat)));

    return applyHook(drafts, hook);
};

/** Writes the cover when the hook tournament produced nothing. Keeps the placeholder if this fails too. */
export const writeCover = async (ctx: PipelineContext, outline: Outline, drafts: DraftSlide[]): Promise<DraftSlide[]> => {
    try {
        const rows = await writeRange(ctx, outline, null, 0, 1, []);
        const row = rows.find((r) => Number(r?.index) === 1) || rows[0];
        if (row && (asText(row?.headline) || '').trim()) drafts[0] = toDraft(row, outline.beats[0]);
    } catch (err) {
        if (/cancel/i.test(String((err as any)?.message || err))) throw err;
        console.warn('[v2.writer] cover fallback failed:', err);
    }
    return drafts;
};
