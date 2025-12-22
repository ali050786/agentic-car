import { SlideContent, CarouselTheme, CarouselFormat, BrandingConfig } from '../types';
import { generateTemplate1Native } from './optimizers/template1Optimizer';
import { generateTemplate2Native } from './optimizers/template2Optimizer';
import { generateTemplate3Native } from './optimizers/template3Optimizer';

/**
 * Entry point for generating Figma-compatible SVGs.
 * Avoids foreignObject and uses native SVG elements only.
 */
export const optimizeSvgForFigma = async (
  slide: SlideContent,
  theme: CarouselTheme | null,
  templateId: string,
  format?: CarouselFormat,
  branding?: BrandingConfig,
  patternId?: number,
  patternOpacity?: number,
  patternScale?: number,
  patternSpacing?: number
): Promise<string> => {
  if (!theme) return '<svg></svg>';

  // Synchronous generation - no need for fonts to load or Satori
  let svg = '';

  if (templateId === 'template-1') {
    svg = await generateTemplate1Native(slide, theme, branding, format, patternId, patternOpacity, patternScale, patternSpacing);
  } else if (templateId === 'template-2') {
    svg = await generateTemplate2Native(slide, theme, branding, format, patternId, patternOpacity, patternScale, patternSpacing);
  } else if (templateId === 'template-3') {
    svg = await generateTemplate3Native(slide, theme, branding, format, patternId, patternOpacity, patternScale, patternSpacing);
  } else {
    // Fallback default
    svg = await generateTemplate1Native(slide, theme, branding, format, patternId, patternOpacity, patternScale, patternSpacing);
  }

  return svg;
};