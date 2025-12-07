import { generateContentFromAgent } from '../../services/geminiService';
import { SlideContent, CarouselTheme } from '../../types';

const T2_SCHEMA = {
  type: 'object',
  properties: {
    theme: {
      type: 'object',
      properties: {
        background: { type: 'string', description: 'Main background color (e.g., #091c33)' },
        textHighlight: { type: 'string', description: 'Highlight text color (e.g., #f4782d)' },
        background2: { type: 'string', description: 'Secondary background/accent color (e.g., #6d51a2)' },
        textDefault: { type: 'string', description: 'Default text color (e.g., #ffffff)' },
        bgGradStart: { type: 'string', description: 'Gradient start color (e.g., #6d51a2)' },
        bgGradEnd: { type: 'string', description: 'Gradient end color, this should always be exact same to background (e.g., #091c33)' }
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
          listItems: {
            type: 'array',
            items: { type: 'string' }
          },
          footer: { type: 'string' }
        },
        required: ['variant', 'headline']
      }
    }
  },
  required: ['slides']
};

export const Template2Agent = {
  id: 'template-2',
  name: 'The Clarity',

  generate: async (topic: string): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
    const prompt = `
      You are the "Clarity" Agent. You create modern, tech-forward LinkedIn carousels.
      Topic: "${topic}"

      Design Constraints:
      - Tone: Educational, professional, clean, optimistic.
      - **Color Design System**: You MUST generate a palette matching these exact variables:
        1. background: Main dark background.
        2. textHighlight: Bright accent color for keywords and buttons.
        3. background2: Secondary accent color for architectural elements (arches).
        4. textDefault: Usually white or off-white.
        5. bgGradStart & bgGradEnd: Colors for the subtle radial gradient overlay.
      
      Instructions:
      1. Create a helpful, educational guide between 5 and 10 slides long.
      2. **Slide 1 must be 'hero' variant**.
      3. **Last Slide must be 'closing' variant**.
      4. **Middle Slides**: Mix 'body' (for explanations) and 'list' (for actionable steps).
      
      **CRITICAL - Headline Rule**:
      - Generate complete, impactful headlines in the headline field
      - All variants use single-line headlines (no splitting needed)
      - Max headline length varies by variant (see below)
      
      Variant Requirements:
      - 'hero': preHeader (Topic Tag), headline, body (intro).
          - preHeader (Concise topic tag, Max 60 chars).
          - headline (Complete impactful title, Max 45 chars).
          - body (engaging intro, Max 150 chars).
      - 'body': preHeader (Tag), headline, body (Explanation, max 40 words).
          - preHeader (Tag, Max 60 chars).
          - headline (Complete title, Max 45 chars).
          - body (explanation, Max 250 chars).
      - 'list': preHeader (Tag), headline, listItems.
          - preHeader (Tag, Max 60 chars).
          - headline (Complete title, Max 45 chars).
          - listItems (Max 3 items, bullet + description, Max 120 chars each).
      - 'closing': headline, body, footer.
          - headline (Complete strong title, Max 45 chars).
          - body (Impact statement, Max 100 chars).
          - footer (Call to action, Max 35 chars, e.g. "Craft Today").
          
      Return JSON fitting the schema including the Theme.
    `;

    const result = await generateContentFromAgent(prompt, T2_SCHEMA);

    // Validate response structure
    if (!result || typeof result !== 'object') {
      console.error('[Template2Agent] Invalid API response:', result);
      throw new Error('API returned invalid response structure');
    }

    // Handle both direct format and Claude's nested format
    const data = result.carousel || result;

    if (!data.slides || !Array.isArray(data.slides)) {
      console.error('[Template2Agent] Missing or invalid slides array:', result);
      console.error('[Template2Agent] Full response:', JSON.stringify(result, null, 2));
      throw new Error('API response missing slides array. Check console for details.');
    }

    // Post-processing
    const slides = data.slides.map((s: any, i: number) => ({
      id: `t2-slide-${i}`,
      variant: s.variant,
      headline: s.headline || '',
      preHeader: s.preHeader || '',
      body: s.body || '',
      listItems: s.listItems || [],
      footer: s.footer || ''
    }));

    return { slides, theme: data.theme };
  }
};