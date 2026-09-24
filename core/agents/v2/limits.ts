/**
 * Machine-readable copy limits per template and block.
 *
 * The v1 prompts described limits in prose ("Max 50 chars") and nothing ever
 * checked them, so overflowing text was left to the renderer. These tables are
 * the single source of truth: prompts are generated FROM them and validators
 * enforce them. Numbers mirror the existing TEMPLATE_CONFIGS guidance and the
 * block renderers' font sizes.
 */

import type { TemplateId } from '../../../types';
import type { BlockKind, DraftSlide } from './types';

export type TextField =
    | 'preHeader' | 'headline' | 'body' | 'footer'
    | 'statNumber' | 'statLabel' | 'quoteAuthor' | 'splitLeft' | 'splitRight'
    | 'listItem';

export interface BlockSpec {
    /** Fields the writer must fill for this block. */
    required: TextField[];
    /** Max characters per field (listItem = per item). */
    max: Partial<Record<TextField, number>>;
    /** List item count bounds (list blocks only). */
    items?: { min: number; max: number };
    /** One-line guidance for the writer. */
    guide: string;
}

type TemplateSpec = Partial<Record<BlockKind, BlockSpec>>;

const STAT = (label: number): BlockSpec => ({
    required: ['headline', 'statNumber', 'statLabel'],
    max: { preHeader: 40, headline: 45, statNumber: 10, statLabel: label, body: 140 },
    guide: 'One striking, VERIFIED number (statNumber, e.g. "73%", "3x", "$4.2B", "1 in 5") with what it measures (statLabel). headline is a short caption for the takeaway. Only use a number that appears in the facts.',
});

const QUOTE: BlockSpec = {
    required: ['headline', 'quoteAuthor'],
    max: { headline: 120, quoteAuthor: 40 },
    guide: 'headline is the quote itself, without quote marks. quoteAuthor is who said it. Only quote words that appear in the facts/source with their real speaker.',
};

const SPLIT: BlockSpec = {
    required: ['headline', 'splitLeft', 'splitRight'],
    max: { preHeader: 40, headline: 40, splitLeft: 90, splitRight: 90 },
    guide: 'A contrast: myth vs fact, before vs after, do vs don\'t. splitLeft and splitRight each start with a short label then a colon, e.g. "Myth: …" / "Fact: …".',
};

export const TEMPLATE_LIMITS: Partial<Record<TemplateId, TemplateSpec>> & Record<'template-1' | 'template-3' | 'template-4', TemplateSpec> = {
    'template-1': {
        hero: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 60, headline: 50, body: 150 }, guide: 'The cover. A specific, curiosity-driving headline and a one-line promise.' },
        body: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 60, headline: 50, body: 250 }, guide: 'One idea. Headline states it, body proves or explains it in 1-2 sentences.' },
        list: { required: ['headline', 'listItem'], max: { preHeader: 60, headline: 35, listItem: 80 }, items: { min: 3, max: 3 }, guide: 'Exactly 3 parallel items, each "Key: value".' },
        stat: STAT(60),
        quote: QUOTE,
        split: SPLIT,
        closing: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 60, headline: 50, body: 80, footer: 25 }, guide: 'The takeaway and a clear next step.' },
    },
    'template-3': {
        hero: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 60, headline: 45, body: 150 }, guide: 'The cover. Warm, specific, conversational.' },
        body: { required: ['headline', 'body'], max: { preHeader: 40, headline: 45, body: 200 }, guide: 'One idea, told simply.' },
        list: { required: ['headline', 'listItem'], max: { preHeader: 40, headline: 30, listItem: 70 }, items: { min: 3, max: 3 }, guide: 'Exactly 3 parallel items, each "Key: value".' },
        stat: STAT(55),
        quote: QUOTE,
        closing: { required: ['headline', 'body'], max: { preHeader: 40, headline: 45, body: 120, footer: 25 }, guide: 'The takeaway and a clear next step.' },
    },
    'template-4': {
        hero: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 40, headline: 60, body: 140 }, guide: 'The cover. A declarative thesis in sentence case.' },
        body: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 30, headline: 70, body: 220 }, guide: 'One idea as a quotable statement, then the explanation.' },
        list: { required: ['headline', 'listItem'], max: { preHeader: 30, headline: 40, listItem: 80 }, items: { min: 3, max: 4 }, guide: '3-4 parallel items, each "Key: value".' },
        stat: STAT(60),
        quote: QUOTE,
        split: SPLIT,
        closing: { required: ['preHeader', 'headline', 'body', 'footer'], max: { preHeader: 30, headline: 50, body: 140, footer: 25 }, guide: 'The takeaway, plus a short button label in footer (e.g. "Follow for more").' },
    },
};

// The Canvas (template-5) lays out each slide around its content, so limits are
// a little looser; the renderer still auto-fits text in the browser.
TEMPLATE_LIMITS['template-5'] = {
    hero: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 40, headline: 64, body: 140 }, guide: 'The cover. A specific, scroll-stopping headline and a one-line promise.' },
    body: { required: ['preHeader', 'headline', 'body'], max: { preHeader: 40, headline: 64, body: 220 }, guide: 'One idea. Headline states it, body proves or explains it in 1-2 sentences.' },
    list: { required: ['headline', 'listItem'], max: { preHeader: 40, headline: 48, listItem: 90 }, items: { min: 3, max: 5 }, guide: '3-5 parallel items, each "Key: value" with a short key (1-4 words).' },
    stat: { required: ['headline', 'statNumber', 'statLabel'], max: { preHeader: 40, headline: 60, statNumber: 10, statLabel: 70, body: 140 }, guide: 'One striking, VERIFIED number (statNumber, e.g. "73%", "3x", "$4.2B") with what it measures (statLabel). headline is the takeaway in one line. Only use a number that appears in the facts.' },
    quote: { required: ['headline', 'quoteAuthor'], max: { headline: 140, quoteAuthor: 40 }, guide: 'headline is the quote itself, without quote marks. quoteAuthor is who said it. Only quote words that appear in the facts/source with their real speaker.' },
    split: { required: ['headline', 'splitLeft', 'splitRight'], max: { preHeader: 40, headline: 48, splitLeft: 110, splitRight: 110 }, guide: 'A genuine contrast (before vs after, do vs don\'t, myth vs fact). splitLeft and splitRight each start with a 1-3 word label then a colon, e.g. "Before: …" / "After: …".' },
    closing: { required: ['headline', 'body', 'footer'], max: { preHeader: 40, headline: 56, body: 120, footer: 28 }, guide: 'The takeaway, plus a short call-to-action button label in footer (e.g. "Save this for later").' },
};

export const specFor = (templateId: TemplateId, block: BlockKind): BlockSpec => {
    const t = TEMPLATE_LIMITS[templateId] || TEMPLATE_LIMITS['template-1'];
    return t[block] || t.body!;
};

export const allowedBlocks = (templateId: TemplateId): BlockKind[] =>
    Object.keys(TEMPLATE_LIMITS[templateId] || TEMPLATE_LIMITS['template-1']) as BlockKind[];

/** Human-readable limits table for prompts, generated from the spec. */
export const limitsForPrompt = (templateId: TemplateId, blocks?: BlockKind[]): string => {
    const list = blocks && blocks.length ? Array.from(new Set(blocks)) : allowedBlocks(templateId);
    return list
        .map((b) => {
            const s = specFor(templateId, b);
            const caps = Object.entries(s.max)
                .map(([f, n]) => `${f === 'listItem' ? 'each list item' : f} ≤ ${n}`)
                .join(', ');
            const items = s.items ? `; ${s.items.min === s.items.max ? s.items.min : `${s.items.min}-${s.items.max}`} list items` : '';
            return `- ${b}: fill ${s.required.map((f) => (f === 'listItem' ? 'listItems' : f)).join(', ')} (${caps}${items}). ${s.guide}`;
        })
        .join('\n');
};

/** Read one text field from a draft (listItem handled by the caller). */
export const getField = (d: DraftSlide, f: Exclude<TextField, 'listItem'>): string => ((d as any)[f] || '') as string;

/**
 * Last-resort fit: trims to the last whole word under `max`, dropping dangling
 * connectors and trailing punctuation that would read as broken. Only used
 * after a model-based tighten pass failed to bring the field under the limit.
 */
/** Fields that hold sentences (a cut must end on a full sentence), as opposed to labels. */
export const SENTENCE_FIELDS = new Set(['body', 'splitLeft', 'splitRight']);

/** True when the text ends like a finished sentence (terminal punctuation, optionally closed by a quote or bracket). */
export const endsCleanly = (text: string): boolean => /[.!?…。！？]['"”’)\]]*\s*$/.test((text || '').trim());

/** Words a label must never end on: a phrase that stops on one of these reads as cut off. */
const DANGLING = new Set([
    // Articles, conjunctions, prepositions and possessives only: words a finished phrase can't end on.
    'and', 'or', 'but', 'nor', 'the', 'a', 'an', 'of', 'to', 'for', 'with', 'from', 'that', 'which', 'your', 'my', 'our', 'their', 'its',
    'into', 'than', 'vs', 'vs.', 'versus', 'via',
    'y', 'e', 'o', 'u', 'ni', 'de', 'del', 'al', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'sin', 'para', 'por', 'que', 'su', 'sus', 'tu', 'tus', 'mi',
]);

/** Single letters count only in lowercase: "Plan A" or "Vitamin E" are finished phrases. */
const isDangling = (w: string) => DANGLING.has(w.length === 1 ? w : w.toLowerCase());

const trimDangling = (t: string): string => {
    let out = t.replace(/[\s,;:–—(-]+$/g, '');
    for (let i = 0; i < 4; i++) {
        const m = out.match(/\s+(\S+)$/);
        if (!m || !isDangling(m[1])) break;
        out = out.slice(0, m.index).replace(/[\s,;:–—(-]+$/g, '');
    }
    return out;
};

const quotesOpen = (t: string) => ((t.match(/"/g) || []).length % 2 === 1) || (t.split('“').length > t.split('”').length) || (t.split('(').length > t.split(')').length);

/**
 * True when a short label or headline reads as chopped off: it ends on a
 * connector ("…serverless vs.", "…haven't done your", "…sin") or leaves a quote
 * or bracket open. Used to reject model rewrites and to steer the last-resort cut.
 */
export const looksCut = (text: string): boolean => {
    const t = (text || '').trim();
    if (!t) return false;
    if (quotesOpen(t)) return true;
    const last = t.replace(/[.,;:!?…]+$/, '').split(/\s+/).pop() || '';
    return isDangling(last) || isDangling(`${last}.`) || /[,;:–—-]$/.test(t);
};

/**
 * Label cut: prefer a natural break (colon, dash, comma, semicolon, bracket)
 * in the back half of the limit, so a list item keeps whole clauses
 * ("Cost trade-offs: spot vs. on-demand, cache vs. recompute"); otherwise the
 * last whole word, without dangling connectors or an open quote.
 */
const wordCut = (t: string, max: number): string => {
    const room = t.slice(0, max + 1);
    const breaks = Array.from(room.matchAll(/(?:[,;:]\s|\s[–—-]\s|\s\()/g)).map((m) => m.index!).filter((i) => i >= max * 0.5 && i <= max);
    let cut: string;
    if (breaks.length) {
        cut = t.slice(0, breaks[breaks.length - 1]);
    } else {
        const lastSpace = room.lastIndexOf(' ');
        cut = lastSpace > max * 0.5 ? room.slice(0, lastSpace) : t.slice(0, max);
    }
    cut = trimDangling(cut);
    // An opened quote or bracket that the cut left open: cut before it if that keeps enough, else drop the mark.
    if (quotesOpen(cut)) {
        const at = Math.max(cut.lastIndexOf('"'), cut.lastIndexOf('“'), cut.lastIndexOf('('));
        const before = trimDangling(cut.slice(0, at));
        cut = before.length >= max * 0.5 ? before : cut.replace(/["“(]/g, '');
    }
    return cut.replace(/[,;:]$/, '');
};

/**
 * Last-resort fit to a character limit (the model's rewrite didn't fit).
 * Labels are cut at a word. Sentence fields never end mid-sentence: they keep
 * the whole sentences that fit, else end at a clause break with a period,
 * else end the cut with an ellipsis so it reads as intended.
 */
export const hardFit = (text: string, max: number, field = 'body'): string => {
    const t = (text || '').trim();
    if (t.length <= max) return t;
    if (!SENTENCE_FIELDS.has(field)) return wordCut(t, max);

    // 1. Whole sentences.
    const sentences = t.match(/[^.!?…。！？]+(?:[.!?…。！？]+["”’')\]]*|$)\s*/g) || [t];
    let kept = '';
    for (const s of sentences) {
        if (!/[.!?…。！？]["”’')\]]*\s*$/.test(s)) break; // a trailing fragment is never a sentence
        if ((kept + s).trim().length > max) break;
        kept += s;
    }
    kept = kept.trim();
    if (kept.length >= Math.min(40, max * 0.5)) return kept;

    // 2. A clause break inside the first sentence that doesn't fit, closed with a period.
    const room = t.slice(0, max);
    const breaks = Array.from(room.matchAll(/[,;:—–](?=\s)/g)).map((m) => m.index!).filter((i) => i >= max * 0.5);
    if (breaks.length) return `${room.slice(0, breaks[breaks.length - 1]).trim()}.`;

    // 3. A word cut that says it was cut.
    return `${wordCut(t, max - 1)}…`;
};

/**
 * A body that stops mid-thought ("...He received nearly 15") is cut back to its
 * last whole sentence; with no whole sentence to keep, it is closed with a
 * period so it at least reads as intended. Deterministic last resort.
 */
export const closeFragment = (text: string): string => {
    const t = (text || '').trim();
    if (!t || endsCleanly(t)) return t;
    const sentences = t.match(/[^.!?…。！？]+[.!?…。！？]+['"”’)\]]*\s*/g) || [];
    const kept = sentences.join('').trim();
    if (kept.length >= 30) return kept;
    return `${t.replace(/[\s,;:–—-]+$/g, '').replace(/\s+(and|or|but|the|a|an|of|to|for|with|in|on|at|by|from|that|which)$/i, '')}.`;
};

/** A label or headline that reads as chopped off, cut back to where it still reads complete. */
export const closeLabel = (text: string): string => {
    const t = (text || '').trim();
    return looksCut(t) ? wordCut(t, t.length) || t : t;
};
