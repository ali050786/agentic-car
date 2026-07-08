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
 * Wraps a scene in the fixed Template-3 sketch style so all doodles match.
 */
export const buildFluxPrompt = (scene: string): string =>
    `A simple hand-drawn doodle sketch of ${scene}, thick black marker lines, rough outlines, grey scribble shading and hatching, minimalist whiteboard animation style, line art, isolated on a plain white background`;

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
      You are an Art Director for a hand-drawn "whiteboard sketch" style LinkedIn carousel.

      Carousel angle:
      """
      ${angle}
      """

      Slides:
      ${slideSummaries}

      Task: For EACH slide, invent ONE witty visual metaphor scene that dramatizes that slide's
      core message, described so it can be drawn as a single marker doodle.

      Rules for each scene:
      - ONE dominant subject performing ONE clear action — not a multi-part composition. The
        image model renders a single focal idea reliably; splitting the frame into two staged
        halves or stacking several props together muddles the composition.
      - Convey the idea through the choice of subject, pose, and props alone — a robot with a
        jetpack soaring over a tangled pile of wires while a stick figure looks up bewildered,
        or an oversized key effortlessly opening a padlock the size of a house.
      - Do NOT ask for any text, words, letters, or labels inside the image. Diffusion models
        render in-image text as garbled scribbles, which wrecks the drawing — the metaphor must
        read entirely from imagery, no captions or signage of any kind.
      - Show CONTRAST through the objects and actions themselves when relevant (old/painful vs
        new/easy, effort vs shortcut) — e.g. one figure straining to push a boulder up a hill
        while another rides past on a rocket, not a split-screen or labeled comparison.
      - 15 to 35 words. Concrete and spatial — say what the subject is, what it's doing, and
        at most one supporting prop.
      - Vary the metaphors across slides; never repeat the same scene or main prop twice.

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
