import { useCarouselStore } from '../../store/useCarouselStore';
import { Template1Agent } from './Template1Agent';
import { Template2Agent } from './Template2Agent';
import { SlideContent, CarouselTheme } from '../../types';

export const runAgentWorkflow = async (topic: string) => {
  const store = useCarouselStore.getState();
  
  if (!topic) return;

  store.setGenerating(true);
  store.setError(null);

  try {
    let result: { slides: SlideContent[], theme: CarouselTheme };

    // Routing Logic
    if (store.selectedTemplate === 'template-1') {
      result = await Template1Agent.generate(topic);
    } else if (store.selectedTemplate === 'template-2') {
      result = await Template2Agent.generate(topic);
    } else {
      result = await Template1Agent.generate(topic); // Fallback
    }

    store.setSlides(result.slides);
    store.setTheme(result.theme);
    
  } catch (err: any) {
    console.error(err);
    store.setError(err.message || "Failed to generate carousel.");
  } finally {
    store.setGenerating(false);
  }
};