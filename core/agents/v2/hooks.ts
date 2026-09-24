/**
 * Hook tournament.
 *
 * The cover decides whether anyone swipes. Instead of writing it once, v2
 * drafts several hooks in different styles at a high temperature and scores
 * each against a rubric; code adds the scores up and picks the winner.
 *
 * By default one call writes and scores the hooks (the scores come after all
 * four are written, against the same rubric a separate judge used). Set
 * HOOK_JUDGE=separate to score them in a second low-temperature critic call.
 */

import type { HookChoice, Outline, PipelineContext } from './types';
import { specFor } from './limits';
import { ask, briefBlock, factsBlock, languageRule, memoryBlock, relevantFacts } from './prompting';
import { fixAccent } from './validate';
import { asText } from './slides';
import { isCancel } from '../../llm/cancel';

const CANDIDATES_SCHEMA = {
    type: 'object',
    properties: {
        hooks: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    style: { type: 'string' },
                    preHeader: { type: 'string' },
                    headline: { type: 'string' },
                    subline: { type: 'string' },
                    accentPhrase: { type: 'string' },
                    scores: {
                        type: 'object',
                        properties: {
                            specificity: { type: 'number' },
                            curiosity: { type: 'number' },
                            clarity: { type: 'number' },
                            audienceFit: { type: 'number' },
                            deliverable: { type: 'number' },
                        },
                    },
                },
                required: ['headline', 'subline'],
            },
        },
    },
    required: ['hooks'],
};

const JUDGE_SCHEMA = {
    type: 'object',
    properties: {
        scores: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'number' },
                    specificity: { type: 'number' },
                    curiosity: { type: 'number' },
                    clarity: { type: 'number' },
                    audienceFit: { type: 'number' },
                    deliverable: { type: 'number' },
                },
                required: ['index', 'specificity', 'curiosity', 'clarity', 'audienceFit', 'deliverable'],
            },
        },
        winner: { type: 'number' },
        reason: { type: 'string' },
    },
    required: ['scores', 'winner'],
};

const RUBRIC = ['specificity', 'curiosity', 'clarity', 'audienceFit', 'deliverable'] as const;
type Scores = Partial<Record<(typeof RUBRIC)[number], number>>;

interface Candidate { style?: string; preHeader?: string; headline: string; subline: string; accentPhrase?: string; scores?: Scores }

const RUBRIC_TEXT = `- specificity: concrete and particular, not generic
- curiosity: makes the reader want to swipe
- clarity: understood in one glance
- audienceFit: speaks to this audience in their language
- deliverable: the deck can fully pay off the promise, and every claim is true to FACTS (score 1-3 for anything overstated or not in FACTS)`;

const separateJudge = () => {
    try { return /^separate$/i.test((typeof process !== 'undefined' && process.env?.HOOK_JUDGE) || ''); } catch { return false; }
};

const clampScore = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
};

/** Best candidate by summed rubric score (ties → deliverable, then the model's order). */
const pickBest = (candidates: Candidate[]): { index: number; score: number } | null => {
    const totals = candidates
        .map((c, index) => ({
            index,
            scored: !!c.scores && RUBRIC.some((k) => Number.isFinite(Number(c.scores![k]))),
            total: RUBRIC.reduce((a, k) => a + clampScore(c.scores?.[k]), 0),
            deliverable: clampScore(c.scores?.deliverable),
        }))
        .filter((t) => t.scored);
    if (!totals.length) return null;
    totals.sort((a, b) => b.total - a.total || b.deliverable - a.deliverable || a.index - b.index);
    return { index: totals[0].index, score: totals[0].total / RUBRIC.length };
};

export const runHookTournament = async (ctx: PipelineContext, outline: Outline): Promise<HookChoice | null> => {
    const spec = specFor(ctx.templateId, 'hero');
    const hMax = spec.max.headline ?? 50;
    const sMax = spec.max.body ?? 150;
    const pMax = spec.max.preHeader ?? 60;
    const keepCase = 'sentence case';
    const viral = ctx.brief.contentStrategy?.approachMode === 'VIRAL_ANGLE';
    const judgeSeparately = separateJudge();
    // The facts the outline uses first: the cover should promise what the deck proves.
    const facts = relevantFacts(ctx.facts, outline.beats.flatMap((b) => b.factIds || []), [], 12);

    const genPrompt = `Write 4 different cover hooks for this carousel. Each is the first slide someone sees in their feed.

${briefBlock(ctx.brief, ctx.topic)}
${memoryBlock(ctx.memory)}
PREMISE: ${outline.premise}
WHAT THE DECK DELIVERS: ${outline.beats.slice(1, -1).map((b) => b.keyMessage).join(' / ')}
TAKEAWAY: ${outline.takeaway}
${factsBlock(facts)}

Use four DIFFERENT styles, one each: "specific-promise" (exactly what they get), "curiosity-gap" (an intriguing question or tension the deck resolves), "${viral ? 'contrarian' : 'surprising-fact'}" (${viral ? 'challenges a common belief' : 'leads with the most surprising fact, only if it is in FACTS'}), "${ctx.brief.contentType === 'STORYTELLING' ? 'story-opening' : 'direct-benefit'}".
Rules:
- headline ≤ ${hMax} characters, ${keepCase}, no clickbait the deck can't pay off, no emojis, no hashtags.
- subline ≤ ${sMax} characters: one line that sharpens the promise.
- preHeader ≤ ${pMax} characters: a short topic tag.
- accentPhrase: 1-3 words copied EXACTLY from the headline, the emotional pivot.
- On topic: the cover promises what the user asked for and the PREMISE delivers. Lead with a fact only if it is central to that; never with a side detail.
- True to the facts: a number or claim in the hook says exactly what FACTS says (same subject, scope, time frame, qualifiers). One person's result is not a promise to the reader. No hype labels like "shocking" or "insane".
- The hook must fit the audience and the voice above. ${languageRule(ctx.outputLanguage)}
${judgeSeparately ? '' : `
After writing all four, switch roles: be a tough, consistent editor and score each hook 1-10 on:
${RUBRIC_TEXT}
Score honestly. Most hooks are 5-7; give 9+ only to one you would bet on. Different hooks should get different scores.
`}
Return JSON: { "hooks": [ { "style", "preHeader", "headline", "subline", "accentPhrase"${judgeSeparately ? '' : ', "scores": { "specificity", "curiosity", "clarity", "audienceFit", "deliverable" }'} } ] }`;

    let candidates: Candidate[] = [];
    try {
        const r = await ask<{ hooks: Candidate[] }>({ role: 'creative', label: 'hooks.generate' }, genPrompt, CANDIDATES_SCHEMA);
        candidates = (r.hooks || [])
            .map((h: any) => ({
                style: asText(h?.style),
                preHeader: asText(h?.preHeader),
                headline: (asText(h?.headline) || '').trim(),
                subline: (asText(h?.subline) || '').trim(),
                accentPhrase: asText(h?.accentPhrase),
                scores: h?.scores && typeof h.scores === 'object' ? h.scores : undefined,
            }))
            .filter((h) => h.headline)
            .slice(0, 5);
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.hooks] generation failed:', err);
        return null;
    }
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return toChoice(candidates[0], 0, 1);

    if (!judgeSeparately) {
        const best = pickBest(candidates);
        if (best) return toChoice(candidates[best.index], best.score, candidates.length);
        // No usable scores: fall through to the separate judge.
    }

    const judgePrompt = `Score these cover hooks for a carousel. Be a tough, consistent editor.

AUDIENCE: ${ctx.brief.audience?.description}
PREMISE THE DECK DELIVERS: ${outline.premise}
${candidates.map((c, i) => `[${i}] (${c.style || 'hook'}) ${c.headline} / ${c.subline}`).join('\n')}

Score each 1-10 on:
${RUBRIC_TEXT}
Pick the winner by total score; break ties by deliverable.

Return JSON: { "scores": [ { "index", "specificity", "curiosity", "clarity", "audienceFit", "deliverable" } ], "winner": number, "reason": string }`;

    try {
        const j = await ask<any>({ role: 'critic', label: 'hooks.judge' }, judgePrompt, JUDGE_SCHEMA);
        const scored = candidates.map((c) => ({ ...c, scores: undefined as Scores | undefined }));
        for (const s of j.scores || []) {
            const i = Number(s?.index);
            if (Number.isInteger(i) && scored[i]) scored[i].scores = s;
        }
        // Prefer our own arithmetic over the judge's "winner" field; small models add wrong.
        const best = pickBest(scored);
        if (best) return toChoice(candidates[best.index], best.score, candidates.length);
        const w = Number(j.winner);
        return toChoice(candidates[Number.isInteger(w) && candidates[w] ? w : 0], 0, candidates.length);
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.hooks] judging failed, taking the first candidate:', err);
        return toChoice(candidates[0], 0, candidates.length);
    }
};

const toChoice = (c: Candidate, score: number, n: number): HookChoice => {
    const draft = { blockType: 'hero' as const, headline: c.headline.trim(), accentPhrase: c.accentPhrase };
    fixAccent(draft);
    return {
        preHeader: (c.preHeader || '').trim(),
        headline: draft.headline,
        subline: (c.subline || '').trim(),
        accentPhrase: draft.accentPhrase,
        score,
        candidates: n,
    };
};
