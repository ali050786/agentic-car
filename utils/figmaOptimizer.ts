import { SlideContent, CarouselTheme } from '../types';
import { generateTemplate1Native } from './optimizers/template1Optimizer';
import { generateTemplate2Native } from './optimizers/template2Optimizer';

// ------------------------------------------------------------------
// MAIN OPTIMIZER ROUTER
// ------------------------------------------------------------------
export const optimizeSvgForFigma = async (
  slide: SlideContent, 
  theme: CarouselTheme | null, 
  templateId: string
): Promise<string> => {
  if (!theme) return '<svg></svg>';

  // Synchronous generation - no need for fonts to load or Satori
  let svg = '';
  
  if (templateId === 'template-1') {
    svg = generateTemplate1Native(slide, theme);
  } else if (templateId === 'template-2') {
    svg = generateTemplate2Native(slide, theme);
  } else {
    // Fallback default
    svg = generateTemplate1Native(slide, theme);
  }

  return svg;
};