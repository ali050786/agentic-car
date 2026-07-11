/**
 * Automatic proofreading pass — fixes grammar, spelling, and punctuation
 * that the deterministic contentPolish cleanup can't catch, without
 * touching meaning, tone, or structure. Runs on every generation and edit;
 * never blocks or breaks the carousel if it fails.
 *
 * Only preHeader/headline/body/footer are sent — listItems round-trip
 * through an LLM call awkwardly (mixed string | {bullet, description}
 * shapes) for little extra value over the deterministic pass, so they're
 * left to contentPolish alone.
 */

import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent, CreativeBrief } from '../../types';


const PROOFREAD_SCHEMA = {
    type: 'object',
    properties: {
        slides: {
            type: 'array',
            description: 'The corrected slides, in the same order, one entry per input slide.',
            items: {
                type: 'object',
                properties: {
                    preHeader: { type: 'string' },
                    headline: { type: 'string' },
                    body: { type: 'string' },
                    footer: { type: 'string' },
                },
            },
        },
    },
    required: ['slides'],
};

const pick = (original: string | undefined, corrected: any): string | undefined => {
    if (original === undefined) return undefined;
    if (typeof corrected === 'string' && (corrected.trim().length > 0 || original.trim().length === 0)) {
        return corrected;
    }
    return original;
};

export const ProofreaderAgent = {
    proofread: async (slides: SlideContent[], brief?: CreativeBrief): Promise<SlideContent[]> => {

        if (slides.length === 0) return slides;

        // Batch into chunks of 4 to avoid JSON truncation on all model tiers.
        // Even Claude Sonnet occasionally drops the outer wrapper for larger payloads.
        // Each chunk is proofread independently, then results are stitched back.
        const CHUNK_SIZE = 4;

        if (slides.length > CHUNK_SIZE) {
            console.log(`[ProofreaderAgent] Large carousel (${slides.length} slides) — batching into chunks of ${CHUNK_SIZE}`);
            const chunks: SlideContent[][] = [];
            for (let i = 0; i < slides.length; i += CHUNK_SIZE) {
                chunks.push(slides.slice(i, i + CHUNK_SIZE));
            }
            const proofread = await Promise.all(chunks.map(chunk => ProofreaderAgent.proofread(chunk, brief)));
            return proofread.flat();
        }

        try {
            const inputForProofing = slides.map(s => ({
                preHeader: s.preHeader || '',
                headline: s.headline || '',
                body: s.body || '',
                footer: s.footer || '',
            }));

            const toneNote = brief
                ? `\nTONE: "${brief.creativeStyle.toneDescription.slice(0, 120)}"\n`
                : '';

            const prompt = `
        You are a meticulous proofreader for carousel copy.
${toneNote}
        Below is a JSON array of ${slides.length} slides, each with preHeader, headline, body, and footer text.

        Fix ONLY grammar, spelling, and punctuation errors. Do NOT:
        - change the meaning, tone, or voice
        - rewrite for style, or make it punchier/shorter/longer
        - add or remove slides
        - touch a field that has no error

        If a field is already correct, return it unchanged. If a field is empty, return it as an empty string.
        Return exactly ${slides.length} entries, in the same order as the input.

        SLIDES:
        ${JSON.stringify(inputForProofing)}
      `;

            const result = await generateContentFromAgent(prompt, PROOFREAD_SCHEMA);
            let corrected = result?.slides;
            
            // Normalize raw array responses
            if (!corrected && Array.isArray(result)) {
                corrected = result;
            }

            if (!Array.isArray(corrected) || corrected.length !== slides.length) {
                console.warn('[ProofreaderAgent] Response shape mismatch — skipping proofread pass:', {
                    expectedLength: slides.length,
                    actualLength: corrected?.length,
                    resultType: typeof result,
                    isArray: Array.isArray(result)
                });
                return slides;
            }

            return slides.map((slide, i) => {
                const c = corrected[i] || {};
                return {
                    ...slide,
                    preHeader: pick(slide.preHeader, c.preHeader),
                    headline: pick(slide.headline, c.headline) || slide.headline,
                    body: pick(slide.body, c.body),
                    footer: pick(slide.footer, c.footer),
                };
            });
        } catch (err) {
            console.warn('[ProofreaderAgent] Proofreading failed, keeping original copy:', err);
            return slides;
        }
    },
};

