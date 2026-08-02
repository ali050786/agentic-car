/**
 * Shared edit-guardrails — extracted from OrchestratorAgent so the unified
 * CarouselPlanner (and the edit-parity eval) can reuse the exact same
 * deterministic protections that keep the weak model (`deepseek-v4-flash`)
 * honest on edits:
 *
 *  - parseDesignActionsFallback: recover design intents from the user's words
 *    when the model announces a change but forgets to fill designActions.
 *  - applySlidePatches: merge text-field patches (1-based slideIndex → 0-based),
 *    recording a change ONLY when a field actually differs.
 *  - forcedCopyEdit: focused single-purpose rewrite — small models handle this
 *    far more reliably than the multi-intent schema.
 *  - applyStructureOps: add/remove slides with hero/closing + min/max guards.
 *  - messageHeuristics + HONESTY_GUARD_REPLY: the "did the command actually
 *    execute?" policy that never surfaces a fabricated "done!".
 *
 * These are MOVED here (not duplicated); OrchestratorAgent now imports them, so
 * its behavior is unchanged and the eval can compare old vs new fairly.
 */

import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent } from '../../types';
import { TEMPLATE_CONFIGS } from './agentConfigs';
import { getPresetIds } from '../../config/colorPresets';

export interface DesignAction {
    action: 'set_template' | 'set_format' | 'set_preset' | 'set_pattern' | 'set_signature_position';
    value: string;
}

export interface StructureOp {
    op: 'insert' | 'append' | 'remove';
    afterIndex?: number;  // For insert: slide appears after this index (-1 = prepend)
    removeIndex?: number; // For remove: index of slide to delete
    slideData?: {         // For insert/append: new slide content
        variant: 'body' | 'list';
        preHeader?: string;
        headline: string;
        body?: string;
        listItems?: string[];
        footer?: string;
        accentPhrase?: string;
    };
}

export const COPY_COMMAND_RE = /\b(rewrite|re-write|rephrase|reword|punch(y|ier)|catchier|snappier|shorter|longer|simplify|spicier|bolder|tone|hook|conversational|make (it|this|them|the)|change the (text|copy|wording|content|headline)|improve)\b/i;

/**
 * Deterministic fallback: small models sometimes announce a design change in
 * "reply" but forget to fill designActions. Parse the obvious cases from the
 * user's own words so design intents always execute.
 */
export const parseDesignActionsFallback = (message: string): DesignAction[] => {
    const m = message.toLowerCase();
    const actions: DesignAction[] = [];

    const templateMap: [RegExp, string][] = [
        [/sketch|hand.?drawn|doodle/, 'template-3'],
        [/statement|typographic/, 'template-4'],
        [/truth|industrial|bold template|clean|modern/, 'template-1'],
    ];
    if (/template|style|look/.test(m) || templateMap.some(([re]) => re.test(m))) {
        for (const [re, id] of templateMap) {
            if (re.test(m)) { actions.push({ action: 'set_template', value: id }); break; }
        }
    }

    if (/\bsquare\b|1:1/.test(m)) actions.push({ action: 'set_format', value: 'square' });
    else if (/\bportrait\b|4:5|vertical/.test(m)) actions.push({ action: 'set_format', value: 'portrait' });

    for (const id of getPresetIds()) {
        const name = id.replace(/-/g, ' ');
        if (m.includes(name) || m.includes(id)) { actions.push({ action: 'set_preset', value: id }); break; }
    }

    const sig = m.match(/signature.*(bottom.?left|top.?left|top.?right)|(bottom.?left|top.?left|top.?right).*signature/);
    if (sig) {
        const pos = (sig[1] || sig[2] || '').replace(/\s/g, '-');
        if (pos) actions.push({ action: 'set_signature_position', value: pos });
    }

    return actions;
};

/**
 * Merges text-field patches from the model into the slide array, preserving
 * ids, variants and visual assets. slideIndex is 1-based (matches the UI badge).
 */
export const applySlidePatches = (
    slides: SlideContent[],
    entries: any[],
    templateId: string,
    targetIndex: number | null = null
): { slides: SlideContent[] | null; changedIndices: number[] } => {
    const updated = [...slides];
    const changedIndices: number[] = [];
    const keepCase = templateId === 'template-4';

    entries.forEach((entry, pos) => {
        // The model sees slides numbered 1..N (matching the "slide N" UI badge),
        // so a returned slideIndex is 1-BASED — convert to a 0-based array index.
        // Fall back to the scoped slide (single-entry edit) or the array position.
        const rawIndex = entry?.slideIndex;
        let i = (typeof rawIndex === 'number' && Number.isFinite(rawIndex)) ? Math.round(rawIndex) - 1 : NaN;
        if (!Number.isInteger(i) || i < 0 || i >= slides.length) {
            if (targetIndex !== null && entries.length === 1) i = targetIndex;
            else if (pos < slides.length) i = pos;
            else return;
        }
        const original = slides[i];
        const next = {
            ...original,
            preHeader: entry.preHeader !== undefined ? String(entry.preHeader).toUpperCase() : original.preHeader,
            headline: entry.headline !== undefined
                ? (keepCase ? String(entry.headline) : String(entry.headline).toUpperCase())
                : original.headline,
            body: entry.body !== undefined ? String(entry.body) : original.body,
            listItems: Array.isArray(entry.listItems) ? entry.listItems : original.listItems,
            footer: entry.footer !== undefined ? String(entry.footer) : original.footer,
            accentPhrase: entry.accentPhrase !== undefined ? String(entry.accentPhrase) : original.accentPhrase,
        };
        // Verify a field ACTUALLY changed before recording success — a model that
        // echoes identical text, or targets the wrong field, must not be reported
        // as an edit.
        const changed =
            next.preHeader !== original.preHeader ||
            next.headline !== original.headline ||
            next.body !== original.body ||
            next.footer !== original.footer ||
            next.accentPhrase !== original.accentPhrase ||
            JSON.stringify(next.listItems) !== JSON.stringify(original.listItems);
        if (!changed) return;
        updated[i] = next;
        changedIndices.push(i);
    });
    return { slides: changedIndices.length > 0 ? updated : null, changedIndices };
};

const FORCED_COPY_SCHEMA = {
    type: 'object',
    properties: {
        slides: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    slideIndex: { type: 'number' },
                    preHeader: { type: 'string' },
                    headline: { type: 'string' },
                    body: { type: 'string' },
                    listItems: { type: 'array', items: { type: 'string' } },
                    footer: { type: 'string' },
                    accentPhrase: { type: 'string' }
                },
                required: ['slideIndex', 'headline']
            }
        },
        summary: { type: 'string' }
    },
    required: ['slides', 'summary']
};

/**
 * Focused single-purpose rewrite call. Small models handle this far more
 * reliably than the multi-intent schema, so it's the fallback when a clear
 * rewrite command produced no slides.
 */
export const forcedCopyEdit = async (
    slides: SlideContent[],
    instruction: string,
    templateId: string,
    targetIndex: number | null
): Promise<{ slides: any[]; summary: string }> => {
    const config = TEMPLATE_CONFIGS[templateId] || TEMPLATE_CONFIGS['template-1'];

    const slideDump = slides.map((s, i) => {
        return [
            `Slide ${i + 1} (slideIndex: ${i + 1}) [${s.variant}]`,
            s.preHeader ? `preHeader: ${s.preHeader}` : '',
            `headline: ${s.headline}`,
            s.body ? `body: ${s.body}` : '',
            s.listItems && s.listItems.length ? `listItems: ${JSON.stringify(s.listItems)}` : '',
            s.footer ? `footer: ${s.footer}` : '',
        ].filter(Boolean).join(' | ');
    }).join('\n');

    const scope = targetIndex !== null
        ? `Rewrite ONLY slide ${targetIndex + 1} and return only that slide (set its "slideIndex" to ${targetIndex + 1}).`
        : `Rewrite EVERY slide and return ALL ${slides.length} slides in "slides".`;

    const prompt = `
      You are ${config.persona} rewriting an existing "${config.styleName}" carousel.

      CURRENT SLIDES:
      ${slideDump}

      REWRITE INSTRUCTION:
      """
      ${instruction}
      """

      ${scope}
      Rules:
      - "slideIndex" is the 1-based slide number shown above (Slide 1 = slideIndex 1, Slide 2 = slideIndex 2, ...).
      - Keep each slide's variant and role in the narrative; rewrite the text fields.
      - Copy limits — hero: ${config.variantRequirements.hero} | body: ${config.variantRequirements.body} | list: ${config.variantRequirements.list} | closing: ${config.variantRequirements.closing}
      ${templateId === 'template-4' ? '- Headlines stay sentence case. Include an accentPhrase that is an exact substring of each new headline.' : ''}
      - "summary": one short sentence describing the rewrite.

      Return JSON: { "slides": [...], "summary": "..." }
    `;

    console.log('✍️ [guards] Forced copy edit (fallback)...');
    const result = await generateContentFromAgent(prompt, FORCED_COPY_SCHEMA);
    return {
        slides: Array.isArray(result?.slides) ? result.slides : [],
        summary: typeof result?.summary === 'string' ? result.summary : 'Rewrote the slides.'
    };
};

/**
 * Add/remove slides with hero-first / closing-last protection and min/max
 * guards. Returns null when nothing changed.
 */
export function applyStructureOps(
    slides: SlideContent[],
    ops: StructureOp[],
    templateId: string
): SlideContent[] | null {
    const config = TEMPLATE_CONFIGS[templateId] || TEMPLATE_CONFIGS['template-1'];
    const keepCase = templateId === 'template-4';
    let result = [...slides];
    const MIN_SLIDES = 2;
    const MAX_SLIDES = 20;

    for (const op of ops) {
        if (op.op === 'remove') {
            // removeIndex is the 1-based slide number the user sees → 0-based array index.
            const idx = typeof op.removeIndex === 'number' && Number.isFinite(op.removeIndex)
                ? Math.round(op.removeIndex) - 1
                : NaN;
            if (!Number.isInteger(idx)) continue;
            // Never remove the hero (first) or closing (last) slide
            if (idx <= 0 || idx >= result.length - 1) continue;
            // Hard guard: don't go below minimum
            if (result.length - 1 < MIN_SLIDES) {
                console.warn(`[guards] Remove blocked — would leave ${result.length - 1} slides (min is ${MIN_SLIDES})`);
                continue;
            }
            result = result.filter((_, i) => i !== idx);

        } else if (op.op === 'insert' || op.op === 'append') {
            if (!op.slideData) continue;
            // Hard guard: don't exceed maximum
            if (result.length >= MAX_SLIDES) {
                console.warn(`[guards] Insert blocked — already at max ${MAX_SLIDES} slides`);
                continue;
            }
            const s = op.slideData;
            const newSlide: SlideContent = {
                id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                variant: s.variant || 'body',
                preHeader: s.preHeader ? s.preHeader.toUpperCase() : '',
                headline: keepCase ? (s.headline || '') : (s.headline || '').toUpperCase(),
                body: s.body || '',
                listItems: s.listItems || [],
                footer: s.footer || '',
                accentPhrase: s.accentPhrase || undefined,
                icon: config.defaultIcon,
            };

            if (op.op === 'append') {
                // Insert before the closing slide (last slide)
                result = [
                    ...result.slice(0, result.length - 1),
                    newSlide,
                    result[result.length - 1],
                ];
            } else {
                // afterIndex is the 1-based slide number to insert AFTER (0 = at the
                // very start, right after the hero). Convert to a 0-based index.
                const after = typeof op.afterIndex === 'number' && Number.isFinite(op.afterIndex)
                    ? Math.round(op.afterIndex) - 1
                    : result.length - 2;
                // Clamp: never insert before index 1 (hero must stay first)
                const insertAt = Math.max(1, after + 1);
                // Never insert at the very end (closing must stay last)
                const safeInsertAt = Math.min(insertAt, result.length - 1);
                result = [
                    ...result.slice(0, safeInsertAt),
                    newSlide,
                    ...result.slice(safeInsertAt),
                ];
            }
        }
    }

    return result.length !== slides.length || JSON.stringify(result) !== JSON.stringify(slides)
        ? result
        : null;
}

/** The standard reply when a command produced no executable change. */
export const HONESTY_GUARD_REPLY =
    "I couldn't apply that change — nothing was modified. This usually means the model was rate-limited or returned an incomplete response. Try again in a moment, or select a specific slide to make the request smaller.";

export interface MessageHeuristics {
    isQuestion: boolean;
    isDesignCommand: boolean;
    isCopyCommand: boolean;
    looksImperative: boolean;
    looksStructural: boolean;
}

/**
 * Cheap lexical read of the user's message, used by the recovery/honesty
 * policy to decide whether a command was expected to change the deck.
 */
export const messageHeuristics = (message: string): MessageHeuristics => {
    const isQuestion = /\?\s*$/.test(message.trim());
    return {
        isQuestion,
        isDesignCommand: !isQuestion && /\b(switch|change|set|apply|convert|make (it|this)|use)\b/i.test(message),
        isCopyCommand: !isQuestion && COPY_COMMAND_RE.test(message),
        looksImperative: !isQuestion && /\b(rewrite|edit|change|update|fix|improve|redo|revise|adjust|tweak|replace|shorten|expand|make|turn|give)\b/i.test(message),
        looksStructural: /\b(add|insert|remove|delete|append|prepend|new slide|extra slide)\b/i.test(message),
    };
};
