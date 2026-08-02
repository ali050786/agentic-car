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
  const needsDoodles = selectedTemplate === 'template-3' && slides.some(s => ((s as any).doodlePrompt || (s as any).visual?.doodlePrompt) && !((s as any).doodleUrl || (s as any).visual?.doodleUrl) && !(s as any).matchAttempted);
  const needsIcons = selectedTemplate === 'template-1' && slides.some(s => !((s as any).icon || (s as any).visual?.icon));

  if (!needsDoodles && !needsIcons) return;

  console.log('[MainAgent] 🔧 Starting visual asset repair...');
  isRepairing = true;
  store.setGenerationStatus("Optimizing visual assets...");

  try {
    // 1. Check which slides are missing metadata (doodleTopic or icon)
    const { SHARED_ICONS } = await import('../../config/constants');

    const slidesToEnrich = slides.map((s: any, i: number) => ({
      index: i,
      headline: s.headline || s.slots?.headline || '',
      body: s.body || s.slots?.body || '',
      hasIcon: !!(s.icon || s.visual?.icon) && SHARED_ICONS.includes(s.icon || s.visual?.icon),
      hasDoodle: !!(s.doodlePrompt || s.visual?.doodlePrompt)
    })).filter(s => !s.hasIcon || !s.hasDoodle);

    if (slidesToEnrich.length > 0) {
      console.log(`[MainAgent] Enriching ${slidesToEnrich.length} slides with missing visual metadata...`);
      const enrichmentData = await getVisualAssetsForSlides(slidesToEnrich);

      const updatedSlides = [...slides] as any[];
      enrichmentData.forEach((data: any, i: number) => {
        const originalIndex = slidesToEnrich[i].index;
        const target = updatedSlides[originalIndex];
        const newIcon = target.icon || target.visual?.icon || data.icon;
        const newDoodlePrompt = target.doodlePrompt || target.visual?.doodlePrompt ||
          `A black pencil sketch doodle of a ${data.doodleTopic.replace(/_/g, ' ')} isolated on a pure white background (#ffffff) with cross-hatch texture.`;

        updatedSlides[originalIndex] = {
          ...target,
          icon: newIcon,
          doodlePrompt: newDoodlePrompt,
          visual: {
            ...(target.visual || {}),
            icon: newIcon,
            doodlePrompt: newDoodlePrompt,
          }
        };
      });
      store.setSlides(updatedSlides);
    }

    // 2. Trigger doodle matching for any slides that now have prompts but no URLs
    const currentSlides = useCarouselStore.getState().slides as any[];
    const finalSlides = [...currentSlides];
    let changed = false;

    for (let i = 0; i < finalSlides.length; i++) {
      const slide = finalSlides[i];
      const doodlePrompt = slide.doodlePrompt || slide.visual?.doodlePrompt;
      const doodleUrl = slide.doodleUrl || slide.visual?.doodleUrl;
      if (doodlePrompt && !doodleUrl && !slide.matchAttempted) {
        const imageUrl = findMatchingImage(doodlePrompt);
        finalSlides[i] = {
          ...slide,
          doodleUrl: imageUrl || undefined,
          visual: {
            ...(slide.visual || {}),
            doodleUrl: imageUrl || undefined,
          },
          matchAttempted: true // Custom property to prevent infinite loops
        };
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
