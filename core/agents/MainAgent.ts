import { useCarouselStore } from '../../store/useCarouselStore';
import { Template1Agent } from './Template1Agent';
import { Template2Agent } from './Template2Agent';
import { SlideContent, CarouselTheme } from '../../types';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';

export const runAgentWorkflow = async (topic: string) => {
  const store = useCarouselStore.getState();

  if (!topic) return;

  store.setGenerating(true);
  store.setError(null);

  try {
    let result: { slides: SlideContent[], theme: CarouselTheme };

    // Routing Logic: Get slides from appropriate template agent
    if (store.selectedTemplate === 'template-1') {
      result = await Template1Agent.generate(topic);
    } else if (store.selectedTemplate === 'template-2') {
      result = await Template2Agent.generate(topic);
    } else {
      result = await Template1Agent.generate(topic); // Fallback
    }

    // ========================================================================
    // THEME OVERRIDE: Use preset-based theme instead of AI-generated theme
    // ========================================================================

    const { activePresetId } = store;

    // Get the active preset (default to 'ocean-tech' if none selected)
    const preset = getPresetById(activePresetId || 'ocean-tech');

    if (preset) {
      // Override AI theme with locally calculated theme based on preset
      const localTheme = resolveTheme(preset.seeds, store.selectedTemplate);
      result.theme = localTheme;

      console.log(`[MainAgent] Theme overridden with preset: ${preset.name}`);
    } else {
      console.warn(`[MainAgent] Preset not found: ${activePresetId}, using AI theme`);
    }

    // Save slides and theme to store
    store.setSlides(result.slides);
    store.setTheme(result.theme);

  } catch (err: any) {
    console.error(err);
    store.setError(err.message || "Failed to generate carousel.");
  } finally {
    store.setGenerating(false);
  }
};