import { useCarouselStore } from '../../store/useCarouselStore';
import { TemplateAgent } from './TemplateAgent';
import { StrategistAgent } from './StrategistAgent';
import { ResearchAgent } from './ResearchAgent';
import { SlideContent, CarouselTheme } from '../../types';
import { generateImage } from '../../services/aiService';
import { storage, config, ID } from '../../lib/appwriteClient';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { findMatchingImage } from '../../utils/imageMatcher';

// Context object for AI agents
export interface AgentContext {
  inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf';
  sourceContent: string;
  customInstructions?: string;
  outputLanguage: string;
  slideCount: number;
  viralAngle?: string; // New field for the Strategist's output
}

export const runAgentWorkflow = async (topic: string) => {
  const store = useCarouselStore.getState();

  if (!topic && !store.sourceContent) return;

  store.setGenerating(true);
  store.setError(null);
  store.setSlides([]); // Clear previous slides
  store.setGenerationProgress(10);
  store.setGenerationStatus("Initializing AI Agents...");

  try {
    // 1. Detect Input Type & Prepare Content
    const effectiveInput = store.sourceContent || topic;
    const inputType = effectiveInput.length > 500 ? 'CONTEXT' : 'TOPIC';

    // Update status based on input type
    if (store.inputMode === 'url') {
      store.setGenerationStatus("Reading article & extracting key points...");
    } else if (store.inputMode === 'pdf') {
      store.setGenerationStatus("Analyzing document structure...");
    } else {
      store.setGenerationStatus("Analyzing topic & context...");
    }
    store.setGenerationProgress(25);

    // Simulate a small delay for readability
    await new Promise(r => setTimeout(r, 800));

    // 2. Invisible Research Layer (Pre-Strategist)
    console.log('[MainAgent] 🔍 Initiating Research Layer...');
    store.setGenerationStatus("🤖 Analyzing content density & needs...");

    let researchAnalysis;
    try {
      researchAnalysis = await ResearchAgent.analyzeInputNeeds(effectiveInput);
      console.log('[MainAgent] 📊 Research Analysis Result:', researchAnalysis);
    } catch (err) {
      console.error('[MainAgent] ❌ Research analysis failed:', err);
      // Fallback to NONE so we don't break the whole workflow
      researchAnalysis = { strategy: 'NONE', reasoning: 'Research analysis failed, skipping.', searchQueries: [] };
    }

    let finalContent = effectiveInput;

    if (researchAnalysis.strategy === 'EXPLORATORY') {
      store.setGenerationStatus("🧪 Topic is brief. Deep diving for trends & data...");
    } else if (researchAnalysis.strategy === 'CONTEXTUAL') {
      store.setGenerationStatus("🔍 Draft detected. Fact-checking & finding stats...");
    } else if (researchAnalysis.strategy === 'NONE') {
      store.setGenerationStatus("⚡ Content is complete. Proceeding to strategy...");
    }

    if (researchAnalysis.strategy !== 'NONE') {
      console.log('[MainAgent] 🌍 Triggering research for queries:', researchAnalysis.searchQueries);
      const researchData = await ResearchAgent.performResearch(researchAnalysis.searchQueries);
      store.setGenerationStatus("🌍 Reading search results...");
      finalContent += researchData;
      console.log('[MainAgent] ✅ Research enrichment complete. Added:', researchData.length, 'chars');
    }

    // 3. The Strategist Step (Reasoning)
    console.log('[MainAgent] 🧠 Calling Strategist Agent...');
    store.setGenerationStatus("Strategist Agent: identifying viral angles...");
    store.setGenerationProgress(40);

    let viralAngle = '';

    try {
      // We pass the Vibe (customInstructions) so the Brain knows the goal.
      viralAngle = await StrategistAgent.generateViralAngle(
        finalContent,
        inputType,
        store.customInstructions || ''
      );
    } catch (err) {
      console.error('[MainAgent] Strategist Agent failed, falling back to raw input:', err);
      // Fallback: If Strategist fails, use the raw input as the "angle" to keep going
      viralAngle = `Topic/Context: ${effectiveInput}`;
    }

    // Build context object
    const context: AgentContext = {
      inputMode: store.inputMode,
      sourceContent: store.sourceContent || topic,
      customInstructions: store.customInstructions,
      outputLanguage: store.outputLanguage,
      slideCount: store.slideCount,
      viralAngle: viralAngle,
    };

    console.log('[MainAgent] Context prepared:', { ...context, sourceContent: '[Truncated]' });

    store.setGenerationStatus("Designing slides & writing copy...");
    store.setGenerationProgress(70);

    let result: { slides: SlideContent[], theme: CarouselTheme };

    // Routing Logic: Use the unified TemplateAgent for all templates
    result = await TemplateAgent.generate(context, store.selectedTemplate || 'template-1');

    // ========================================================================
    // THEME OVERRIDE: Use preset-based theme instead of AI-generated theme
    // ========================================================================

    const { presetId } = store;

    // Get the active preset (default to 'ocean-tech' if none selected)
    const preset = getPresetById(presetId || 'ocean-tech');

    if (preset) {
      // Override AI theme with locally calculated theme based on preset
      const localTheme = resolveTheme(preset.seeds, store.selectedTemplate);
      result.theme = localTheme;

      console.log(`[MainAgent] Theme overridden with preset: ${preset.name}`);
    } else {
      console.warn(`[MainAgent] Preset not found: ${presetId}, using AI theme`);
    }

    store.setGenerationStatus("Finalizing design & theme...");
    store.setGenerationProgress(90);

    // Save slides and theme to store
    store.setSlides(result.slides);
    store.setTheme(result.theme);

    // ========================================================================
    // VISUAL ASSETS: Orchestrate AI Doodle Generation & Persistence
    // ========================================================================
    if (result.slides.length > 0) {
      console.log('[MainAgent] 🎨 Starting visual asset processing...');

      // Parallel generation with promise tracking
      const generateDoodles = async () => {
        // Only trigger if at least one slide needs a doodleUrl
        const needsDoodles = result.slides.some(s => s.doodlePrompt && !s.doodleUrl);
        if (!needsDoodles) return;

        for (let i = 0; i < result.slides.length; i++) {
          const slide = result.slides[i];
          if (slide.doodlePrompt && !slide.doodleUrl) {
            try {
              store.setGenerationStatus(`Sketching doodle for slide ${i + 1}...`);

              let imageUrl: string | null = null;

              // 1. Try to find in local library first
              imageUrl = findMatchingImage(slide.doodlePrompt);

              if (imageUrl) {
                console.log(`[MainAgent] 📚 Found matching image in library for: "${slide.doodlePrompt}"`);
                store.updateSlide(i, { doodleUrl: imageUrl });
              } else {
                console.warn(`[MainAgent] ⚠️ No match in library for Template-3 prompt: "${slide.doodlePrompt}". Skipping.`);
                // We no longer fallback to Replicate for Template-3
              }
              continue; // Skip the rest of the loop (upload logic)

              const response = await fetch(imageUrl!);
              const blob = await response.blob();

              // 3. Persist to Appwrite Storage
              if (config.storageBucketId) {
                const file = new File([blob], `doodle-${ID.unique()}.webp`, { type: 'image/webp' });
                const appwriteResponse = await storage.createFile(
                  config.storageBucketId,
                  ID.unique(),
                  file
                );

                // 4. Get permanent view URL
                const permanentUrl = storage.getFileView(
                  config.storageBucketId,
                  appwriteResponse.$id
                ).toString();

                // 5. Update slide in store
                store.updateSlide(i, { doodleUrl: permanentUrl });
                console.log(`[MainAgent] ✅ Doodle ${i + 1} finalized and saved to Appwrite:`, permanentUrl);
              } else {
                // Fallback: Use Replicate URL directly if Storage is not configured
                store.updateSlide(i, { doodleUrl: imageUrl });
                console.log(`[MainAgent] ⚠️ Doodle ${i + 1} finished but used ephemeral URL (Appwrite Storage not configured):`, imageUrl);
              }
            } catch (err) {
              console.error(`[MainAgent] Failed to generate doodle for slide ${i + 1}:`, err);
            }
          }
        }
      };

      // Run in background but don't block the "Done!" status
      generateDoodles();
    }

    // Complete
    store.setGenerationProgress(100);
    store.setGenerationStatus("Done!");

  } catch (err: any) {
    console.error(err);
    store.setError(err.message || "Failed to generate carousel.");
  } finally {
    store.setGenerating(false);
  }
};

let isRepairing = false;

/**
 * Repairs missing visual assets (icons or doodleTopics) for existing slides.
 * Uses a single lightweight AI call to enrich the slide metadata.
 */
export const repairVisualAssets = async () => {
  if (isRepairing) return;

  const store = useCarouselStore.getState();
  const { slides, selectedTemplate } = store;

  if (slides.length === 0) return;

  // Check if repair is actually needed
  // Only repair if T3 and missing doodleUrl, OR if T1/T2 and missing icon
  const needsDoodles = selectedTemplate === 'template-3' && slides.some(s => s.doodlePrompt && !s.doodleUrl && !(s as any).matchAttempted);
  const needsIcons = (selectedTemplate === 'template-1' || selectedTemplate === 'template-2') && slides.some(s => !s.icon);

  if (!needsDoodles && !needsIcons) return;

  console.log('[MainAgent] 🔧 Starting visual asset repair...');
  isRepairing = true;
  store.setGenerationStatus("Optimizing visual assets...");

  try {
    // 1. Check which slides are missing metadata (doodleTopic or icon)
    const { SHARED_ICONS } = await import('../../config/constants');

    const slidesToEnrich = slides.map((s, i) => ({
      index: i,
      headline: s.headline,
      body: s.body,
      hasIcon: !!s.icon && SHARED_ICONS.includes(s.icon),
      hasDoodle: !!s.doodlePrompt
    })).filter(s => !s.hasIcon || !s.hasDoodle);

    if (slidesToEnrich.length > 0) {
      console.log(`[MainAgent] Enriching ${slidesToEnrich.length} slides with missing visual metadata...`);
      const enrichmentData = await getVisualAssetsForSlides(slidesToEnrich);

      const updatedSlides = [...slides];
      enrichmentData.forEach((data: any, i: number) => {
        const originalIndex = slidesToEnrich[i].index;
        updatedSlides[originalIndex] = {
          ...updatedSlides[originalIndex],
          icon: updatedSlides[originalIndex].icon || data.icon,
          doodlePrompt: updatedSlides[originalIndex].doodlePrompt ||
            `A black pencil sketch doodle of a ${data.doodleTopic.replace(/_/g, ' ')} isolated on a pure white background (#ffffff) with cross-hatch texture.`
        };
      });
      store.setSlides(updatedSlides);
    }

    // 2. Trigger doodle matching for any slides that now have prompts but no URLs
    const currentSlides = useCarouselStore.getState().slides;
    const finalSlides = [...currentSlides];
    let changed = false;

    for (let i = 0; i < finalSlides.length; i++) {
      const slide = finalSlides[i];
      if (slide.doodlePrompt && !slide.doodleUrl && !(slide as any).matchAttempted) {
        const imageUrl = findMatchingImage(slide.doodlePrompt);
        finalSlides[i] = {
          ...slide,
          doodleUrl: imageUrl || undefined,
          matchAttempted: true // Custom property to prevent infinite loops
        } as any;
        changed = true;
      }
    }

    if (changed) {
      store.setSlides(finalSlides);
    }

    store.setGenerationStatus("Visuals updated!");
  } catch (err) {
    console.error('[MainAgent] Visual asset repair failed:', err);
  } finally {
    isRepairing = false;
    setTimeout(() => store.setGenerationStatus("Done!"), 1000);
  }
};

/**
 * Lightweight AI call to get visual metadata for slides
 */
async function getVisualAssetsForSlides(slides: any[]) {
  const { ALLOWED_DOODLE_TOPICS, SHARED_ICONS } = await import('../../config/constants');
  const { generateContentFromAgent } = await import('../../services/aiService');

  const prompt = `
        Analyze these carousel slides and for each one, pick the most relevant Lucide icon and Doodle topic.
        
        Slides:
        ${slides.map((s, i) => `${i + 1}. Headline: ${s.headline}, Body: ${s.body}`).join('\n')}

        Constraints:
        - icon: Pick from [${SHARED_ICONS.join(', ')}]
        - doodleTopic: Pick from [${ALLOWED_DOODLE_TOPICS.join(', ')}]

        Return a JSON object with a "results" array containing objects with {icon, doodleTopic}.
    `;

  const schema = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            icon: { type: 'string', enum: SHARED_ICONS },
            doodleTopic: { type: 'string', enum: ALLOWED_DOODLE_TOPICS }
          },
          required: ['icon', 'doodleTopic']
        }
      }
    },
    required: ['results']
  };

  const result = await generateContentFromAgent(prompt, schema);
  return result.results;
}