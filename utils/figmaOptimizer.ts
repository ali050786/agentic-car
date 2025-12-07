import { SlideContent, CarouselTheme, CarouselFormat, BrandingConfig } from '../types';
import { generateTemplate1Native } from './optimizers/template1Optimizer';
import { generateTemplate2Native } from './optimizers/template2Optimizer';

// ------------------------------------------------------------------
// MAIN OPTIMIZER ROUTER
// ------------------------------------------------------------------
export const optimizeSvgForFigma = async (
  slide: SlideContent,
  theme: CarouselTheme | null,
  templateId: string,
  format?: CarouselFormat,
  branding?: BrandingConfig
): Promise<string> => {
  if (!theme) return '<svg></svg>';

  // Synchronous generation - no need for fonts to load or Satori
  let svg = '';

  if (templateId === 'template-1') {
    svg = await generateTemplate1Native(slide, theme, branding, format);
  } else if (templateId === 'template-2') {
    svg = await generateTemplate2Native(slide, theme, branding, format);
  } else {
    // Fallback default
    svg = await generateTemplate1Native(slide, theme, branding, format);
  }

  return svg;
};