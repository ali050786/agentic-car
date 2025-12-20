import { useCarouselStore } from '../../store/useCarouselStore';
import { Template1Agent } from './Template1Agent';
import { Template2Agent } from './Template2Agent';
import { Template3Agent } from './Template3Agent';
import { StrategistAgent } from './StrategistAgent';
import { SlideContent, CarouselTheme } from '../../types';
import { generateImage } from '../../services/aiService';
import { storage, config, ID } from '../../lib/appwriteClient';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';

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

    // 2. The Strategist Step (Reasoning)
    console.log('[MainAgent] 🧠 Calling Strategist Agent...');
    store.setGenerationStatus("Strategist Agent: identifying viral angles...");
    store.setGenerationProgress(40);

    let viralAngle = '';

    try {
      // We pass the Vibe (customInstructions) so the Brain knows the goal.
      viralAngle = await StrategistAgent.generateViralAngle(
        effectiveInput,
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

    // Routing Logic: Get slides from appropriate template agent
    if (store.selectedTemplate === 'template-1') {
      result = await Template1Agent.generate(context);
    } else if (store.selectedTemplate === 'template-2') {
      result = await Template2Agent.generate(context);
    } else if (store.selectedTemplate === 'template-3') {
      result = await Template3Agent.generate(context);
    } else {
      result = await Template1Agent.generate(context); // Fallback
    }

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
    // TEMPLATE 3: Orchestrate AI Doodle Generation & Persistence
    // ========================================================================
    if (store.selectedTemplate === 'template-3' && result.slides.length > 0) {
      console.log('[MainAgent] 🎨 Template-3: Starting AI Doodle generation...');

      // Parallel generation with promise tracking
      // We process them one-by-one or in small batches to avoid overloading Rate Limits
      // but update the store immediately as they finish for progressive UX
      const generateDoodles = async () => {
        for (let i = 0; i < result.slides.length; i++) {
          const slide = result.slides[i];
          if (slide.doodlePrompt) {
            try {
              store.setGenerationStatus(`Sketching doodle for slide ${i + 1}...`);

              // 1. Generate via Replicate
              const { imageUrl: replicateUrl } = await generateImage(slide.doodlePrompt);

              // 2. Fetch image blob
              const response = await fetch(replicateUrl);
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
                store.updateSlide(i, { doodleUrl: replicateUrl });
                console.log(`[MainAgent] ⚠️ Doodle ${i + 1} finished but used ephemeral URL (Appwrite Storage not configured):`, replicateUrl);
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