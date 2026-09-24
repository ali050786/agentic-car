/**
 * Eval scoring: deterministic checks (count, limits, accent, required fields,
 * duplicates, rich blocks as the renderer will see them, emoji) plus two
 * model judges: an absolute rubric per deck and a blind pairwise preference.
 */

import type { TemplateId } from '../types';
import type { DraftSlide } from '../core/agents/v2/types';
import { savedToDraft, dumpDraft } from '../core/agents/v2/slides';
import { validateDeck } from '../core/agents/v2/validate';
import { extractClaims } from '../core/agents/v2/grounding';
import { slideToLayout } from '../utils/slideMigration';
import { generateContentFromAgent } from '../services/aiService';
import type { GoldenCase } from './goldenSet';

export interface DeckChecks {
    slides: number;
    countOk: boolean;
    overLimit: number;
    missingRequired: number;
    accentInvalid: number;
    duplicates: number;
    emoji: number;
    richBlocks: number;
    richBlocksRendered: number;
    numericClaims: number;
    /** Bodies that stop mid-sentence. */
    fragments: number;
    avgHeadline: number;
}

export interface Judgement {
    hook: number;
    flow: number;
    specificity: number;
    clarity: number;
    audienceFit: number;
    accuracy: number;
    expectations: number;
    overall: number;
    notes: string;
}

export const toDrafts = (slides: any[]): DraftSlide[] => (slides || []).map((s) => savedToDraft(s));

export const checkDeck = (slides: any[], c: GoldenCase): DeckChecks => {
    const drafts = toDrafts(slides);
    const issues = validateDeck(drafts, c.template as TemplateId);
    const rendered = (slides || []).map((s) => {
        try { return slideToLayout(s).blockType; } catch { return 'body'; }
    });
    const rich = drafts.filter((d) => d.blockType === 'stat' || d.blockType === 'quote' || d.blockType === 'split').length;
    const text = drafts.map((d) => [d.headline, d.body, ...(d.listItems || []), d.statNumber, d.statLabel].join(' ')).join(' ');
    return {
        slides: drafts.length,
        countOk: drafts.length === c.slides,
        overLimit: issues.filter((i) => i.code === 'over_limit').length,
        missingRequired: issues.filter((i) => i.code === 'missing_field' && i.severity === 'block').length,
        accentInvalid: drafts.filter((d) => d.accentPhrase && !(d.headline || '').includes(d.accentPhrase)).length,
        duplicates: issues.filter((i) => i.code === 'duplicate').length,
        emoji: (text.match(/\p{Extended_Pictographic}/gu) || []).length,
        richBlocks: rich,
        richBlocksRendered: rendered.filter((b) => b === 'stat' || b === 'quote' || b === 'split').length,
        numericClaims: extractClaims(text).length,
        fragments: issues.filter((i) => i.code === 'fragment').length,
        avgHeadline: drafts.length ? Math.round(drafts.reduce((a, d) => a + (d.headline || '').length, 0) / drafts.length) : 0,
    };
};

const JUDGE_SCHEMA = {
    type: 'object',
    properties: {
        hook: { type: 'number' }, flow: { type: 'number' }, specificity: { type: 'number' }, clarity: { type: 'number' },
        audienceFit: { type: 'number' }, accuracy: { type: 'number' }, expectations: { type: 'number' }, overall: { type: 'number' },
        notes: { type: 'string' },
    },
    required: ['hook', 'flow', 'specificity', 'clarity', 'audienceFit', 'accuracy', 'expectations', 'overall'],
};

const deckText = (slides: any[]) => toDrafts(slides).map(dumpDraft).join('\n');

/** Absolute rubric, one deck at a time, no hint of which pipeline made it. */
/** What a deck's writer was given (fact sheet or research text), shown to the judge so sourced numbers aren't marked as invented. */
const evidenceBlock = (label: string, evidence?: string) =>
    evidence && evidence.trim()
        ? `${label} (research this deck was written from; a number or claim found here is sourced, not invented):\n${evidence.slice(0, 4000)}\n`
        : '';

const ACCURACY_RULE = 'accuracy (every claim is true to the SOURCE MATERIAL / EVIDENCE or is widely known; a number that appears in the evidence is sourced, not invented; score low for claims that contradict or twist the evidence, or that appear in neither and are not common knowledge)';

export const judgeDeck = async (slides: any[], c: GoldenCase, evidence?: string): Promise<Judgement> => {
    const prompt = `You are a senior social media editor grading a carousel. Be strict and consistent: 10 = exceptional, 7 = solid but forgettable, 5 = mediocre, 3 = poor.

REQUEST: ${c.topic}
AUDIENCE: ${c.brief.audience.description}
VOICE: ${c.brief.creativeStyle.toneDescription}
LANGUAGE: ${c.brief.outputLanguage || 'English'}
A GOOD DECK MUST: ${c.expectations}
${c.sourceContent ? `SOURCE MATERIAL (ground truth):\n${c.sourceContent.slice(0, 3000)}\n` : ''}${evidenceBlock('EVIDENCE', evidence)}
DECK:
${deckText(slides)}

Score 1-10: hook (cover makes you swipe), flow (logical, no repetition, strong ending), specificity (concrete vs generic), clarity (one idea per slide, readable at a glance), audienceFit, ${ACCURACY_RULE}, expectations (meets "A GOOD DECK MUST"), overall.
"notes": the two biggest problems, briefly.

Return JSON: { "hook", "flow", "specificity", "clarity", "audienceFit", "accuracy", "expectations", "overall", "notes" }`;
    const r = await generateContentFromAgent(prompt, JUDGE_SCHEMA, { role: 'critic', label: 'eval.judge', temperature: 0 });
    const n = (k: string) => Math.max(1, Math.min(10, Number(r?.[k]) || 1));
    return { hook: n('hook'), flow: n('flow'), specificity: n('specificity'), clarity: n('clarity'), audienceFit: n('audienceFit'), accuracy: n('accuracy'), expectations: n('expectations'), overall: n('overall'), notes: String(r?.notes || '') };
};

const PAIR_SCHEMA = {
    type: 'object',
    properties: { winner: { type: 'string', enum: ['A', 'B', 'tie'] }, reason: { type: 'string' } },
    required: ['winner', 'reason'],
};

/** Blind pairwise preference. Order is randomised by the caller; returns which side won. */
export const judgePair = async (a: any[], b: any[], c: GoldenCase, evidenceA?: string, evidenceB?: string): Promise<{ winner: 'A' | 'B' | 'tie'; reason: string }> => {
    const prompt = `Two carousels were written for the same request. Which one would you publish? Judge like the target reader and a strict editor: hook, specificity, flow, fit to the audience and the request, and ${ACCURACY_RULE}. Ignore length differences unless they hurt readability.

REQUEST: ${c.topic}
AUDIENCE: ${c.brief.audience.description}
A GOOD DECK MUST: ${c.expectations}
${c.sourceContent ? `SOURCE MATERIAL (ground truth):\n${c.sourceContent.slice(0, 3000)}\n` : ''}
=== CAROUSEL A ===
${evidenceBlock('EVIDENCE FOR A', evidenceA)}${deckText(a)}

=== CAROUSEL B ===
${evidenceBlock('EVIDENCE FOR B', evidenceB)}${deckText(b)}

Return JSON: { "winner": "A" | "B" | "tie", "reason": "one or two sentences" }`;
    const r = await generateContentFromAgent(prompt, PAIR_SCHEMA, { role: 'critic', label: 'eval.pairwise', temperature: 0 });
    const w = r?.winner === 'A' || r?.winner === 'B' ? r.winner : 'tie';
    return { winner: w, reason: String(r?.reason || '') };
};
