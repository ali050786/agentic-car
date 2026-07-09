import { ALLOWED_DOODLE_TOPICS, SHARED_ICONS } from '../../config/constants';
import { CreativeBrief } from '../../types';

/**
 * Builds a dynamic writer persona from the Creative Brief.
 * When no brief is supplied, falls back to the template's static persona string.
 *
 * Usage in TemplateAgent:
 *   const persona = buildPersona(brief, config.persona);
 */
export function buildPersona(brief: CreativeBrief | undefined, fallbackPersona: string): string {
    if (!brief) return fallbackPersona;

    const { creativeStyle, audience, contentType } = brief;
    const { styleReference, toneDescription, vocabulary, humorAllowed, popCultureAllowed } = creativeStyle;

    const parts: string[] = [];

    // Lead with the style reference if given (e.g. "Tanmay Bhat")
    if (styleReference) {
        parts.push(`a writer who adopts the style of ${styleReference}`);
    } else {
        // Derive a role label from the content type
        const roleMap: Record<string, string> = {
            EDUCATIONAL:   'an educational content writer',
            ENTERTAINMENT: 'an entertainment writer',
            EDUTAINMENT:   'an edutainment writer who blends facts with humor',
            PROFESSIONAL:  'a LinkedIn thought-leadership ghostwriter',
            STORYTELLING:  'a narrative storyteller',
            HOW_TO:        'a practical tutorial writer',
            OPINION:       'a sharp opinion columnist',
        };
        parts.push(roleMap[contentType] ?? 'a content writer');
    }

    // Audience
    parts.push(`writing for ${audience.description}`);

    // Tone
    parts.push(`Tone: ${toneDescription}`);

    // Vocabulary level
    const vocabMap: Record<string, string> = {
        SIMPLE:       'Use simple, accessible language. No jargon.',
        CASUAL:       'Use casual, conversational language.',
        PROFESSIONAL: 'Use professional, clear language.',
        ACADEMIC:     'Use precise, evidence-based language.',
    };
    parts.push(vocabMap[vocabulary] ?? '');

    // Optional flags
    if (humorAllowed) parts.push('Humor and wit are encouraged — be playful.');
    if (popCultureAllowed) parts.push('Pop culture references are welcome when they strengthen a point.');
    if (!brief.contentStrategy.businessMetaphorsAllowed) {
        parts.push('CRITICAL: Do NOT use business metaphors or LinkedIn-style lessons. Stay on the actual topic.');
    }
    if (brief.contentStrategy.stayFactuallyAccurate) {
        parts.push('CRITICAL: All stated facts must be accurate. Do not hallucinate data or events.');
    }

    return parts.join('. ');
}



export interface TemplateConfig {
    id: string;
    name: string;
    persona: string;
    styleName: string;

    designConstraints: string;
    variantRequirements: {
        hero: string;
        body: string;
        list: string;
        closing: string;
    };
    schema: any;
    defaultIcon: string;
}

export const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
    'template-1': {
        id: 'template-1',
        name: 'The Truth',
        persona: 'LinkedIn Ghostwriter',
        styleName: 'The Truth',

        designConstraints: `
      - Tone: Direct, slightly contrarian, authoritative — a bold statement, not a shout.
      - **Style**: Headlines are sentence case, punchy declarative statements ("Most advice
        about AI is already obsolete."). No ALL-CAPS.
      - **accentPhrase**: For EVERY slide pick ONE short phrase (1-3 words) that appears
        verbatim inside the headline — the emotional pivot word. It is rendered in an
        elegant italic serif in the accent color, so choose the word that deserves drama.
      - **Color Theme**: Create a bespoke color palette based on the topic emotion.
        - Keep it High Contrast (Dark, near-black Background + Light Text).
        - background2 is the single vivid accent (glow, accent phrase, button) — use the
          topic to decide: Red (Warning), Electric Blue (Tech), Green (Money), Amber (Energy).
    `,
        variantRequirements: {
            hero: "Needs preHeader, headline, a short body intro, accentPhrase. preHeader (Concise, Max 60 chars). headline (Complete title, Max 50 chars). body (short intro, Max 150 chars).",
            body: "Needs preHeader, headline, body text (max 35 words), accentPhrase. preHeader (Concise, Max 60 chars). headline (Complete title, Max 50 chars). body (explanation text. Max 250 chars)).",
            list: "Needs preHeader, headline, accentPhrase. **CRITICAL**: 'listItems' MUST use the format \"Key: Value\" (e.g., \"Direction: From complex to obvious\"). Max 3 items per slide. preHeader (Concise, Max 60 chars). headline (SHORT title, Max 35 chars). listItems (Max 3 items) Max 80 chars per item.",
            closing: "preHeader (Concise, Max 60 chars). headline (Complete title, Max 50 chars). body (final philosophical statement Max 80 chars). accentPhrase required."
        },
        defaultIcon: 'Lightbulb',
        schema: {
            type: 'object',
            properties: {
                theme: {
                    type: 'object',
                    properties: {
                        textDefault: { type: 'string' },
                        textHighlight: { type: 'string' },
                        background: { type: 'string' },
                        background2: { type: 'string' }
                    },
                    required: ['textDefault', 'textHighlight', 'background']
                },
                slides: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            variant: { type: 'string', enum: ['hero', 'body', 'list', 'closing'] },
                            preHeader: { type: 'string' },
                            headline: { type: 'string' },
                            accentPhrase: { type: 'string' },
                            body: { type: 'string' },
                            listItems: { type: 'array', items: { type: 'string' } },
                            footer: { type: 'string' },
                            icon: { type: 'string', enum: SHARED_ICONS },
                            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
                        },
                        required: ['variant', 'headline', 'accentPhrase', 'icon', 'doodleTopic']
                    }
                }
            },
            required: ['slides']
        }
    },
    'template-3': {
        id: 'template-3',
        name: 'The Sketch',
        persona: 'LinkedIn Ghostwriter specializing in high-growth startup aesthetics',
        styleName: 'The Sketch',

        designConstraints: `
      - Tone: Editorial, confident, human — premium fintech branding, not hype.
      - **Style**: Headlines are sentence case, conversational statements ("You have goals.",
        "Now is the time to act."). Punchy, direct, no ALL-CAPS shouting.
      - **accentPhrase**: For EVERY slide pick ONE short phrase (1-3 words) that appears
        verbatim inside the headline — the emotional keyword. It gets a hand-drawn
        highlighter mark in the design.
      - **Fonts**: Imagine an elegant editorial serif (Fraunces) on warm paper.
      - **COLOR THEME** (light, warm, editorial — think cream card on a brand-color feed):
        - background: A warm paper tone (e.g., #F5F1E8, #FAF6EF, or a soft pastel tint). NEVER dark.
        - textDefault: A near-black ink color (e.g., #1A1A18, #1E1B4B).
        - textHighlight: One confident brand accent (e.g., forest green #0E8A5F, burnt orange #D96C3D).
        - background2: A softer companion of the accent for washes and marks (e.g., #DCEFE6).
    `,
        variantRequirements: {
            hero: "preHeader (Context), headline (Visionary title), body (Hook), accentPhrase. preHeader (Max 60 chars). headline (Max 45 chars). body (Max 150 chars).",
            body: "preHeader (Tag), headline, body (Concept explanation), accentPhrase. headline (Max 45 chars). body (Max 200 chars).",
            list: "headline, listItems (3 key pillars), accentPhrase. headline (SHORT title, Max 30 chars). listItems (Max 3 items, format \"Key: Value\", Max 70 chars each).",
            closing: "preHeader, headline, body, accentPhrase. headline (Call to action/Conclusion). body (Final visionary statement)."
        },
        defaultIcon: 'Rocket',
        schema: {
            type: 'object',
            properties: {
                theme: {
                    type: 'object',
                    properties: {
                        background: { type: 'string' },
                        textHighlight: { type: 'string' },
                        background2: { type: 'string' },
                        textDefault: { type: 'string' },
                        patternColor: { type: 'string' }
                    },
                    required: ['background', 'textHighlight', 'background2', 'textDefault']
                },
                slides: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            variant: { type: 'string', enum: ['hero', 'body', 'list', 'closing'] },
                            preHeader: { type: 'string' },
                            headline: { type: 'string' },
                            accentPhrase: { type: 'string' },
                            body: { type: 'string' },
                            listItems: { type: 'array', items: { type: 'string' } },
                            icon: { type: 'string', enum: SHARED_ICONS },
                            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
                        },
                        required: ['variant', 'headline', 'accentPhrase', 'doodleTopic', 'icon']
                    }
                }
            },
            required: ['slides']
        }
    },
    'template-4': {
        id: 'template-4',
        name: 'The Statement',
        persona: 'Brand strategist who writes bold, declarative carousels in a premium minimalist style',
        styleName: 'The Statement',

        designConstraints: `
      - Tone: Confident, declarative, no hedging. Every headline reads like a thesis.
      - **Writing style**: Sentence case headlines (NOT all caps). Short, punchy, quotable.
      - **accentPhrase**: For EVERY slide pick the 2-4 most important consecutive words from
        that slide's headline and return them as "accentPhrase". It MUST be an exact substring
        of the headline (same casing). It gets rendered in the accent color.
      - **COLOR THEME**:
        - background: A deep, rich, near-dark color with personality (e.g. #1D1A45, #14251F, #2A1233).
        - textHighlight: Near-white with a hint of the background hue (e.g. #F5F4FF).
        - background2: One vibrant pop accent that contrasts the background (e.g. #F0997B, #5DCAA5).
        - textDefault: A muted mid-tone of the background family (e.g. #A9A6C9).
    `,
        variantRequirements: {
            hero: "preHeader (topic tag, Max 40 chars), headline (declarative statement, Max 60 chars, sentence case), body (hook, Max 140 chars), accentPhrase (2-4 word exact substring of headline).",
            body: "preHeader (section tag, Max 30 chars), headline (Max 70 chars, sentence case), body (explanation, Max 220 chars), accentPhrase (exact substring of headline).",
            list: "headline (SHORT title, Max 40 chars, sentence case), listItems (3-4 items, format \"Key: Value\", Max 80 chars each), accentPhrase (exact substring of headline).",
            closing: "preHeader (Max 30 chars), headline (call to action, Max 50 chars, sentence case), body (final statement, Max 140 chars), footer (pill button text, Max 25 chars e.g. \"Follow for more →\"), accentPhrase (exact substring of headline)."
        },
        defaultIcon: 'Zap',
        schema: {
            type: 'object',
            properties: {
                theme: {
                    type: 'object',
                    properties: {
                        background: { type: 'string' },
                        textHighlight: { type: 'string' },
                        background2: { type: 'string' },
                        textDefault: { type: 'string' }
                    },
                    required: ['background', 'textHighlight', 'background2', 'textDefault']
                },
                slides: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            variant: { type: 'string', enum: ['hero', 'body', 'list', 'closing'] },
                            preHeader: { type: 'string' },
                            headline: { type: 'string' },
                            body: { type: 'string' },
                            listItems: { type: 'array', items: { type: 'string' } },
                            footer: { type: 'string' },
                            accentPhrase: { type: 'string' },
                            icon: { type: 'string', enum: SHARED_ICONS },
                            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
                        },
                        required: ['variant', 'headline', 'accentPhrase', 'icon']
                    }
                }
            },
            required: ['slides']
        }
    }
};
