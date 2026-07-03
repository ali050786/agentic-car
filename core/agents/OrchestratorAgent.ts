/**
 * Orchestrator Agent - the brain behind the chat editor.
 *
 * One LLM call per user message. It reads the conversation memory, the
 * current slides and the user's message, classifies the intent, and either
 * executes it in the same call (copy edits, answers) or returns a structured
 * plan the client executes for free (design actions) or via Replicate
 * (image briefs). It also extracts durable preference notes for long-term
 * memory — no extra LLM calls anywhere.
 *
 * Intents:
 *  - copy:   rewrite slide text (returns changed slides)
 *  - design: template/palette/format/pattern/signature changes (no LLM cost to execute)
 *  - image:  regenerate a Template-3 doodle (returns a scene brief for flux)
 *  - answer: explain, discuss, advise — no changes to the artifact
 */

import { generateContentFromAgent } from '../../services/aiService';
import { ChatMessage, SlideContent } from '../../types';
import { TEMPLATE_CONFIGS } from './agentConfigs';
import { getPresetIds } from '../../config/colorPresets';

const ORCHESTRATOR_SCHEMA = {
    type: 'object',
    properties: {
        intent: { type: 'string', enum: ['copy', 'design', 'image', 'answer'] },
        reply: { type: 'string' },
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
                required: ['slideIndex']
            }
        },
        designActions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['set_template', 'set_format', 'set_preset', 'set_pattern', 'set_signature_position'] },
                    value: { type: 'string' }
                },
                required: ['action', 'value']
            }
        },
        imageBrief: { type: 'string' },
        imageSlideIndex: { type: 'number' },
        memoryNote: { type: 'string' }
    },
    required: ['intent', 'reply']
};

export interface DesignAction {
    action: 'set_template' | 'set_format' | 'set_preset' | 'set_pattern' | 'set_signature_position';
    value: string;
}

export interface OrchestratorResult {
    intent: 'copy' | 'design' | 'image' | 'answer';
    reply: string;
    slides: SlideContent[] | null;
    changedIndices: number[];
    designActions: DesignAction[];
    imageBrief: string | null;
    imageSlideIndex: number | null;
    memoryNote: string | null;
}

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
        [/clarity|clean|modern/, 'template-2'],
        [/truth|industrial|bold template/, 'template-1'],
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

export const OrchestratorAgent = {
    handle: async (params: {
        message: string;
        slides: SlideContent[];
        templateId: string;
        selectedSlideIndex: number | null;
        recentMessages: ChatMessage[];
        conversationSummary: string;
        userMemory: string[];
    }): Promise<OrchestratorResult> => {
        const { message, slides, templateId, selectedSlideIndex, recentMessages, conversationSummary, userMemory } = params;
        const config = TEMPLATE_CONFIGS[templateId] || TEMPLATE_CONFIGS['template-1'];

        const slideDump = slides.map((s, i) => {
            const fields = [
                `slideIndex: ${i} [${s.variant}]`,
                s.preHeader ? `preHeader: ${s.preHeader}` : '',
                `headline: ${s.headline}`,
                s.body ? `body: ${s.body}` : '',
                s.listItems && s.listItems.length ? `listItems: ${JSON.stringify(s.listItems)}` : '',
                s.footer ? `footer: ${s.footer}` : '',
            ].filter(Boolean).join(' | ');
            return `${fields}${selectedSlideIndex === i ? '   <<< USER HAS THIS SLIDE SELECTED' : ''}`;
        }).join('\n');

        const history = recentMessages
            .slice(-10)
            .map(m => `${m.role === 'user' ? 'User' : 'You'}: ${(m.text || '').slice(0, 300)}`)
            .join('\n');

        const prompt = `
      You are the AI partner inside a carousel design studio. The user is editing a LinkedIn
      carousel with you. You are ${config.persona} ("${config.styleName}" template).

      ${userMemory.length ? `KNOWN USER PREFERENCES (from past sessions):\n${userMemory.map(n => `- ${n}`).join('\n')}\n` : ''}
      ${conversationSummary ? `CONVERSATION MEMORY (earlier in this project):\n${conversationSummary}\n` : ''}
      RECENT CONVERSATION:
      ${history || '(none yet)'}

      CURRENT SLIDES (template: ${config.styleName}):
      ${slideDump}

      USER'S NEW MESSAGE:
      """
      ${message}
      """

      Classify the intent and respond:

      1. intent "copy" — the user wants text changed (rewrite, shorten, new angle, different tone...).
         Return "slides": ONLY the slides you changed, with only the text fields you changed.
         ${selectedSlideIndex !== null ? `The user has slide ${selectedSlideIndex} selected — scope copy changes to it unless they clearly mean otherwise.` : ''}
         Respect the template limits: hero: ${config.variantRequirements.hero} | body: ${config.variantRequirements.body} | list: ${config.variantRequirements.list} | closing: ${config.variantRequirements.closing}
         ${templateId === 'template-4' ? 'Headlines are sentence case. Always include an accentPhrase that is an exact substring of the new headline.' : ''}

      2. intent "design" — the user wants a visual/setting change, not text. Return "designActions":
         - set_template: ${Object.keys(TEMPLATE_CONFIGS).join(', ')} (The Truth=template-1, The Clarity=template-2, The Sketch=template-3, The Statement=template-4)
         - set_format: portrait, square
         - set_preset (color palette): ${getPresetIds().join(', ')}
         - set_pattern: 1-12
         - set_signature_position: bottom-left, top-left, top-right

      3. intent "image" — ONLY if template is template-3 (The Sketch) and the user wants a slide's
         sketch image changed. Return "imageBrief" (a witty doodle scene, 25-60 words, labeled
         elements in quotes) and "imageSlideIndex". If the template is not The Sketch, treat as "answer"
         and explain images are part of The Sketch template.

      4. intent "answer" — questions, discussion, advice. Change nothing.

      ALWAYS:
      - "reply": one or two short, friendly sentences for the chat (what you did or your answer).
      - "memoryNote": if this message reveals a DURABLE preference worth remembering across future
        carousels (tone, style, brand voice, pet peeves), state it in one short sentence. Otherwise omit.

      Return JSON matching the schema exactly.
    `;

        console.log('🧭 [Orchestrator] Routing message...');
        const result = await generateContentFromAgent(prompt, ORCHESTRATOR_SCHEMA);

        const intent = ['copy', 'design', 'image', 'answer'].includes(result?.intent) ? result.intent : 'answer';
        const out: OrchestratorResult = {
            intent,
            reply: typeof result?.reply === 'string' && result.reply.trim() ? result.reply.trim() : 'Done.',
            slides: null,
            changedIndices: [],
            designActions: [],
            imageBrief: null,
            imageSlideIndex: null,
            memoryNote: typeof result?.memoryNote === 'string' && result.memoryNote.trim() ? result.memoryNote.trim() : null,
        };

        if (intent === 'copy' && Array.isArray(result.slides)) {
            const updated = [...slides];
            for (const entry of result.slides) {
                const i = entry.slideIndex;
                if (typeof i !== 'number' || i < 0 || i >= slides.length) continue;
                const original = slides[i];
                const keepCase = templateId === 'template-4';
                updated[i] = {
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
                out.changedIndices.push(i);
            }
            if (out.changedIndices.length > 0) out.slides = updated;
        }

        if (intent === 'design') {
            out.designActions = Array.isArray(result.designActions)
                ? result.designActions.filter((a: any) => a && typeof a.action === 'string' && typeof a.value === 'string')
                : [];
            if (out.designActions.length === 0) {
                out.designActions = parseDesignActionsFallback(message);
                if (out.designActions.length > 0) {
                    console.log('[Orchestrator] Model omitted designActions — recovered from keywords:', out.designActions);
                }
            }
        }

        if (intent === 'image') {
            out.imageBrief = typeof result.imageBrief === 'string' ? result.imageBrief : null;
            out.imageSlideIndex = typeof result.imageSlideIndex === 'number' ? result.imageSlideIndex : (selectedSlideIndex ?? 0);
        }

        // Safety net: small models sometimes agree to a design change in prose but
        // return intent "answer" with no payload. If the user's message is clearly
        // an imperative design command, execute it deterministically.
        const nothingExecuted = !out.slides && out.designActions.length === 0 && !out.imageBrief;
        if (nothingExecuted && !/\?\s*$/.test(message.trim())
            && /\b(switch|change|set|apply|convert|make (it|this)|use)\b/i.test(message)) {
            const fallback = parseDesignActionsFallback(message);
            if (fallback.length > 0) {
                out.intent = 'design';
                out.designActions = fallback;
                console.log('[Orchestrator] Recovered design actions from imperative message:', fallback);
            }
        }

        console.log(`[Orchestrator] intent=${out.intent}, actions=${out.designActions.length}, slides=${out.changedIndices.length}`);
        return out;
    }
};
