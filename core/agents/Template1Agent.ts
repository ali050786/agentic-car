import { generateContentFromAgent } from '../../services/geminiService';
import { SlideContent, CarouselTheme } from '../../types';
import { AgentContext } from './MainAgent';

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
        background2: { type: 'string', description: 'Hex color for secondary/accent color (e.g., #FFFFFF or #333333)' }
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
          listItems: {
            type: 'array',
            items: { type: 'string' }
          },
          footer: { type: 'string' },
          icon: { type: 'string', description: 'Lucide icon name (e.g., "Lightbulb", "Target", "TrendingUp", "Rocket", "Brain", "Users", "Shield", "Zap", "Award", "Star")' }
        },
        required: ['variant', 'headline']
      }
    }
  },
  required: ['slides']
};

// Helper to format input mode for display
const formatContextType = (inputMode: string): string => {
  const typeMap: { [key: string]: string } = {
    topic: 'Topic/Idea',
    text: 'Article/Text',
    url: 'Web URL',
    video: 'Video Transcript',
    pdf: 'PDF Document'
  };
  return typeMap[inputMode] || inputMode;
};

export const Template1Agent = {
  id: 'template-1',
  name: 'The Truth',

  generate: async (context: AgentContext): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
    const { inputMode, sourceContent, customInstructions, outputLanguage, slideCount } = context;

    const prompt = `
      You are the "Truth" Agent. You create bold, industrial-style LinkedIn carousels.
      
      ═══════════════════════════════════════════════════════════════════════
      CONTEXT INFORMATION
      ═══════════════════════════════════════════════════════════════════════
      CONTEXT_TYPE: ${formatContextType(inputMode)}
      TARGET_LANGUAGE: ${outputLanguage}
      SLIDE_COUNT: ${slideCount} slides (must generate exactly ${slideCount} slides)
      ${customInstructions ? `USER_INSTRUCTIONS: ${customInstructions}` : ''}
      
      SOURCE_MATERIAL:
      """
      ${sourceContent}
      """
      
      ═══════════════════════════════════════════════════════════════════════
      CRITICAL INSTRUCTION - SOURCE MATERIAL ADHERENCE
      ═══════════════════════════════════════════════════════════════════════
      If SOURCE_MATERIAL is provided above, you MUST:
      - STRICTLY base the carousel content on that material
      - Extract key points, facts, and narratives directly from the source
      - Do NOT hallucinate or add outside facts unless absolutely necessary to fill gaps
      - Maintain the core message and tone of the source material
      - If the source is insufficient, acknowledge gaps rather than inventing information
      
      Design Constraints:
      - Tone: Direct, slightly contrarian, authoritative.
      - Font styles: Bold headlines, punchy short body text.
      - **Color Theme**: Create a bespoke color palette based on the topic emotion. 
        - Generally keep it High Contrast (Dark Background + Light Text).
        - Use the topic to decide if the accent is Red (Warning), Blue (Tech), Green (Money), etc.
      
      Instructions:
      1. Create a comprehensive narrative with EXACTLY ${slideCount} slides.
      2. **Slide 1 must be 'hero' variant**: A strong hook/title.
      3. **Last Slide must be 'closing' variant**: A strong takeaway/CTA.
      4. **Middle Slides**: Dynamically choose between 'body' (for concepts/definitions) and 'list' (for strategies/steps) based on the content flow.
      5. **Generate all content in ${outputLanguage}**.
      
      **CRITICAL - Headline Rule**:
      - Generate complete, impactful headlines in the headline field
      - All variants use single-line headlines (no splitting needed)
      - Max headline length varies by variant (see below)
      
      Variant Requirements:
      - 'hero': Needs preHeader, headline, and a short body intro.
          - preHeader (Concise, Max 60 chars).
          - headline (Complete title, Max 50 chars).
          - body (short intro, Max 150 chars).
      - 'body': Needs preHeader, headline, and body text (max 35 words).
          - preHeader (Concise, Max 60 chars).
          - headline (Complete title, Max 50 chars).
          - body (explanation text. Max 250 chars)).
          
      - 'list': Needs preHeader, headline. **CRITICAL**: 'listItems' MUST use the format "Key: Value" (e.g., "Direction: From complex to obvious"). Max 3 items per slide.
          - preHeader (Concise, Max 60 chars).
          - headline (Complete title, Max 50 chars).
          - listItems (Max 3 items) Max 120 chars per item.
      - 'closing': 
          - preHeader (Concise, Max 60 chars)
          - headline (Complete title, Max 50 chars).
          - body (final philosophical statement Max 80 chars).
      
      **ICON SELECTION**:
      - For each slide, suggest a relevant Lucide icon name that visually represents the content
      - Available icons: Lightbulb, Target, TrendingUp, TrendingDown, Zap, Award, CheckCircle, Star, Rocket, Brain, Users, MessageSquare, Shield, Globe, Compass, Heart, Clock, Calendar, Book, Briefcase, DollarSign, BarChart, Layers, Package, Settings, AlertCircle, Info, Sparkles
      - Choose icons that match the slide's theme and message
      - Every slide should have an icon
          
      Return JSON fitting the schema including the Theme.
    `;

    const result = await generateContentFromAgent(prompt, T1_SCHEMA);

    // 🔍 DEBUG: Log raw LLM response
    console.log('🤖 [Template1Agent] RAW LLM Response:', JSON.stringify(result, null, 2));

    // Validate response structure
    if (!result || typeof result !== 'object') {
      console.error('[Template1Agent] Invalid API response:', result);
      throw new Error('API returned invalid response structure');
    }

    // Handle both direct format and Claude's nested format
    const data = result.carousel || result;
    console.log('📦 [Template1Agent] Extracted data:', JSON.stringify(data, null, 2));

    if (!data.slides || !Array.isArray(data.slides)) {
      console.error('[Template1Agent] Missing or invalid slides array:', result);
      console.error('[Template1Agent] Full response:', JSON.stringify(result, null, 2));
      throw new Error('API response missing slides array. Check console for details.');
    }

    // 🔍 DEBUG: Log each slide before processing
    console.log(`📊 [Template1Agent] Processing ${data.slides.length} slides...`);
    data.slides.forEach((s: any, i: number) => {
      console.log(`  Slide ${i + 1}:`, {
        variant: s.variant,
        hasListItems: !!s.listItems,
        listItemsCount: s.listItems?.length || 0,
        listItems: s.listItems,
        headline: s.headline?.substring(0, 30) + '...'
      });
    });

    // Post-processing
    const slides = data.slides.map((s: any, i: number) => {
      // ⚠️ FIX: LLM sometimes returns 'type' instead of 'variant'
      const slideVariant = s.variant || s.type;

      if (s.type && !s.variant) {
        console.warn(`[Template1Agent] Slide ${i + 1}: LLM returned 'type' instead of 'variant', auto-fixing...`);
      }

      return {
        id: `t1-slide-${i}`,
        variant: slideVariant,
        headline: s.headline?.toUpperCase() || '',
        preHeader: s.preHeader?.toUpperCase() || '',
        body: s.body || '',
        listItems: s.listItems || [],
        footer: s.footer || '',
        icon: s.icon || 'Lightbulb'  // Default to Lightbulb if no icon suggested
      };
    });

    // 🔍 DEBUG: Log final processed slides
    console.log('✅ [Template1Agent] Final processed slides:', slides.map(s => ({
      id: s.id,
      variant: s.variant,
      listItemsCount: s.listItems.length,
      hasListItems: s.listItems.length > 0
    })));

    return { slides, theme: data.theme };
  }
};