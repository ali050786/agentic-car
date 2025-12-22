import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent, CarouselTheme } from '../../types';
import { AgentContext } from './MainAgent';
import { ALLOWED_DOODLE_TOPICS, SHARED_ICONS } from '../../config/constants';
import { TEMPLATE_CONFIGS } from './agentConfigs';

export const TemplateAgent = {
    generate: async (context: AgentContext, templateId: string): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
        const config = TEMPLATE_CONFIGS[templateId] || TEMPLATE_CONFIGS['template-1'];
        const { sourceContent, customInstructions, outputLanguage, slideCount, viralAngle } = context;

        const prompt = `
      You are a ${config.persona}. 
      
      
      The Strategy/Angle: 
      """
      ${viralAngle || sourceContent}
      """
      
      User Constraints: ${customInstructions || 'None'}
      
      Task: Write a ${slideCount}-slide carousel.
      
      Critical: 
      - Do NOT write generic advice. 
      - Stick strictly to the provided Angle. 
      - If the Angle is 'Contrarian', be aggressive. 
      - If 'Story', use 'I' statements.
      
      ═══════════════════════════════════════════════════════════════════════
      CRITICAL INSTRUCTION - SOURCE MATERIAL ADHERENCE
      ═══════════════════════════════════════════════════════════════════════
      If Reference Material is provided above/in the angle, you MUST:
      - STRICTLY base the carousel content on that material
      - Extract key points, facts, and narratives directly from the source
      - Do NOT hallucinate or add outside facts unless absolutely necessary to fill gaps
      
      Design Constraints for Content:
      ${config.designConstraints}
      
      Instructions:
      1. Create a comprehensive narrative with EXACTLY ${slideCount} slides.
      2. **Slide 1 must be 'hero' variant**.
      3. **Last Slide must be 'closing' variant**.
      4. **Middle Slides**: Dynamically mix 'body' and 'list' variants based on content flow.
      5. **Generate all content in ${outputLanguage}**.
      
      **CRITICAL - Headline Rule**:
      - Generate complete, impactful headlines in the headline field
      - All variants use single-line headlines (no splitting needed)
      - Max headline length varies by variant (see below)
      
      Variant Requirements:
      - 'hero': ${config.variantRequirements.hero}
      - 'body': ${config.variantRequirements.body}
      - 'list': ${config.variantRequirements.list}
      - 'closing': ${config.variantRequirements.closing}
      
      **VISUAL ASSETS SELECTION**:
      - For each slide, you MUST suggest BOTH:
        1. A Lucide icon name: choose from [${SHARED_ICONS.join(', ')}]
        2. A Metaforical Doodle Topic: choose from [${ALLOWED_DOODLE_TOPICS.join(', ')}]
      - These should visually represent the slide's core message. 
      - icon: used for industrial/clean templates.
      - doodleTopic: used for sketchy/hand-drawn templates.
          
      Return JSON fitting the schema including the Theme. Ensure the slides are in an array named "slides" at the root or within a "carousel" object.
    `;

        console.log(`🤖 [TemplateAgent] Using config for: ${templateId}`);
        const result = await generateContentFromAgent(prompt, config.schema);

        // 🔍 DEBUG: Log raw LLM response
        console.log(`🤖 [TemplateAgent] RAW LLM Response for ${templateId}:`, JSON.stringify(result, null, 2));

        // Validate response structure
        if (!result || typeof result !== 'object') {
            console.error(`[TemplateAgent] Invalid API response for ${templateId}:`, result);
            throw new Error('API returned invalid response structure');
        }

        // Handle both direct format and Claude's nested format
        // Some models wrap everything in a 'carousel' or 'data' object
        let data = result;
        if (result.carousel && Array.isArray(result.carousel.slides)) {
            data = result.carousel;
        } else if (result.carousel && Array.isArray(result.carousel)) {
            // Case where result.carousel IS the slides array
            data = { slides: result.carousel, theme: result.theme };
        } else if (result.data && result.data.slides) {
            data = result.data;
        }

        if (!data.slides || !Array.isArray(data.slides)) {
            console.error(`[TemplateAgent] Missing or invalid slides array for ${templateId}:`, result);
            throw new Error('API response missing slides array.');
        }

        // Post-processing
        const slides = data.slides.map((s: any, i: number) => {
            const slideVariant = s.variant || s.type;

            return {
                id: `${templateId}-slide-${i}`,
                variant: slideVariant,
                headline: (s.headline || '').toUpperCase(),
                preHeader: (s.preHeader || '').toUpperCase(),
                body: s.body || '',
                listItems: s.listItems || [],
                footer: s.footer || '',
                icon: s.icon || config.defaultIcon,
                doodlePrompt: s.doodleTopic ? `A black pencil sketch doodle of a ${s.doodleTopic.replace(/_/g, ' ')} isolated on a pure white background (#ffffff) with cross-hatch texture.` : undefined
            };
        });

        return { slides, theme: data.theme };
    }
};
