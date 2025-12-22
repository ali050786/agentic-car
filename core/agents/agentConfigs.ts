import { ALLOWED_DOODLE_TOPICS, SHARED_ICONS } from '../../config/constants';

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
      - Tone: Direct, slightly contrarian, authoritative.
      - Font styles: Bold headlines, punchy short body text.
      - **Color Theme**: Create a bespoke color palette based on the topic emotion. 
        - Generally keep it High Contrast (Dark Background + Light Text).
        - Use the topic to decide if the accent is Red (Warning), Blue (Tech), Green (Money), etc.
    `,
        variantRequirements: {
            hero: "Needs preHeader, headline, and a short body intro. preHeader (Concise, Max 60 chars). headline (Complete title, Max 50 chars). body (short intro, Max 150 chars).",
            body: "Needs preHeader, headline, and body text (max 35 words). preHeader (Concise, Max 60 chars). headline (Complete title, Max 50 chars). body (explanation text. Max 250 chars)).",
            list: "Needs preHeader, headline. **CRITICAL**: 'listItems' MUST use the format \"Key: Value\" (e.g., \"Direction: From complex to obvious\"). Max 3 items per slide. preHeader (Concise, Max 60 chars). headline (SHORT title, Max 35 chars). listItems (Max 3 items) Max 80 chars per item.",
            closing: "preHeader (Concise, Max 60 chars). headline (Complete title, Max 50 chars). body (final philosophical statement Max 80 chars)."
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
                            body: { type: 'string' },
                            listItems: { type: 'array', items: { type: 'string' } },
                            footer: { type: 'string' },
                            icon: { type: 'string', enum: SHARED_ICONS },
                            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
                        },
                        required: ['variant', 'headline', 'icon', 'doodleTopic']
                    }
                }
            },
            required: ['slides']
        }
    },
    'template-2': {
        id: 'template-2',
        name: 'The Clarity',
        persona: 'LinkedIn Ghostwriter specializing in Clarity',
        styleName: 'The Clarity',

        designConstraints: `
      - Tone: Educational, professional, clean, optimistic.
      - **Color Design System**: You MUST generate a palette matching these exact variables:
        1. background: Main dark background.
        2. textHighlight: Bright accent color for keywords and buttons.
        3. background2: Secondary accent color for architectural elements (arches).
        4. textDefault: Usually white or off-white.
        5. bgGradStart & bgGradEnd: Colors for the subtle radial gradient overlay.
    `,
        variantRequirements: {
            hero: "preHeader (Topic Tag), headline, body (intro). preHeader (Concise topic tag, Max 60 chars). headline (Complete impactful title, Max 45 chars). body (engaging intro, Max 150 chars).",
            body: "preHeader (Tag), headline, body (Explanation, max 40 words). preHeader (Tag, Max 60 chars). headline (Complete title, Max 45 chars). body (explanation, Max 250 chars).",
            list: "preHeader (Tag), headline, listItems. preHeader (Tag, Max 60 chars). headline (SHORT title, Max 35 chars). listItems (Max 3 items, bullet + description, Max 80 chars each).",
            closing: "headline, body, footer. headline (Complete strong title, Max 45 chars). body (Impact statement, Max 100 chars). footer (Call to action, Max 35 chars, e.g. \"Craft Today\")."
        },
        defaultIcon: 'Lightbulb',
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
                        bgGradStart: { type: 'string' },
                        bgGradEnd: { type: 'string' }
                    },
                    required: ['background', 'textHighlight', 'background2', 'textDefault', 'bgGradStart', 'bgGradEnd']
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
                            icon: { type: 'string', enum: SHARED_ICONS },
                            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
                        },
                        required: ['variant', 'headline', 'icon', 'doodleTopic']
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
      - Tone: Visionary, bold, "first-principles" thinking.
      - **Style**: Use metaphors related to growth, rockets, building, and sketching.
      - **Fonts**: Imagine the headline in a sketchy cursive (Fredericka the Great). Headlines should be punchy.
      - **COLOR THEME**:
        - background: Usually #FFFFFF (Strictly white for that "sketchpad" feel).
        - textDefault: A dark, ink-like color (e.g., #1E1B4B).
        - textHighlight: A vibrant pop color (e.g., #9333EA).
        - background2: A solid accent color for structural elements (e.g., #055569).
    `,
        variantRequirements: {
            hero: "preHeader (Context), headline (Visionary title), body (Hook). preHeader (Max 60 chars). headline (Max 45 chars). body (Max 150 chars).",
            body: "preHeader (Tag), headline, body (Concept explanation). headline (Max 45 chars). body (Max 200 chars).",
            list: "headline, listItems (3 key pillars). headline (SHORT title, Max 30 chars). listItems (Max 3 items, format \"Key: Value\", Max 70 chars each).",
            closing: "preHeader, headline, body. headline (Call to action/Conclusion). body (Final visionary statement)."
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
                            body: { type: 'string' },
                            listItems: { type: 'array', items: { type: 'string' } },
                            icon: { type: 'string', enum: SHARED_ICONS },
                            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
                        },
                        required: ['variant', 'headline', 'doodleTopic', 'icon']
                    }
                }
            },
            required: ['slides']
        }
    }
};
