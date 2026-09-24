/**
 * Tighten: language fixes for rule violations the validators found.
 *
 * Over-limit fields and banned terms need a rewrite, not a cut, so they go to a
 * fast, low-temperature call that sees each field with its exact limit and
 * reason. Every rewrite is re-checked in code; anything still wrong falls back
 * to the deterministic fixers (hardFit, removeBannedTerms), so the output is
 * always within limits even if the model ignores us.
 */

import type { TemplateId } from '../../../types';
import type { DraftSlide, Issue } from './types';
import { closeFragment, closeLabel, endsCleanly, hardFit, looksCut, SENTENCE_FIELDS } from './limits';
import { ask, languageRule } from './prompting';
import { fixAccent, maxFor, readPath, removeBannedTerms, scrubFactIds, writePath } from './validate';
import { isCancel } from '../../llm/cancel';

const TIGHTEN_SCHEMA = {
    type: 'object',
    properties: {
        fixes: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    options: { type: 'array', items: { type: 'string' } },
                    text: { type: 'string' },
                },
                required: ['id'],
            },
        },
    },
    required: ['fixes'],
};

interface Job { id: number; index: number; field: string; current: string; max?: number; banned: string[]; fragment?: boolean }

const hasTerm = (text: string, term: string) => {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'iu').test(text || '');
};

/**
 * Rewrites the fields named by over_limit/banned issues. Mutates drafts.
 * Returns how many fields the model fixed and how many needed the hard fallback.
 */
export const tightenDeck = async (
    drafts: DraftSlide[],
    templateId: TemplateId,
    issues: Issue[],
    opts: { banned: string[]; outputLanguage: string },
): Promise<{ rewritten: number; forced: number }> => {
    const wanted = issues.filter((i) => (i.code === 'over_limit' || i.code === 'banned' || i.code === 'fragment') && i.index >= 0 && i.field);
    if (!wanted.length) return { rewritten: 0, forced: 0 };

    // One job per (slide, field), merging limit + banned reasons.
    const jobs = new Map<string, Job>();
    for (const iss of wanted) {
        const key = `${iss.index}:${iss.field}`;
        const d = drafts[iss.index];
        if (!d) continue;
        const job = jobs.get(key) || { id: jobs.size + 1, index: iss.index, field: iss.field!, current: readPath(d, iss.field!), max: maxFor(d, templateId, iss.field!), banned: [] };
        if (iss.code === 'fragment') job.fragment = true;
        if (iss.code === 'banned') {
            const term = iss.message.match(/"([^"]+)"/)?.[1];
            if (term && !job.banned.includes(term)) job.banned.push(term);
        }
        jobs.set(key, job);
    }
    const list = Array.from(jobs.values()).filter((j) => j.current.trim());
    let rewritten = 0;

    // Rewrites that came back still too long: the best attempt so far, per job id.
    const closest = new Map<number, string>();
    const promptFor = (batch: Job[], second: boolean) => `${second
        ? 'These texts still break their rules. Cut each one down: drop a clause or a detail, keep the main point, and end on a complete phrase or sentence.'
        : 'Rewrite each text so it obeys its rule while keeping its meaning, voice and key specifics (names, numbers).'}

${batch.map((j) => {
        const text = closest.get(j.id) ?? j.current;
        const rules = [
            j.max ? `≤ ${j.max} characters, about ${Math.max(2, Math.floor(j.max / 6.5))} words (now ${text.length})` : '',
            j.banned.length ? `must not contain: ${j.banned.map((b) => `"${b}"`).join(', ')}` : '',
            j.fragment ? 'it stops mid-sentence: finish the thought or end it at the last complete point' : '',
        ].filter(Boolean).join('; ');
        return `[${j.id}] (slide ${j.index + 1}, ${j.field}) ${rules}\n${text}`;
    }).join('\n\n')}

For each text write 3 options, each clearly shorter than the one before; make the last one well under the limit.
Rules:
- Shorten by cutting filler words and choosing tighter words, not by dropping the point.
- Every option is complete on its own: a finished sentence, or a finished phrase for headlines, labels and list items. Never end on "and", "of", "vs.", "your", "sin" or an open quote.
- Keep list items in their "Key: value" form if they have one.
- ${languageRule(opts.outputLanguage)}

Return JSON: { "fixes": [ { "id": number, "options": [string, string, string] } ] }`;

    const fixed = new Set<number>();
    /** A candidate reads complete: sentences end cleanly, labels don't stop on a connector or an open quote. */
    const complete = (job: Job, text: string) => (SENTENCE_FIELDS.has(job.field) ? endsCleanly(text) : !looksCut(text));
    const round = async (batch: Job[], second: boolean) => {
        const r = await ask<{ fixes: { id: number; options?: string[]; text?: string }[] }>({ role: 'fast', label: second ? 'tighten.retry' : 'tighten', temperature: 0.2 }, promptFor(batch, second), TIGHTEN_SCHEMA);
        for (const fix of r.fixes || []) {
            const job = batch.find((j) => j.id === Number(fix.id));
            if (!job) continue;
            const candidates = [...(Array.isArray(fix.options) ? fix.options : []), fix.text]
                .map((t) => String(t ?? '').trim())
                .filter(Boolean)
                .filter((t) => !job.banned.some((b) => hasTerm(t, b)) && !opts.banned.some((b) => hasTerm(t, b)))
                // A "fix" that fits by chopping the text off is not a fix.
                .filter((t) => complete(job, t));
            if (!candidates.length) continue;
            // The longest option that fits keeps the most meaning.
            const fits = candidates.filter((t) => !job.max || t.length <= job.max).sort((a, b) => b.length - a.length);
            if (fits.length) {
                closest.delete(job.id);
                writePath(drafts[job.index], job.field, fits[0]);
                fixed.add(job.id);
                rewritten++;
                continue;
            }
            const shortest = candidates.sort((a, b) => a.length - b.length)[0];
            const prev = closest.get(job.id);
            if (!prev || shortest.length < prev.length) closest.set(job.id, shortest);
        }
    };

    if (list.length) {
        try {
            await round(list, false);
            // One more try for anything still unfixed (small models count poorly).
            const again = list.filter((j) => !fixed.has(j.id));
            if (again.length) await round(again, true);
        } catch (err) {
            if (isCancel(err)) throw err;
            console.warn('[v2.tighten] rewrite failed, using deterministic fallback:', err);
        }
    }
    // A too-long rewrite is still tighter than the original: fit that one.
    for (const job of list) {
        const best = closest.get(job.id);
        if (best && job.max && best.length < readPath(drafts[job.index], job.field).length) writePath(drafts[job.index], job.field, best);
    }

    // Deterministic guarantees for anything the model didn't fix.
    let forced = 0;
    for (const job of jobs.values()) {
        const d = drafts[job.index];
        const now = readPath(d, job.field);
        if (job.max && now.length > job.max) {
            writePath(d, job.field, hardFit(now, job.max, job.field));
            forced++;
        } else if (job.fragment && SENTENCE_FIELDS.has(job.field) && !endsCleanly(now)) {
            writePath(d, job.field, closeFragment(now));
            forced++;
        } else if (job.fragment && !SENTENCE_FIELDS.has(job.field) && looksCut(now)) {
            writePath(d, job.field, closeLabel(now));
            forced++;
        }
    }
    const touched = new Set(Array.from(jobs.values()).map((j) => j.index));
    for (const i of touched) {
        removeBannedTerms(drafts[i], opts.banned);
        fixAccent(drafts[i]);
    }
    return { rewritten, forced };
};

/** Final guarantee used after every stage that can change text: clamp every field to its limit. */
export const clampDeck = (drafts: DraftSlide[], templateId: TemplateId, only?: Set<number>): number => {
    let n = 0;
    drafts.forEach((d, i) => {
        // Edits pass `only` so untouched slides are never trimmed or re-accented.
        if (only && !only.has(i)) return;
        const paths = ['preHeader', 'headline', 'body', 'footer', 'statNumber', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight', ...(d.listItems || []).map((_, k) => `listItems[${k}]`)];
        for (const p of paths) {
            const max = maxFor(d, templateId, p);
            const v = readPath(d, p);
            if (max && v.length > max) {
                writePath(d, p, hardFit(v, max, p));
                n++;
            }
        }
        scrubFactIds(d);
        // Never ship a label, headline or list item that stops on a connector or an open quote.
        for (const p of ['headline', 'preHeader', 'footer', 'statLabel', ...(d.listItems || []).map((_, k) => `listItems[${k}]`)]) {
            const v = readPath(d, p);
            if (v && looksCut(v)) { writePath(d, p, closeLabel(v)); n++; }
        }
        // Never ship a body that stops mid-sentence.
        const body = (d.body || '').trim();
        if (body.length >= 25 && !endsCleanly(body)) {
            d.body = closeFragment(body);
            n++;
        }
        fixAccent(d);
    });
    return n;
};
