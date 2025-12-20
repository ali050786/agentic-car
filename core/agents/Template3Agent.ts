import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent, CarouselTheme } from '../../types';
import { AgentContext } from './MainAgent';

const T3_SCHEMA = {
    type: 'object',
    properties: {
        theme: {
            type: 'object',
            properties: {
                background: { type: 'string', description: 'Main background color (Light, e.g., #FFFFFF)' },
                textHighlight: { type: 'string', description: 'Highlight text color (e.g., #9333EA)' },
                background2: { type: 'string', description: 'Secondary background/accent color (Teal, e.g., #055569)' },
                textDefault: { type: 'string', description: 'Default text color (Dark Indigo, e.g., #1E1B4B)' },
                patternColor: { type: 'string', description: 'Subtle pattern color (e.g., #E0E7FF)' }
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
                    listItems: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    icon: { type: 'string', description: 'Lucide icon name' },
                    doodlePrompt: { type: 'string', description: 'Metaphorical doodle prompt for Replicate' }
                },
                required: ['variant', 'headline', 'doodlePrompt']
            }
        }
    },
    required: ['slides']
};

export const Template3Agent = {
    id: 'template-3',
    name: 'The Sketch',

    generate: async (context: AgentContext): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
        const { sourceContent, customInstructions, outputLanguage, slideCount, viralAngle } = context;

        const prompt = `
      You are a LinkedIn Ghostwriter specializing in high-growth startup aesthetics. 
      Your style is "The Sketch" - visionary, raw, and impactful.
      
      The Strategy/Angle: 
      """
      ${viralAngle || sourceContent}
      """
      
      User Constraints: ${customInstructions || 'None'}
      
      Task: Write a ${slideCount}-slide carousel.
      
      Design Constraints for Content:
      - Tone: Visionary, bold, "first-principles" thinking.
      - **Style**: Use metaphors related to growth, rockets, building, and sketching.
      - **Fonts**: Imagine the headline in a sketchy cursive (Fredericka the Great). Headlines should be punchy.
      
      Instructions:
      1. Create a visionary narrative with EXACTLY ${slideCount} slides.
      2. **Slide 1 must be 'hero' variant**.
      3. **Last Slide must be 'closing' variant**.
      4. **Middle Slides**: Mix 'body' and 'list' variants.
      5. **Generate all content in ${outputLanguage}**.
      
      6. **Doodle Prompts**: For EACH slide, generate a \`doodlePrompt\`.
         - Format: "A black pencil sketch doodle of [metaphorical object based on slide content] isolated on a pure white background (#ffffff) with rough hand-drawn lines and cross-hatch shading."
         - Examples:
           - "A black pencil sketch doodle of a simple hand-drawn rocket isolated on a pure white background (#ffffff) with rough hand-drawn lines and cross-hatch shading."
           - "A black pencil sketch doodle of a lightbulb with light rays, rough pencil texture, isolated on a pure white background (#ffffff)."
           - "A black pencil sketch doodle of a mountain peak with a flag at the top, sketchy style, isolated on a pure white background (#ffffff)."
      
      Variant Requirements:
      - 'hero': preHeader (Context), headline (Visionary title), body (Hook).
          - preHeader (Max 60 chars).
          - headline (Max 45 chars).
          - body (Max 150 chars).
      - 'body': preHeader (Tag), headline, body (Concept explanation).
          - headline (Max 45 chars).
          - body (Max 200 chars).
      - 'list': headline, listItems (3 key pillars).
          - listItems (Max 3 items, format "Key: Value", Max 100 chars each).
      - 'closing': preHeader, headline, body.
          - headline (Call to action/Conclusion).
          - body (Final visionary statement).
      
      **COLOR THEME**:
      - background: Usually #FFFFFF (Strictly white for that "sketchpad" feel).
      - textDefault: A dark, ink-like color (e.g., #1E1B4B).
      - textHighlight: A vibrant pop color (e.g., #9333EA).
      - background2: A solid accent color for structural elements (e.g., #055569).
          
      Return JSON fitting the schema.
    `;

        const result = await generateContentFromAgent(prompt, T3_SCHEMA);

        const data = result.carousel || result;
        const slides = data.slides.map((s: any, i: number) => ({
            id: "t3-slide-" + i,
            variant: s.variant,
            headline: (s.headline || '').toUpperCase(),
            preHeader: (s.preHeader || '').toUpperCase(),
            body: s.body || '',
            listItems: s.listItems || [],
            icon: s.icon || 'Rocket',
            doodlePrompt: s.doodlePrompt
        }));

        return { slides, theme: data.theme };
    }
};
