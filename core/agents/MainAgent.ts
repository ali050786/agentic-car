import { useCarouselStore } from '../../store/useCarouselStore';
import { TemplateAgent } from './TemplateAgent';
import { StrategistAgent } from './StrategistAgent';
import { ArtDirectorAgent } from './ArtDirectorAgent';
import { ResearchAgent } from './ResearchAgent';
import { ProofreaderAgent } from './ProofreaderAgent';
import { SlideContent, CarouselTheme } from '../../types';
import { generateImage } from '../../services/aiService';
import { storage, config, ID } from '../../lib/appwriteClient';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { findMatchingImage } from '../../utils/imageMatcher';
import { getUserMemory } from '../../services/memoryService';
import { polishSlides } from '../../utils/contentPolish';

/**
 * Replicate throttles low-credit accounts hard (as low as 1 request burst),
 * so retry 429s honoring the retry_after it reports. There is no rush —
 * doodles arrive in the background after the content is already visible.
 */
const generateImageWithRetry = async (
  prompt: string,
  aspectRatio: string,
  maxAttempts: number = 5
): Promise<{ imageUrl: string; imageBase64?: string | null }> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await generateImage(prompt, aspectRatio);
    } catch (err: any) {
      const msg = String(err?.message || err);
      const throttled = msg.includes('429') || msg.includes('throttled');
      if (!throttled || attempt >= maxAttempts) throw err;

      const retryMatch = msg.match(/retry_after\\?":\s*(\d+)/);
      const waitSeconds = (retryMatch ? parseInt(retryMatch[1], 10) : 10) + 2;
      console.warn(`[MainAgent] Replicate throttled (attempt ${attempt}/${maxAttempts}), retrying in ${waitSeconds}s...`);
      await new Promise(r => setTimeout(r, waitSeconds * 1000));
    }
  }
};

// Context object for AI agents
export interface AgentContext {
  inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf';
  sourceContent: string;
  customInstructions?: string;
  outputLanguage: string;
  slideCount: number;
  viralAngle?: string; // New field for the Strategist's output
  userMemory?: string[]; // Durable cross-carousel preferences (memoryService)
}

export const runAgentWorkflow = async (topic: string) => {
  const store = useCarouselStore.getState();

  if (!topic && !store.sourceContent) return;

  // Re-entrancy guard: a second overlapping call (double-click, double-submit
  // race) would otherwise run the whole pipeline twice and autosave would
  // dutifully persist each result as its own carousel.
  if (store.isGenerating) {
    console.warn('[MainAgent] runAgentWorkflow called while already generating — ignoring duplicate trigger');
    return;
  }

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
    } else if (store.inputMode === 'video') {
      store.setGenerationStatus("Analyzing video transcript...");
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
      userMemory: getUserMemory(),
    };

    console.log('[MainAgent] Context prepared:', { ...context, sourceContent: '[Truncated]' });

    store.setGenerationStatus("Designing slides & writing copy...");
    store.setGenerationProgress(70);

    let result: { slides: SlideContent[], theme: CarouselTheme };

    // Routing Logic: Use the unified TemplateAgent for all templates
    result = await TemplateAgent.generate(context, store.selectedTemplate || 'template-1');

    // ========================================================================
    // QUALITY PASS: deterministic cleanup, then an LLM proofread, then cleanup
    // again (idempotent — normalizes whatever the proofreader produced). The
    // proofreader never throws; a failed pass just leaves the polished copy.
    // ========================================================================
    result.slides = polishSlides(result.slides);
    store.setGenerationStatus("Proofreading copy...");
    result.slides = await ProofreaderAgent.proofread(result.slides);
    result.slides = polishSlides(result.slides);

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
    // VISUAL ASSETS: Agentic Doodle Pipeline (Template-3 only)
    // Content is already in the store; this runs in the background:
    // library placeholder → Art Director prompts → Replicate flux →
    // Appwrite Storage persistence → slide update (display)
    // ========================================================================
    if (result.slides.length > 0 && store.selectedTemplate === 'template-3') {
      console.log('[MainAgent] 🎨 Starting visual asset processing...');

      const generateDoodles = async () => {
        const slides = result.slides;

        // Mark all slides as awaiting their AI doodle so the UI can show an indicator
        store.setPendingDoodleSlides(slides.map((_, i) => i));

        // STEP 1: Instant placeholders from the pre-rendered library while flux works
        slides.forEach((slide, i) => {
          if (slide.doodlePrompt && !slide.doodleUrl) {
            const placeholder = findMatchingImage(slide.doodlePrompt);
            if (placeholder) {
              store.updateSlide(i, { doodleUrl: placeholder });
              console.log(`[MainAgent] 📚 Placeholder from library for slide ${i + 1}`);
            }
          }
        });

        // STEP 2: Art Director writes one tailored flux prompt per slide
        let fluxPrompts: string[];
        try {
          store.setGenerationStatus('🎨 Art Director: designing sketches...');
          fluxPrompts = await ArtDirectorAgent.generatePrompts(slides, context.viralAngle || context.sourceContent);
        } catch (err) {
          console.error('[MainAgent] Art Director failed, falling back to topic prompts:', err);
          fluxPrompts = slides.map(s => s.doodlePrompt || '');
        }

        // STEPS 3-5: Generate → persist → display, one slide at a time
        for (let i = 0; i < slides.length; i++) {
          const fluxPrompt = fluxPrompts[i];
          if (!fluxPrompt) {
            store.removePendingDoodleSlide(i);
            continue;
          }

          try {
            store.setGenerationStatus(`✏️ Sketching doodle ${i + 1}/${slides.length}...`);

            // 3. Generate via Replicate flux (2:3 matches the 600x1000 slot in the template)
            // imageBase64 carries the bytes because replicate.delivery blocks browser CORS fetches
            const { imageUrl, imageBase64 } = await generateImageWithRetry(fluxPrompt, '2:3');

            // 4. Persist to Appwrite Storage (Replicate URLs expire after ~1 hour).
            // If persistence fails we still display the ephemeral URL below.
            let finalUrl = imageUrl;
            if (config.storageBucketId && imageBase64) {
              try {
                // Decode manually — fetch(data:...) is blocked by the app's CSP connect-src
                const binary = atob(imageBase64.split(',')[1]);
                const bytes = new Uint8Array(binary.length);
                for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
                const blob = new Blob([bytes], { type: 'image/webp' });
                const file = new File([blob], `doodle-${ID.unique()}.webp`, { type: 'image/webp' });
                const uploaded = await storage.createFile(config.storageBucketId, ID.unique(), file);
                finalUrl = storage.getFileView(config.storageBucketId, uploaded.$id).toString();
                console.log(`[MainAgent] ✅ Doodle ${i + 1} saved to Appwrite:`, finalUrl);
              } catch (persistErr) {
                console.error(`[MainAgent] ⚠️ Doodle ${i + 1} upload failed, using ephemeral URL:`, persistErr);
              }
            } else {
              console.warn(`[MainAgent] ⚠️ Doodle ${i + 1} using ephemeral URL (missing bucket config or image bytes)`);
            }

            // 5. Display: updating the slide re-renders it with the new image
            store.updateSlide(i, { doodleUrl: finalUrl, doodlePrompt: fluxPrompt });
          } catch (err) {
            // Keep the library placeholder (or built-in fallback) — never break the carousel
            console.error(`[MainAgent] Failed to generate doodle for slide ${i + 1}, keeping placeholder:`, err);
          } finally {
            store.removePendingDoodleSlide(i);
          }
        }

        store.setPendingDoodleSlides([]);
        store.setGenerationStatus('Done!');
      };

      // Run in background but don't block the "Done!" status
      generateDoodles().catch(err => {
        console.error('[MainAgent] Doodle pipeline failed:', err);
        store.setPendingDoodleSlides([]);
      });
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