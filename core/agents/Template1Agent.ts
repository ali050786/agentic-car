import { generateContentFromAgent } from '../../services/geminiService';
import { SlideContent, CarouselTheme } from '../../types';

// JSON Schema used for AI structured outputs (Claude/Groq)
const T1_SCHEMA = {
  type: 'object',
  properties: {
    theme: {
      type: 'object',
      properties: {
        textDefault: { type: 'string', description: 'Hex color for normal text (e.g., #A2A2A2)' },
        textHighlight: { type: 'string', description: 'Hex color for highlights (e.g., #FFFFFF)' },
        background: { type: 'string', description: 'Hex color for main background (Dark, e.g., #141414)' },
        background2: { type: 'string', description: 'RGBA string for secondary elements (e.g., rgba(255,255,255,0.1))' }
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
          headlineHighlight: { type: 'string' },
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

export const Template1Agent = {
  id: 'template-1',
  name: 'The Truth',

  generate: async (topic: string): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
    const prompt = `
      You are the "Truth" Agent. You create bold, industrial-style LinkedIn carousels.
      Topic: "${topic}"

      Design Constraints:
      - Tone: Direct, slightly contrarian, authoritative.
      - Font styles: Bold headlines, punchy short body text.
      - **Color Theme**: Create a bespoke color palette based on the topic emotion. 
        - Generally keep it High Contrast (Dark Background + Light Text).
        - Use the topic to decide if the accent is Red (Warning), Blue (Tech), Green (Money), etc.
      
      Instructions:
      1. Create a comprehensive narrative between 5 and 10 slides long.
      2. **Slide 1 must be 'hero' variant**: A strong hook/title.
      3. **Last Slide must be 'closing' variant**: A strong takeaway/CTA.
      4. **Middle Slides**: Dynamically choose between 'body' (for concepts/definitions) and 'list' (for strategies/steps) based on the content flow.
      
      **CRITICAL - Headline & HeadlineHighlight Rule**:
      - For 'hero' variant: headline and headlineHighlight appear on the SAME line (headline comes first, then highlight)
      - For 'body', 'list', 'closing' variants: headline and headlineHighlight are TWO SEPARATE LINES
      - They work together as a complete title/message split across two lines
      - Example for body/list/closing: headline: "CHOOSE YOUR", headlineHighlight: "JOURNEY"
      - Example for body/list/closing: headline: "UNDERSTANDING", headlineHighlight: "NEEDS"  
      - Example for hero: headline: "MASTER THE ART OF ", headlineHighlight: "CODING"
      - DO NOT repeat words! headline: "JOURNEY", headlineHighlight: "JOURNEY" is WRONG!
      
      Variant Requirements:
      - 'hero': Needs preHeader, headline, headlineHighlight, and a short body intro. 
          - Headlines appear on SAME LINE: "{{headline}} {{headlineHighlight}}"
          - preHeader (Concise, Max 60 chars).
          - headline (First part of title, Max 36 chars).
          - headlineHighlight (Completing part, highlighted, Max 15 chars). 
          - body (short intro, Max 150 chars).
      - 'body': Needs preHeader, headline, headlineHighlight, and body text (max 35 words).
          - Headlines appear on TWO LINES: Line 1: "{{headline}}" | Line 2: "{{headlineHighlight}}"
          - preHeader (Concise, Max 60 chars).
          - headline (First line, faded, Max 36 chars).
          - headlineHighlight (Second line, bright emphasis, Max 15 chars). 
          - body (explanation text. Max 250 chars)).
          
      - 'list': Needs preHeader, headline, headlineHighlight. **CRITICAL**: 'listItems' MUST use the format "Key: Value" (e.g., "Direction: From complex to obvious"). Max 3 items per slide.
          - Headlines appear on TWO LINES: Line 1: "{{headline}}" | Line 2: "{{headlineHighlight}}"
          - preHeader (Concise, Max 60 chars).
          - headline (First line, faded, Max 36 chars).
          - headlineHighlight (Second line, bright emphasis, Max 15 chars). 
          - listItems (Max 3 items) Max 120 chars per item.
      - 'closing': 
          - Headlines appear on TWO LINES: Line 1: "{{headline}}" | Line 2: "{{headlineHighlight}}"
          - preHeader (Concise, Max 60 chars)
          - headline (First line, faded, Max 36 chars).
          - headlineHighlight (Second line, bright emphasis, Max 15 chars). 
          - body (final philosophical statement Max 80 chars).
          
         
      Return JSON fitting the schema including the Theme.
    `;

    const result = await generateContentFromAgent(prompt, T1_SCHEMA);

    // Validate response structure
    if (!result || typeof result !== 'object') {
      console.error('[Template1Agent] Invalid API response:', result);
      throw new Error('API returned invalid response structure');
    }

    // Handle both direct format and Claude's nested format
    const data = result.carousel || result;

    if (!data.slides || !Array.isArray(data.slides)) {
      console.error('[Template1Agent] Missing or invalid slides array:', result);
      console.error('[Template1Agent] Full response:', JSON.stringify(result, null, 2));
      throw new Error('API response missing slides array. Check console for details.');
    }

    // Post-processing
    const slides = data.slides.map((s: any, i: number) => ({
      id: `t1-slide-${i}`,
      variant: s.variant,
      headline: s.headline?.toUpperCase() || '',
      headlineHighlight: s.headlineHighlight?.toUpperCase() || '',
      preHeader: s.preHeader?.toUpperCase() || '',
      body: s.body || '',
      listItems: s.listItems || [],
      footer: s.footer || ''
    }));

    return { slides, theme: data.theme };
  }
};