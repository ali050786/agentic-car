/**
 * Chat Refine Agent
 *
 * Powers conversational editing in the chat-driven editor. Takes the current
 * slides plus a user instruction (optionally scoped to one slide) and returns
 * updated slide copy. Only text fields are overwritten — visual assets
 * (icons, doodles, ids, variants) are preserved from the originals.
 */

import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent } from '../../types';
import { TEMPLATE_CONFIGS } from './agentConfigs';

const REFINE_SCHEMA = {
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

export interface RefineResult {
    slides: SlideContent[];
    changedIndices: number[];
    summary: string;
}

export const ChatRefineAgent = {
    /**
     * Applies a conversational instruction to the carousel.
     * @param targetIndex when set, the instruction is scoped to that slide only
     */
    refine: async (
        slides: SlideContent[],
        instruction: string,
        templateId: string,
        targetIndex: number | null
    ): Promise<RefineResult> => {
        const config = TEMPLATE_CONFIGS[templateId] || TEMPLATE_CONFIGS['template-1'];

        const slideDump = slides
            .map((s, i) => {
                const fields = [
                    `slideIndex: ${i}`,
                    `variant: ${s.variant}`,
                    s.preHeader ? `preHeader: ${s.preHeader}` : '',
                    `headline: ${s.headline}`,
                    s.body ? `body: ${s.body}` : '',
                    s.listItems && s.listItems.length ? `listItems: ${JSON.stringify(s.listItems)}` : '',
                    s.footer ? `footer: ${s.footer}` : '',
                    s.accentPhrase ? `accentPhrase: ${s.accentPhrase}` : ''
                ].filter(Boolean);
                return `--- Slide ${i}${targetIndex === i ? '  <<< USER IS EDITING THIS SLIDE' : ''}\n${fields.join('\n')}`;
            })
            .join('\n');

        const scopeRule = targetIndex !== null
            ? `The user has slide ${targetIndex} selected. Apply the instruction to slide ${targetIndex} ONLY and return ONLY that slide.`
            : `Apply the instruction to whichever slides it concerns. Return ONLY the slides you changed — do not return untouched slides.`;

        const prompt = `
      You are ${config.persona}, editing an existing LinkedIn carousel in the "${config.styleName}" style.

      CURRENT SLIDES:
      ${slideDump}

      USER INSTRUCTION:
      """
      ${instruction}
      """

      RULES:
      - ${scopeRule}
      - Respect the template's copy limits:
        hero: ${config.variantRequirements.hero}
        body: ${config.variantRequirements.body}
        list: ${config.variantRequirements.list}
        closing: ${config.variantRequirements.closing}
      - Keep each slide's variant and role in the narrative. Only rewrite the text fields.
      - ${templateId === 'template-4' ? 'Headlines stay sentence case. Always return an accentPhrase that is an exact substring of the new headline.' : 'Keep the existing tone of voice unless the instruction says otherwise.'}
      - "summary" is one short, friendly sentence describing what you changed (e.g. "Tightened slide 3's headline and made the body more direct.").

      Return JSON: { "slides": [ { "slideIndex": n, ...changed text fields... } ], "summary": "..." }
    `;

        console.log(`💬 [ChatRefineAgent] Refining (scope: ${targetIndex !== null ? `slide ${targetIndex}` : 'whole carousel'})...`);
        const result = await generateContentFromAgent(prompt, REFINE_SCHEMA);

        const entries: any[] = Array.isArray(result?.slides) ? result.slides : [];
        if (entries.length === 0) {
            throw new Error('The editor returned no changes. Try rephrasing your instruction.');
        }

        const updated = [...slides];
        const changedIndices: number[] = [];

        for (const entry of entries) {
            const i = entry.slideIndex;
            if (typeof i !== 'number' || i < 0 || i >= slides.length) continue;
            if (targetIndex !== null && i !== targetIndex) continue;

            const original = slides[i];
            updated[i] = {
                ...original,
                preHeader: entry.preHeader !== undefined ? String(entry.preHeader).toUpperCase() : original.preHeader,
                headline: entry.headline !== undefined
                    ? (templateId === 'template-4' ? String(entry.headline) : String(entry.headline).toUpperCase())
                    : original.headline,
                body: entry.body !== undefined ? String(entry.body) : original.body,
                listItems: Array.isArray(entry.listItems) ? entry.listItems : original.listItems,
                footer: entry.footer !== undefined ? String(entry.footer) : original.footer,
                accentPhrase: entry.accentPhrase !== undefined ? String(entry.accentPhrase) : original.accentPhrase
            };
            changedIndices.push(i);
        }

        if (changedIndices.length === 0) {
            throw new Error('The editor returned changes for slides that do not exist.');
        }

        return {
            slides: updated,
            changedIndices,
            summary: typeof result.summary === 'string' && result.summary.trim()
                ? result.summary.trim()
                : `Updated slide${changedIndices.length > 1 ? 's' : ''} ${changedIndices.map(i => i + 1).join(', ')}.`
        };
    }
};
