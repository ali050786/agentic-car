/**
 * Numeric grounding.
 *
 * Finds numeric claims in slide copy (percentages, money, multipliers, large
 * counts) and checks each one appears in the material we actually have: the
 * fact sheet, the source content, or the user's own request. Anything else is
 * treated as possibly invented. The critic is told to fix those, and stat
 * slides built on an unsupported number are downgraded to plain slides.
 *
 * Percentages are matched with their unit: "1%" needs a "1%" in the material,
 * not just any "1" (a bare digit is in almost every fact). Numbers that appear
 * as a headline or big number on more than one slide are flagged too: the
 * same figure repeated across slides reads as padding.
 */

import type { DraftSlide, Fact, Issue } from './types';

const CLAIM_RE = /(?:[$€£₹]\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|bn|b|million|billion|thousand|trillion)?)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent|x\b|×|k\b|m\b|bn\b|million|billion|thousand|trillion))|(?:\b\d{1,3}(?:,\d{3})+\b)|(?:\b\d+\s+(?:in|out of)\s+\d+\b)|(?:\b\d{3,}\b)/gi;

const YEAR_RE = /^(1[5-9]\d{2}|20\d{2}|2100)$/;

/** Numbers normalised for comparison: "4,200" → "4200", "3.0x" → "3x". */
const normalizeNumber = (raw: string): string[] => {
    const digits = raw.match(/\d[\d,]*(?:\.\d+)?/g) || [];
    return digits.map((d) => d.replace(/,/g, '').replace(/\.0+$/, ''));
};

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };
const SCALED_RE = /(\d[\d,]*(?:\.\d+)?)\s?(k|m|bn|b|t|thousand|million|billion|trillion)\b/gi;

/** "4.2M" / "$4.2 billion" / "10K" → the full value as a plain digit string. */
const expandScaled = (raw: string): string[] => {
    const out: string[] = [];
    for (const m of raw.matchAll(SCALED_RE)) {
        const n = Number(m[1].replace(/,/g, '')) * (SCALE[m[2].toLowerCase()] || 1);
        if (Number.isFinite(n)) out.push(String(Math.round(n)));
    }
    return out;
};

export const extractClaims = (text: string): string[] => {
    const found = (text || '').match(CLAIM_RE) || [];
    return found
        .map((f) => f.trim())
        .filter((f) => {
            const nums = normalizeNumber(f);
            // Bare years ("in 2024") are context, not statistics.
            if (nums.length === 1 && YEAR_RE.test(nums[0]) && !/[%$€£₹x×]|million|billion/i.test(f)) return false;
            return nums.length > 0;
        });
};

/** Builds the searchable number pool from everything we consider ground truth. */
export const numberPool = (facts: Fact[], sourceContent: string, userText: string): Set<string> => {
    const pool = new Set<string>();
    const add = (text: string) => {
        for (const m of (text || '').matchAll(/\d[\d,]*(?:\.\d+)?(\s?(?:%|percent\b|per cent\b|por ciento\b))?/gi)) {
            const clean = m[0].match(/\d[\d,]*(?:\.\d+)?/)![0].replace(/,/g, '').replace(/\.0+$/, '');
            const pct = !!m[1];
            pool.add(clean);
            if (pct) pool.add(`${clean}%`);
            // "4.2B" style: also accept the rounded integer the writer might use.
            if (clean.includes('.')) {
                const r = String(Math.round(Number(clean)));
                pool.add(r);
                if (pct) pool.add(`${r}%`);
            }
        }
    };
    const addScaled = (text: string) => expandScaled(text || '').forEach((n) => pool.add(n));
    for (const t of [...facts.map((f) => f.text), sourceContent.slice(0, 40000), userText]) {
        add(t);
        addScaled(t);
    }
    return pool;
};

/** Returns an unsupported_number issue for every claim not backed by the pool. */
export const groundingIssues = (
    drafts: DraftSlide[],
    pool: Set<string>,
    strict: boolean,
): Issue[] => {
    const issues: Issue[] = [];
    drafts.forEach((d, i) => {
        const fields: [string, string | undefined][] = [
            ['headline', d.headline], ['body', d.body], ['statNumber', d.statNumber], ['statLabel', d.statLabel],
            ['splitLeft', d.splitLeft], ['splitRight', d.splitRight], ...(d.listItems || []).map((li, k) => [`listItems[${k}]`, li] as [string, string]),
        ];
        for (const [field, text] of fields) {
            for (const claim of extractClaims(text || '')) {
                const nums = normalizeNumber(claim);
                // A percentage needs the same percentage in the material, not just the digits.
                const isPct = /%|percent|per cent|por ciento/i.test(claim);
                // "4.2M" is supported by a fact that says 4,200,000, and vice versa.
                const scaled = expandScaled(claim);
                const supported = isPct
                    ? nums.every((n) => pool.has(`${n}%`))
                    : nums.every((n) => pool.has(n)) || (scaled.length > 0 && scaled.every((n) => pool.has(n)));
                if (!supported) {
                    issues.push({
                        index: i,
                        field,
                        code: 'unsupported_number',
                        message: `"${claim}" is not in the research or source material. Remove it or replace it with a figure from the facts.`,
                        severity: strict || field === 'statNumber' ? 'block' : 'warn',
                    });
                }
            }
        }
    });
    return issues;
};

/** The figures a slide leads with: its headline and big number. */
const leadClaims = (d: DraftSlide): string[] => {
    const out = new Set<string>();
    for (const text of [d.headline, d.statNumber]) {
        for (const claim of extractClaims(text || '')) {
            const isPct = /%|percent|per cent|por ciento/i.test(claim);
            const scaled = expandScaled(claim);
            const nums = scaled.length ? scaled : normalizeNumber(claim);
            nums.forEach((n) => out.add(isPct ? `${n}%` : n));
        }
    }
    return Array.from(out);
};

/**
 * The same figure as the headline or big number of two slides (the cover
 * teasing "35%" and slide 3 leading with "35%" again). Later slides get a
 * note to use a different fact or make a different point. Mentions in body
 * copy are fine: explaining a number is not repeating it.
 */
export const repeatedNumberIssues = (drafts: DraftSlide[]): Issue[] => {
    const first = new Map<string, number>();
    const issues: Issue[] = [];
    drafts.forEach((d, i) => {
        for (const n of leadClaims(d)) {
            if (!first.has(n)) { first.set(n, i); continue; }
            issues.push({
                index: i,
                field: d.statNumber && leadClaims({ blockType: d.blockType, headline: '', statNumber: d.statNumber }).includes(n) ? 'statNumber' : 'headline',
                code: 'repeat_number',
                message: `leads with ${n}, which slide ${first.get(n)! + 1} already leads with. Use a different fact or make a new point with it.`,
                severity: 'warn',
            });
        }
    });
    return issues;
};
