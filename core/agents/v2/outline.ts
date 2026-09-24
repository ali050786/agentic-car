/**
 * Outline: the deck's structure before any copy is written.
 *
 * v1 asked the Strategist for three fields (premise, audience, takeaway) and
 * left the Writer to invent structure and copy for N slides in one shot, which
 * is where count drift, repetition and weak arcs came from. The outline plans
 * each slide's job, layout block and supporting facts; the writer then only
 * has to execute it. Count, block rules and hero/closing positions are then
 * enforced in code.
 */

import type { TemplateId } from '../../../types';
import type { BlockKind, Fact, Outline, OutlineBeat, PipelineContext } from './types';
import { allowedBlocks } from './limits';
import { ask, briefBlock, factsBlock, memoryBlock, untrusted } from './prompting';
import { asList, asText } from './slides';
import { isExplainer } from './research';
import { isCancel } from '../../llm/cancel';

const OUTLINE_SCHEMA = {
    type: 'object',
    properties: {
        premise: { type: 'string' },
        takeaway: { type: 'string' },
        beats: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    blockType: { type: 'string', enum: ['hero', 'body', 'list', 'stat', 'quote', 'split', 'closing'] },
                    purpose: { type: 'string' },
                    keyMessage: { type: 'string' },
                    factIds: { type: 'array', items: { type: 'string' } },
                },
                required: ['blockType', 'keyMessage'],
            },
        },
    },
    required: ['premise', 'takeaway', 'beats'],
};

const APPROACH_GUIDE: Record<string, string> = {
    FACTUAL_SPINE: 'Order facts for curiosity: a hook, then the essential facts in a logical sequence, then what it means.',
    NARRATIVE_ARC: 'A story: setup (who/what), tension (the problem), turning point, resolution (the lesson).',
    HOW_TO_STEPS: 'One actionable step per middle slide, in the order someone would do them.',
    VIRAL_ANGLE: 'A sharp, specific, counter-intuitive angle; each slide raises the stakes or pays off the hook.',
};

const hasNumber = (t: string) => /\d/.test(t);
const looksLikeQuote = (t: string) => /["“”]|\bsaid\b|\bsays\b|\baccording to\b/i.test(t);

/** Code-enforced outline rules. Mutates and returns beats. */
export const enforceOutline = (beats: OutlineBeat[], count: number, templateId: TemplateId, facts: Fact[]): OutlineBeat[] => {
    const allowed = new Set(allowedBlocks(templateId));
    const factById = new Map(facts.map((f) => [f.id, f]));
    let out = beats.filter((b) => b && (b.keyMessage || '').trim());

    // Count: trim middle beats from the end, or pad with explicit "expand" beats.
    if (out.length > count) {
        const hero = out[0];
        const closing = out[out.length - 1];
        out = [hero, ...out.slice(1, -1).slice(0, Math.max(0, count - 2)), closing].slice(0, count);
    }
    if (out.length === 0) out.push({ blockType: 'hero', purpose: 'Cover', keyMessage: 'Introduce the subject and promise exactly what the reader will learn', factIds: [] });
    if (out.length === 1 && count > 1) out.push({ blockType: 'closing', purpose: 'Close', keyMessage: 'Sum up the single takeaway and give one clear next step', factIds: [] });
    while (out.length < count) {
        const insertAt = Math.max(1, out.length - 1);
        const prev = out[insertAt - 1];
        out.splice(insertAt, 0, {
            blockType: 'body',
            purpose: 'Deepen the previous point with a concrete example or implication',
            keyMessage: prev ? `A concrete example of: ${prev.keyMessage}` : 'A concrete example that makes the idea tangible',
            factIds: [],
        });
    }

    // Each fact belongs to one beat: the same fact on two slides reads as repetition.
    const used = new Set<string>();
    out.forEach((b, i) => {
        b.factIds = (b.factIds || []).map((x) => String(x).trim().toUpperCase()).filter((x) => factById.has(x) && !used.has(x));
        b.factIds = Array.from(new Set(b.factIds));
        b.factIds.forEach((x) => used.add(x));
        let t = (b.blockType || 'body') as BlockKind;
        if (!allowed.has(t)) t = 'body';
        // Rich blocks must be earned by real material, or they invite fabrication.
        if (t === 'stat' && !b.factIds.some((id) => hasNumber(factById.get(id)!.text))) t = 'body';
        if (t === 'quote' && !b.factIds.some((id) => looksLikeQuote(factById.get(id)!.text))) t = 'body';
        if (i === 0) t = 'hero';
        else if (i === out.length - 1 && out.length > 1) t = 'closing';
        else if (t === 'hero' || t === 'closing') t = 'body';
        b.blockType = t;
    });

    // Variety: never three identical middle blocks in a row.
    for (let i = 3; i < out.length - 1; i++) {
        if (out[i].blockType === out[i - 1].blockType && out[i - 1].blockType === out[i - 2].blockType && out[i].blockType === 'list') {
            out[i].blockType = 'body';
        }
    }
    return out;
};

export const buildOutline = async (ctx: PipelineContext): Promise<Outline> => {
    const { brief, templateId, slideCount, facts } = ctx;
    const blocks = allowedBlocks(templateId);
    const approach = brief.contentStrategy?.approachMode || 'FACTUAL_SPINE';

    const prompt = `You are the editor planning a ${slideCount}-slide social carousel. Plan the structure only; the copy is written later.

${briefBlock(brief, ctx.topic)}
${untrusted('user_request', ctx.topic, 1500)}
${memoryBlock(ctx.memory)}
${ctx.customInstructions ? `USER INSTRUCTIONS: ${ctx.customInstructions}` : ''}
${ctx.sourceContent ? untrusted('source_excerpt', ctx.sourceContent, 5000) : ''}

${factsBlock(facts)}

STRUCTURE: ${APPROACH_GUIDE[approach] || APPROACH_GUIDE.FACTUAL_SPINE}

Plan EXACTLY ${slideCount} beats:
- Beat 1 is "hero" (the cover: what the reader gets). The last beat is "closing" (takeaway + next step).
- Middle beats use these layout blocks: ${blocks.filter((b) => b !== 'hero' && b !== 'closing').join(', ')}.
  body = one idea explained; list = 3 parallel items; stat = one striking number (ONLY with a fact id that contains that number);
  quote = a real quote (ONLY with a fact id that contains the quote and speaker)${blocks.includes('split') ? '; split = a contrast (myth vs fact, before vs after)' : ''}.
- Deliver what the user_request literally asks for: its time frame, format and scope (a request for a 2-week plan gets concrete days or weeks, a request for types gets the types, a fact-check gets a clear verdict).
${isExplainer(ctx.topic) ? `- This is an explainer: the middle beats walk through how it works, in order, one step or component per slide (inputs → what happens → result), using concrete examples. No history, rankings, costs or statistics unless the request asks for them.\n` : ''}- The request decides the story; FACTS only support it. Use a fact only where it serves the request, leave off-topic facts out even if they are striking, and never bend a beat toward whatever the research happened to find.
- Every beat must earn the next swipe. No two beats may make the same point.
- Put each fact id you rely on in factIds, and use each fact id on ONE beat only. Never plan a number that isn't in the facts.
- premise: the specific angle of the whole deck in one sentence. takeaway: what the reader should think, feel or do at the end.

Return JSON: { "premise": string, "takeaway": string, "beats": [ { "blockType", "purpose", "keyMessage", "factIds": string[] } ] }`;

    let raw: Outline | null = null;
    try {
        raw = await ask<Outline>({ role: 'planner', label: 'outline' }, prompt, OUTLINE_SCHEMA);
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.outline] failed, using a skeleton outline:', err);
    }

    const beats = enforceOutline((raw?.beats || []).map((b: any) => ({
        blockType: asText(b?.blockType) as OutlineBeat['blockType'],
        keyMessage: asText(b?.keyMessage) || '',
        purpose: asText(b?.purpose) || '',
        factIds: asList(b?.factIds) || [],
    })), slideCount, templateId, facts);
    return {
        premise: (asText(raw?.premise) || ctx.brief.topic || ctx.topic).trim(),
        takeaway: (asText(raw?.takeaway) || '').trim(),
        beats,
    };
};
