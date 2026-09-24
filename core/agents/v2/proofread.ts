/**
 * Proofread: grammar, spelling and punctuation only, across every text field.
 *
 * v1's proofreader saw headline/body/list items only, so stat labels, quote
 * authors and split sides were never checked, and a "proofread" could quietly
 * rewrite a sentence. v2 sends small chunks at temperature 0, asks for
 * corrections only (not a full re-emit), and rejects any correction that
 * changes length by more than 30% or breaks a limit.
 */

import type { TemplateId } from '../../../types';
import type { DraftSlide } from './types';
import { ask, languageRule } from './prompting';
import { fixAccent, maxFor, readPath, writePath } from './validate';
import { isCancel } from '../../llm/cancel';

const SCHEMA = {
    type: 'object',
    properties: {
        corrections: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    slide: { type: 'number' },
                    field: { type: 'string' },
                    text: { type: 'string' },
                },
                required: ['slide', 'field', 'text'],
            },
        },
    },
    required: ['corrections'],
};

const FIELDS = ['preHeader', 'headline', 'body', 'footer', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight'];

const fieldsOf = (d: DraftSlide): string[] => [
    ...FIELDS.filter((f) => readPath(d, f).trim()),
    ...(d.listItems || []).map((_, k) => `listItems[${k}]`),
];

const CHUNK = 5;

export const proofreadDeck = async (
    drafts: DraftSlide[],
    templateId: TemplateId,
    outputLanguage: string,
    /** Proofread only these slides (0-based); the rest are left alone. */
    only?: number[],
): Promise<{ corrected: number; rejected: number }> => {
    const targets = (only ?? drafts.map((_, i) => i)).filter((i) => i >= 0 && i < drafts.length && drafts[i]);
    const chunks: number[][] = [];
    for (let i = 0; i < targets.length; i += CHUNK) chunks.push(targets.slice(i, i + CHUNK));
    if (!chunks.length) return { corrected: 0, rejected: 0 };

    const results = await Promise.all(chunks.map(async (idxs) => {
        const listing = idxs
            .map((i) => fieldsOf(drafts[i]).map((f) => `S${i + 1}.${f}: ${readPath(drafts[i], f)}`).join('\n'))
            .join('\n');
        const prompt = `Proofread these carousel text fields. Fix ONLY spelling, grammar, punctuation, capitalization consistency and obvious typos.
Do NOT rephrase, shorten, lengthen, change tone, change numbers or names, or "improve" style. Headlines stay in sentence case.
${languageRule(outputLanguage)}

${listing}

Return JSON: { "corrections": [ { "slide": number, "field": string, "text": string } ] } with ONLY the fields that actually needed a fix (field exactly as written after the dot, e.g. "headline" or "listItems[1]"). Return an empty list if everything is correct.`;
        try {
            const r = await ask<{ corrections: { slide: number; field: string; text: string }[] }>(
                { role: 'fast', label: 'proofread', temperature: 0 },
                prompt,
                SCHEMA,
            );
            return r?.corrections || [];
        } catch (err) {
            if (isCancel(err)) throw err;
            console.warn('[v2.proofread] chunk failed (keeping text as is):', err);
            return [];
        }
    }));

    let corrected = 0;
    let rejected = 0;
    for (const c of results.flat()) {
        const i = Number(c.slide) - 1;
        if (!targets.includes(i)) continue;
        const d = drafts[i];
        const field = String(c.field || '').trim();
        const text = String(c.text || '').trim();
        if (!d || !text || !(FIELDS.includes(field) || /^listItems\[\d+\]$/.test(field))) continue;
        const before = readPath(d, field);
        if (!before || before === text) continue;
        const max = maxFor(d, templateId, field);
        const drift = Math.abs(text.length - before.length) / Math.max(1, before.length);
        const digits = (s: string) => (s.match(/\d+/g) || []).join(',');
        if (drift > 0.3 || (max && text.length > max) || digits(before) !== digits(text)) {
            rejected++;
            continue;
        }
        writePath(d, field, text);
        corrected++;
    }
    targets.forEach((i) => fixAccent(drafts[i]));
    return { corrected, rejected };
};
