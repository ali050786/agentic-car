/**
 * Deterministic validators and fixers.
 *
 * Everything here is code, not prompting: it runs on every draft, costs
 * nothing, and is the reason v2 output respects limits and rules even when the
 * model ignores the instructions. Fixes that need language (shortening a
 * sentence, removing a banned phrase gracefully) are collected as issues for
 * the tighten step; everything else is fixed in place.
 */

import type { TemplateId, StructuredMemory } from '../../../types';
import type { BlockKind, DraftSlide, Issue } from './types';
import { allowedBlocks, endsCleanly, getField, looksCut, specFor, TextField } from './limits';

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'be', 'your', 'you', 'it', 'this', 'that', 'at', 'by', 'from', 'as', 'we', 'our', 'my', 'i', 'not', 'no', 'do', 'does', 'how', 'why', 'what']);

/**
 * accentPhrase must be an exact substring of the headline (the renderer
 * highlights it in place). Repairs case mismatches, then falls back to the
 * strongest word in the headline.
 */
export const fixAccent = (d: DraftSlide): void => {
    const h = d.headline || '';
    if (!h) { d.accentPhrase = undefined; return; }
    const a = (d.accentPhrase || '').trim().replace(/^["'“”]+|["'“”.!?]+$/g, '');
    if (a && h.includes(a)) { d.accentPhrase = a; return; }
    if (a) {
        const idx = h.toLowerCase().indexOf(a.toLowerCase());
        if (idx >= 0) { d.accentPhrase = h.slice(idx, idx + a.length); return; }
        // Partial overlap: keep the longest word of the accent that exists in the headline.
        const words = a.split(/\s+/).filter((w) => w.length > 2).sort((x, y) => y.length - x.length);
        for (const w of words) {
            const j = h.toLowerCase().indexOf(w.toLowerCase());
            if (j >= 0) { d.accentPhrase = h.slice(j, j + w.length); return; }
        }
    }
    const candidates = h.replace(/[^\p{L}\p{N}\s'’-]/gu, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
    const best = candidates.sort((x, y) => y.length - x.length)[0];
    d.accentPhrase = best || undefined;
};

const FACT_ID_ONLY = /^\[?[FR]\d{1,2}\]?$/i;
/** Fact ids leaked into copy: "[F3]", "(F3, F5)", "According to F12, ...", "per F2". */
const FACT_ID_CITES: [RegExp, string][] = [
    [/\s*[\[(]\s*(?:[FR]\d{1,2}\s*[,;/&]?\s*)+[\])]/g, ''],
    [/\b(?:according to|as per|per|see|from|citing|source:?)\s+(?:[FR]\d{1,2}(?:\s*(?:,|and|&)\s*)?)+,?\s*/gi, ''],
    [/\b[FR]\d{1,2}\s+(?:says|shows|states|notes|found|reports)\s+(?:that\s+)?/g, ''],
];

/** Removes fact ids from slide text (deterministic; the model is told never to write them). */
export const scrubFactIds = (d: DraftSlide): void => {
    const clean = (s?: string) => {
        if (!s) return s;
        let out = s;
        for (const [re, rep] of FACT_ID_CITES) out = out.replace(re, rep);
        if (out === s) return s;
        out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
        return out.charAt(0).toUpperCase() + out.slice(1);
    };
    for (const f of ['preHeader', 'headline', 'body', 'footer', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight'] as const) (d as any)[f] = clean((d as any)[f]);
    d.headline = d.headline || '';
    d.listItems = d.listItems?.map((x) => clean(x) || '').filter(Boolean);
};

/** Structural fixes: count, hero first, closing last, allowed blocks, block-field sanity. Mutates. */
export const fixStructure = (drafts: DraftSlide[], templateId: TemplateId): DraftSlide[] => {
    const allowed = new Set(allowedBlocks(templateId));
    let out = drafts.filter((d) => d && (d.headline?.trim() || d.body?.trim() || d.listItems?.length || d.statNumber || d.splitLeft));
    out.forEach((d) => {
        if (!allowed.has(d.blockType)) d.blockType = 'body';
        // A block without its defining content degrades to the closest safe block.
        // A big number must be a number: "F2" (a leaked fact id) or a word is not.
        if (d.blockType === 'stat' && (!d.statNumber?.trim() || !/\d/.test(d.statNumber) || FACT_ID_ONLY.test(d.statNumber.trim()))) {
            d.statNumber = undefined;
            d.blockType = 'body';
        }
        if (d.blockType === 'quote' && !d.quoteAuthor?.trim()) d.blockType = 'body';
        if (d.blockType === 'split' && !(d.splitLeft?.trim() && d.splitRight?.trim())) d.blockType = 'body';
        if (d.blockType === 'list' && !(d.listItems && d.listItems.length >= 2)) d.blockType = 'body';
        if (d.blockType === 'body' && !d.body && d.listItems?.length) d.body = d.listItems.join(' ');
        if (d.blockType === 'stat' && !d.headline) d.headline = d.statLabel || '';
        if (d.blockType === 'list') {
            const spec = specFor(templateId, 'list');
            d.listItems = (d.listItems || []).map((x) => String(x).trim()).filter(Boolean).slice(0, spec.items?.max ?? 4);
        }
    });
    if (out.length > 0) {
        out[0].blockType = 'hero';
        if (out.length > 1) out[out.length - 1].blockType = 'closing';
        for (let i = 1; i < out.length - 1; i++) {
            if (out[i].blockType === 'hero' || out[i].blockType === 'closing') out[i].blockType = 'body';
        }
    }
    out.forEach(scrubFactIds);
    out.forEach(foldExtras);
    out.forEach(fixAccent);
    return out;
};

/**
 * Block-specific fields that don't belong to the slide's final block would be
 * invisible (and unchecked) on screen. Fold their content into an empty body so
 * nothing the reader should see is lost, then clear them.
 */
const foldExtras = (d: DraftSlide): void => {
    const extras: string[] = [];
    if (d.blockType !== 'stat') {
        if (d.statNumber || d.statLabel) extras.push([d.statNumber, d.statLabel].filter(Boolean).join(' '));
        d.statNumber = undefined;
        d.statLabel = undefined;
    }
    if (d.blockType !== 'split') {
        if (d.splitLeft || d.splitRight) extras.push([d.splitLeft, d.splitRight].filter(Boolean).join(' / '));
        d.splitLeft = undefined;
        d.splitRight = undefined;
    }
    if (d.blockType !== 'quote') {
        if (d.quoteAuthor) extras.push(d.quoteAuthor);
        d.quoteAuthor = undefined;
    }
    if (d.blockType !== 'list' && d.blockType !== 'body' && d.listItems?.length) {
        extras.push(d.listItems.join('; '));
    }
    if (d.blockType !== 'list') d.listItems = undefined;
    if (!d.body?.trim() && extras.length) d.body = extras.join('. ');
};

/** Terms from memory that must never appear, as literal strings. */
export const bannedTerms = (memory?: StructuredMemory): { terms: string[]; noEmoji: boolean } => {
    const terms: string[] = [];
    let noEmoji = false;
    for (const raw of memory?.bannedWords || []) {
        const s = raw.trim();
        if (!s) continue;
        if (/emoji/i.test(s)) { noEmoji = true; continue; }
        // "Banned: synergy", "never use 'leverage'", "avoid the word X" → extract the term.
        const quoted = s.match(/["'“‘]([^"'”’]{2,40})["'”’]/);
        const afterColon = s.match(/:\s*(.{2,40})$/);
        const afterVerb = s.match(/(?:never use|don't use|do not use|avoid(?: the word| using)?|ban(?:ned)?)\s+(?:the word\s+)?(.{2,40})$/i);
        const term = (quoted?.[1] || afterColon?.[1] || afterVerb?.[1] || (s.split(/\s+/).length <= 3 ? s : '')).trim().replace(/[.!]$/, '');
        if (term) terms.push(term);
    }
    return { terms: Array.from(new Set(terms.map((t) => t.toLowerCase()))), noEmoji };
};

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}‍️]/gu;

export const stripEmoji = (d: DraftSlide): void => {
    const f = (s?: string) => (s ? s.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim() : s);
    d.preHeader = f(d.preHeader); d.headline = f(d.headline) || ''; d.body = f(d.body); d.footer = f(d.footer);
    d.statLabel = f(d.statLabel); d.splitLeft = f(d.splitLeft); d.splitRight = f(d.splitRight);
    d.listItems = d.listItems?.map((x) => f(x) || '');
    if (d.extras) d.extras = Object.fromEntries(Object.entries(d.extras).map(([k, v]) => [k, f(v) || '']).filter(([, v]) => v));
};

const TEXT_FIELDS: Exclude<TextField, 'listItem'>[] = ['preHeader', 'headline', 'body', 'footer', 'statNumber', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight'];

const containsTerm = (text: string, term: string): boolean => {
    if (!text) return false;
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'iu').test(text);
};

/** Validation pass: returns every rule violation (does not mutate). */
export const validateDeck = (
    drafts: DraftSlide[],
    templateId: TemplateId,
    opts: { count?: number; banned?: string[] } = {},
): Issue[] => {
    const issues: Issue[] = [];
    if (opts.count && drafts.length !== opts.count) {
        issues.push({ index: -1, code: 'count', message: `Deck has ${drafts.length} slides; ${opts.count} were requested.`, severity: 'block' });
    }
    const seen = new Map<string, number>();
    drafts.forEach((d, i) => {
        const spec = specFor(templateId, d.blockType as BlockKind);
        for (const f of spec.required) {
            if (f === 'listItem') {
                const n = d.listItems?.length || 0;
                if (spec.items && n < spec.items.min) issues.push({ index: i, field: 'listItems', code: 'missing_field', message: `needs ${spec.items.min} list items, has ${n}`, severity: 'warn' });
            } else if (!getField(d, f).trim()) {
                issues.push({ index: i, field: f, code: 'missing_field', message: `${f} is empty`, severity: f === 'headline' ? 'block' : 'warn' });
            }
        }
        for (const f of TEXT_FIELDS) {
            const max = spec.max[f];
            const v = getField(d, f);
            if (max && v.length > max) issues.push({ index: i, field: f, code: 'over_limit', message: `${f} is ${v.length} chars; limit ${max}`, severity: 'block' });
        }
        const maxItem = spec.max.listItem;
        (d.listItems || []).forEach((li, k) => {
            if (maxItem && li.length > maxItem) issues.push({ index: i, field: `listItems[${k}]`, code: 'over_limit', message: `list item ${k + 1} is ${li.length} chars; limit ${maxItem}`, severity: 'block' });
        });
        for (const term of opts.banned || []) {
            for (const f of TEXT_FIELDS) {
                if (containsTerm(getField(d, f), term)) issues.push({ index: i, field: f, code: 'banned', message: `uses banned term "${term}"`, severity: 'block' });
            }
            (d.listItems || []).forEach((li, k) => {
                if (containsTerm(li, term)) issues.push({ index: i, field: `listItems[${k}]`, code: 'banned', message: `uses banned term "${term}"`, severity: 'block' });
            });
        }
        // Body copy that stops mid-sentence reads as broken on the slide.
        const body = getField(d, 'body').trim();
        if (body && body.length >= 25 && !endsCleanly(body)) {
            issues.push({ index: i, field: 'body', code: 'fragment', message: 'body stops mid-sentence', severity: 'warn' });
        }
        // Headlines, labels and list items that stop on a connector or an open quote ("...serverless vs.").
        for (const f of ['headline', 'preHeader', 'footer', 'statLabel'] as const) {
            if (looksCut(getField(d, f))) issues.push({ index: i, field: f, code: 'fragment', message: `${f} reads as cut off`, severity: 'warn' });
        }
        (d.listItems || []).forEach((li, k) => {
            if (looksCut(li)) issues.push({ index: i, field: `listItems[${k}]`, code: 'fragment', message: `list item ${k + 1} reads as cut off`, severity: 'warn' });
        });
        const key = (d.headline || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        if (key) {
            if (seen.has(key)) issues.push({ index: i, field: 'headline', code: 'duplicate', message: `same headline as slide ${(seen.get(key) as number) + 1}`, severity: 'warn' });
            else seen.set(key, i);
        }
    });
    return issues;
};

/** Deterministic last resort for banned terms the tighten step couldn't remove. */
export const removeBannedTerms = (d: DraftSlide, terms: string[]): void => {
    if (!terms.length) return;
    const scrub = (s?: string) => {
        if (!s) return s;
        let out = s;
        for (const term of terms) {
            const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp(`(^|[^\\p{L}])${esc}(?=[^\\p{L}]|$)`, 'giu'), '$1');
        }
        return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
    };
    for (const f of TEXT_FIELDS) (d as any)[f] = scrub((d as any)[f]);
    d.headline = d.headline || '';
    d.listItems = d.listItems?.map((x) => scrub(x) || '').filter(Boolean);
    // A design label that carried a banned term is dropped, not patched.
    if (d.extras) d.extras = Object.fromEntries(Object.entries(d.extras).filter(([, v]) => !terms.some((t) => containsTerm(v, t))));
};

/** Reads a field path like "body" or "listItems[2]". */
export const readPath = (d: DraftSlide, path: string): string => {
    const m = path.match(/^listItems\[(\d+)\]$/);
    if (m) return d.listItems?.[Number(m[1])] || '';
    return ((d as any)[path] || '') as string;
};

export const writePath = (d: DraftSlide, path: string, value: string): void => {
    const m = path.match(/^listItems\[(\d+)\]$/);
    if (m) {
        const k = Number(m[1]);
        if (!d.listItems) d.listItems = [];
        d.listItems[k] = value;
        return;
    }
    (d as any)[path] = value;
};

export const maxFor = (d: DraftSlide, templateId: TemplateId, path: string): number | undefined => {
    const spec = specFor(templateId, d.blockType);
    if (path.startsWith('listItems')) return spec.max.listItem;
    return (spec.max as any)[path];
};
