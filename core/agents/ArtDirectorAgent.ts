/**
 * Art Director Agent
 *
 * Runs AFTER content generation. Takes the finished Template-3 slides and
 * writes one tailored image prompt per slide for the Replicate flux model.
 *
 * The LLM decides WHAT to draw (a concrete visual metaphor for the slide's
 * message); the fixed style envelope guarantees HOW it looks (black pencil
 * sketch doodle on white), keeping every slide visually consistent.
 */

import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent } from '../../types';

const PROMPT_SCHEMA = {
    type: 'object',
    properties: {
        prompts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    slideIndex: { type: 'number' },
                    subject: { type: 'string' }
                },
                required: ['slideIndex', 'subject']
            }
        }
    },
    required: ['prompts']
};

/**
 * Wraps a scene in the fixed Template-3 editorial style so all illustrations
 * match. Mono black ink only: the slide templates knock out the white
 * background with multiply blending and supply all color via themed SVG
 * accents, so one cached image works with every theme.
 */
export const buildFluxPrompt = (scene: string): string =>
    `minimal editorial spot illustration of ${scene}, loose confident black ink line art, hand-drawn imperfect strokes, monochrome black ink only, elegant magazine spot illustration style, lots of white space, isolated on a plain white background, no text`;

export const ArtDirectorAgent = {
    /**
     * Returns one full flux prompt per slide (same order as input slides).
     */
    generatePrompts: async (slides: SlideContent[], angle: string): Promise<string[]> => {
        const slideSummaries = slides
            .map((s, i) => {
                const parts = [`Slide ${i} [${s.variant}]: ${s.headline}`];
                if (s.body) parts.push(s.body);
                if (s.listItems && s.listItems.length > 0) parts.push(s.listItems.join('; '));
                return parts.join(' — ');
            })
            .join('\n');

        const prompt = `
      You are an Art Director for an editorial ink-illustration LinkedIn carousel — the style
      of premium fintech branding: loose, confident black ink line art, like a magazine spot
      illustration.

      Carousel angle:
      """
      ${angle}
      """

      Slides:
      ${slideSummaries}

      Task: For EACH slide, invent ONE storytelling scene that dramatizes that slide's core
      message, described so it can be drawn as a single ink spot illustration.

      The storytelling formula — every scene follows it:
      ONE person + ONE oversized symbolic object + a physical action that carries the emotion.
      The person physically INTERACTS with the metaphor. Examples of the grammar:
      - a person in a suit sprinting up a huge rising arrow like a ramp, papers flying behind
      - a person watering a small plant that grows coins as leaves
      - a person balancing on a seesaw against a towering stack of oversized coins
      - a person relaxing on a cloud with a laptop while small arrows float upward around them
      The interaction is what makes it a story instead of an icon — the object must be
      exaggerated in scale, and the pose must show the feeling (strain, ease, triumph, doubt).

      Rules for each scene:
      - ONE person, ONE dominant object, ONE action — never a multi-part composition or
        split-screen. The image model renders a single focal idea reliably.
      - Do NOT ask for any text, words, letters, numbers, or labels inside the image. Diffusion
        models render in-image text as garbled scribbles — the metaphor must read entirely from
        imagery.
      - Show CONTRAST through pose and scale when relevant (effort vs ease, big vs small),
        never through labels or side-by-side panels.
      - 15 to 35 words. Concrete and spatial — who, doing what, with what oversized object,
        plus at most one small supporting detail (flying papers, droplets, motion lines).
      - Vary the metaphors across slides; never repeat the same main object twice.

      Return JSON: { "prompts": [ { "slideIndex": 0, "subject": "..." }, ... ] } with exactly one entry per slide, where "subject" is the scene description.
    `;

        console.log('🎨 [ArtDirectorAgent] Writing image prompts for', slides.length, 'slides...');
        const result = await generateContentFromAgent(prompt, PROMPT_SCHEMA);

        const entries: { slideIndex: number; subject: string }[] = Array.isArray(result?.prompts)
            ? result.prompts
            : [];

        // Map back by slideIndex, falling back to the slide's topic-based prompt
        return slides.map((slide, i) => {
            const match = entries.find(e => e.slideIndex === i && typeof e.subject === 'string' && e.subject.trim());
            if (match) {
                return buildFluxPrompt(match.subject.trim());
            }
            console.warn(`[ArtDirectorAgent] No subject returned for slide ${i}, using fallback`);
            return slide.doodlePrompt || buildFluxPrompt(slide.headline.toLowerCase());
        });
    }
};
