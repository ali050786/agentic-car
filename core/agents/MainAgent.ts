import { useCarouselStore } from '../../store/useCarouselStore';
import { findMatchingImage } from '../../utils/imageMatcher';

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
  // Only repair if T3 and missing doodleUrl, OR if T1 and missing icon
  const needsDoodles = selectedTemplate === 'template-3' && slides.some(s => s.doodlePrompt && !s.doodleUrl && !(s as any).matchAttempted);
  const needsIcons = selectedTemplate === 'template-1' && slides.some(s => !s.icon);

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
