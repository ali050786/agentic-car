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
      - A narrative mini-story with characters and tension or humor, not a static object.
        Use stick figures, robots, business people, machines, physical props.
      - Label the key elements with short ALL-CAPS words in single quotes so the viewer
        instantly maps the drawing to the idea (e.g. a robot labeled 'AI AGENT' flying with a
        jetpack over a tangled maze of screens labeled 'USER FLOW', while a confused designer
        stands at the entrance holding a useless map).
      - Show CONTRAST where possible: the old/painful way vs the new/easy way, expectation vs
        reality, effort vs shortcut (e.g. an elaborate front door covered in locks labeled 'UI'
        while a robot casually walks through a hole smashed in the wall labeled 'API').
      - 25 to 60 words. Concrete and spatial — say what is where and what it is doing.
      - Keep labels to 1-3 short words each, maximum 3 labels per scene.
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
