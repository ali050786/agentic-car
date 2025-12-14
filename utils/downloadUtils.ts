import { SlideContent, CarouselTheme } from '../types';
import { optimizeSvgForFigma } from './figmaOptimizer';

/**
 * Trigger a download of the SVG file for a specific slide.
 */
export const downloadSvg = async (slide: SlideContent, templateId: string, index: number, theme: CarouselTheme | null) => {
  // Get selectedPattern from carousel store
  const { useCarouselStore } = await import('../store/useCarouselStore');
  const selectedPattern = useCarouselStore.getState().selectedPattern;

  // Use Satori to generate the clean SVG
  const svgString = await optimizeSvgForFigma(slide, theme, templateId, undefined, undefined, selectedPattern);

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `carousel-${templateId}-slide-${index + 1}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Download all slides with a small delay to prevent browser blocking.
 */
export const downloadAllSvgs = async (slides: SlideContent[], templateId: string) => {
  // Dynamic import to avoid circular dependency
  const { useCarouselStore } = await import('../store/useCarouselStore');
  const theme = useCarouselStore.getState().theme;

  for (let i = 0; i < slides.length; i++) {
    await downloadSvg(slides[i], templateId, i, theme);
    // Small delay to prevent browser blocking
    await new Promise(r => setTimeout(r, 300));
  }
};