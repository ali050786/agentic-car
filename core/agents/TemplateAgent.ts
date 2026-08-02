import { generateContentFromAgent } from '../../services/aiService';
import { SlideContent, CarouselTheme } from '../../types';
import { AgentContext } from './agentContext';
import { ALLOWED_DOODLE_TOPICS, SHARED_ICONS } from '../../config/constants';
import { TEMPLATE_CONFIGS, buildPersona } from './agentConfigs';


export const TemplateAgent = {
    generate: async (context: AgentContext, templateId: string): Promise<{ slides: SlideContent[], theme: CarouselTheme }> => {
        const config = TEMPLATE_CONFIGS[templateId] || TEMPLATE_CONFIGS['template-1'];
        const { sourceContent, customInstructions, outputLanguage, slideCount, viralAngle, userMemory, creativeBrief } = context;

        // Build a dynamic persona from the Creative Brief (falls back to static if no brief)
        const persona = buildPersona(creativeBrief, config.persona);
        const illustrationMode = creativeBrief?.visualStyle?.illustrationMode ?? 'METAPHORICAL';


        const contentTypeNote = creativeBrief ? (() => {
            const ct = creativeBrief.contentType;
            const businessOk = creativeBrief.contentStrategy.businessMetaphorsAllowed !== false;
            const lines: string[] = [];
            if (ct === 'EDUCATIONAL') {
                lines.push('CONTENT MODE: EDUCATIONAL — Write like a knowledgeable expert sharing accurate, well-structured information. Cite the data from the strategy. If user preferences request a specific creator style (like Tanmay Bhat), present this accurate educational info using that creator\'s voice, formatting, and tone.');
            } else if (ct === 'EDUTAINMENT') {
                lines.push('CONTENT MODE: EDUTAINMENT — Blend solid information with light humor and accessible language. Energetic but still accurate.');
            } else if (ct === 'STORYTELLING') {
                lines.push('CONTENT MODE: STORYTELLING — Use first-person narrative, emotional beats, concrete scenes. Every slide advances the story.');
            } else if (ct === 'ENTERTAINMENT') {
                lines.push('CONTENT MODE: ENTERTAINMENT — Fun, witty, pop-culture aware. The audience should enjoy reading, not learn a lesson.');
            } else if (ct === 'HOW_TO') {
                lines.push('CONTENT MODE: HOW-TO — Step-by-step, numbered, scannable. No abstract philosophy. Each slide = one actionable step.');
            } else if (ct === 'OPINION') {
                lines.push('CONTENT MODE: OPINION — Bold declarative statements with evidence. First-person allowed. Challenge assumptions.');
            }
            if (!businessOk) {
                lines.push('CRITICAL TONE GUARD: Do NOT use corporate LinkedIn buzzwords, generic growth-hacking templates, or boring "hustle" language. Keep it highly focused on the actual topic. If user preferences request a creator voice like Tanmay Bhat, feel free to use conversational internet slang and vernacular to fit that style, but avoid generic corporate jargon.');
            }
            if (creativeBrief.contentStrategy.stayFactuallyAccurate) {
                lines.push('ACCURACY GUARD: Only state facts that appear in the strategy/angle above. Do NOT fabricate statistics, percentages, or named studies.');
            }
            return lines.join('\n      ');
        })() : '';

        const prompt = `
      You are a ${persona}.

      The Strategy/Angle:
      """
      ${viralAngle || sourceContent}
      """

      ${userMemory ? (() => {
          if (Array.isArray(userMemory) && userMemory.length > 0) {
            return `\n      Known preferences of this user:\n${userMemory.map(n => `      - ${n}`).join('\n')}\n`;
          } else if (typeof userMemory === 'object' && !Array.isArray(userMemory)) {
            const mem = userMemory as any;
            const items = [
              ...(mem.bannedWords || []).map((w: string) => `Banned Word: ${w}`),
              ...(mem.brandRules || []).map((b: string) => `Brand Rule: ${b}`),
              ...(mem.tonePrefs || []).map((t: string) => `Tone Pref: ${t}`),
              ...(mem.pastDecisions || []).map((d: string) => `Preference: ${d}`),
            ];
            return items.length > 0 ? `\n      Known preferences of this user:\n${items.map(n => `      - ${n}`).join('\n')}\n` : '';
          }
          return '';
      })() : ''}
      ${contentTypeNote ? `\n      ════════════════════════════════\n      CONTENT & TONE RULES\n      ════════════════════════════════\n      ${contentTypeNote}\n` : ''}
      ════════════════════════════════════════════════════════════════════════
      !! SLIDE COUNT — NON-NEGOTIABLE !!
      ════════════════════════════════════════════════════════════════════════
      You MUST produce EXACTLY ${slideCount} slides. Not fewer. Not more.
      The "slides" array in your JSON MUST have exactly ${slideCount} items.
      If you run low on specific points, add nuance, elaboration, or a
      supporting evidence slide — but DO NOT stop before ${slideCount} slides.
      ════════════════════════════════════════════════════════════════════════

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
      ${!creativeBrief ? `
      Extra angle hints (only apply if no brief overrides):
      - If the Angle is 'Contrarian', be bold and direct.
      - If 'Story', use first-person statements.` : ''}
      
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
        2. A Metaphorical Doodle Topic: choose from [${ALLOWED_DOODLE_TOPICS.join(', ')}]
      - These should visually represent the slide's core message. 
      - icon: used for industrial/clean templates.
      - doodleTopic: used for sketchy/hand-drawn templates.
          
      FINAL REMINDER: Your JSON "slides" array MUST contain EXACTLY ${slideCount} items.
      Return JSON fitting the schema including the Theme.
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

        if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
            console.error(`[TemplateAgent] Missing or empty slides array for ${templateId}:`, result);
            throw new Error('API response returned 0 slides.');
        }

        const keepCase = 
            templateId === 'template-1' || templateId === 'template1' ||
            templateId === 'template-3' || templateId === 'template3' ||
            templateId === 'template-4' || templateId === 'template4';
        const slides = data.slides.map((s: any, i: number) => {
            const rawType = s.blockType || s.variant || s.type || 'body';
            const blockType = rawType === 'cta' ? 'closing' : rawType;

            const headline = keepCase ? (s.headline || '') : (s.headline || '').toUpperCase();
            const preHeader = (s.preHeader || '').toUpperCase();
            const body = s.body || '';
            const listItems = s.listItems || [];
            const footer = s.footer || '';
            const accentPhrase = s.accentPhrase || undefined;
            const icon = s.icon || config.defaultIcon;
            const doodlePrompt = s.doodleTopic ? buildDoodlePrompt(s.doodleTopic, illustrationMode) : undefined;

            return {
                id: `${templateId}-slide-${i}`,
                blockType,
                variant: blockType,
                headline,
                preHeader,
                body,
                listItems,
                footer,
                accentPhrase,
                icon,
                doodlePrompt,
                slots: {
                    headline,
                    preHeader,
                    body,
                    listItems,
                    footer,
                    accentPhrase,
                    statNumber: s.statNumber || undefined,
                    statLabel: s.statLabel || undefined,
                    quoteAuthor: s.quoteAuthor || undefined,
                    splitLeft: s.splitLeft || undefined,
                    splitRight: s.splitRight || undefined,
                },
                visual: {
                    icon,
                    doodlePrompt,
                }
            };
        });

        return { slides, theme: data.theme };
    }
};

// ---------------------------------------------------------------------------
// Doodle prompt builder — adapts the Replicate prompt to the illustration mode
// ---------------------------------------------------------------------------
function buildDoodlePrompt(doodleTopic: string, illustrationMode: string): string {
    const subject = doodleTopic.replace(/_/g, ' ');

    switch (illustrationMode) {
        case 'LITERAL':
            // Draw the actual subject matter precisely (educational carousels)
            return `precise editorial spot illustration of ${subject}, accurate scientific or historical depiction, clean black ink line art, monochrome, detailed but minimal, magazine-quality, isolated on plain white background, no text, no abstract metaphors`;

        case 'CHARACTER':
            // Expressive cartoon character scene (entertainment / edutainment)
            return `expressive cartoon character illustration of ${subject}, bold cheerful line art, dynamic pose, fun and energetic style, monochrome black ink, clear silhouette, isolated on plain white background, no text`;

        case 'METAPHORICAL':
        default:
            // Original behavior: abstract business metaphor (professional carousels)
            return `minimal editorial spot illustration of a ${subject}, loose confident black ink line art, monochrome black ink only, elegant magazine spot illustration style, isolated on a plain white background, no text`;
    }
}

