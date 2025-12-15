import { generateContentFromAgent } from '../../services/geminiService';
import { SlideContent, CarouselTheme } from '../../types';
import { AgentContext } from './MainAgent';

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

export const Template2Agent = {
  id: 'template-2',
  name: 'The Clarity',

  generate: async (context: AgentContext): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
    const { inputMode, sourceContent, customInstructions, outputLanguage, slideCount } = context;

    const prompt = `
      You are the "Clarity" Agent. You create modern, tech-forward LinkedIn carousels.
      
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
      - Tone: Educational, professional, clean, optimistic.
      - **Color Design System**: You MUST generate a palette matching these exact variables:
        1. background: Main dark background.
        2. textHighlight: Bright accent color for keywords and buttons.
        3. background2: Secondary accent color for architectural elements (arches).
        4. textDefault: Usually white or off-white.
        5. bgGradStart & bgGradEnd: Colors for the subtle radial gradient overlay.
      
      Instructions:
      1. Create a helpful, educational guide with EXACTLY ${slideCount} slides.
      2. **Slide 1 must be 'hero' variant**.
      3. **Last Slide must be 'closing' variant**.
      4. **Middle Slides**: Mix 'body' (for explanations) and 'list' (for actionable steps).
      5. **Generate all content in ${outputLanguage}**.
      
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
      
      **ICON SELECTION**:
      - For each slide, suggest a relevant Lucide icon name that visually represents the content
      - Available icons: Lightbulb, Target, TrendingUp, TrendingDown, Zap, Award, CheckCircle, Star, Rocket, Brain, Users, MessageSquare, Shield, Globe, Compass, Heart, Clock, Calendar, Book, Briefcase, DollarSign, BarChart, Layers, Package, Settings, AlertCircle, Info, Sparkles
      - Choose icons that match the slide's theme and message
      - Every slide should have an icon
          
      Return JSON fitting the schema including the Theme.
    `;

    const result = await generateContentFromAgent(prompt, T2_SCHEMA);

    // 🔍 DEBUG: Log raw LLM response
    console.log('🤖 [Template2Agent] RAW LLM Response:', JSON.stringify(result, null, 2));

    // Validate response structure
    if (!result || typeof result !== 'object') {
      console.error('[Template2Agent] Invalid API response:', result);
      throw new Error('API returned invalid response structure');
    }

    // Handle both direct format and Claude's nested format
    const data = result.carousel || result;
    console.log('📦 [Template2Agent] Extracted data:', JSON.stringify(data, null, 2));

    if (!data.slides || !Array.isArray(data.slides)) {
      console.error('[Template2Agent] Missing or invalid slides array:', result);
      console.error('[Template2Agent] Full response:', JSON.stringify(result, null, 2));
      throw new Error('API response missing slides array. Check console for details.');
    }

    // 🔍 DEBUG: Log each slide before processing
    console.log(`📊 [Template2Agent] Processing ${data.slides.length} slides...`);
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
        console.warn(`[Template2Agent] Slide ${i + 1}: LLM returned 'type' instead of 'variant', auto-fixing...`);
      }

      return {
        id: `t2-slide-${i}`,
        variant: slideVariant,
        headline: s.headline || '',
        preHeader: s.preHeader || '',
        body: s.body || '',
        listItems: s.listItems || [],
        footer: s.footer || '',
        icon: s.icon || 'Lightbulb'  // Default to Lightbulb if no icon suggested
      };
    });

    // 🔍 DEBUG: Log final processed slides
    console.log('✅ [Template2Agent] Final processed slides:', slides.map(s => ({
      id: s.id,
      variant: s.variant,
      listItemsCount: s.listItems.length,
      hasListItems: s.listItems.length > 0
    })));

    return { slides, theme: data.theme };
  }
};