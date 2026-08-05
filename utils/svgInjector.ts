import { SlideContent, SlideLayout, CarouselTheme, BrandingConfig, CarouselFormat } from '../types';
import { renderSlide } from '../core/design/renderSlide';

/**
 * The Injector Engine (Adapter).
 * Delegates SVG construction to the design system slide renderer (`renderSlide`).
 */
export const injectContentIntoSvg = (
  templateId: string,
  content: SlideContent | SlideLayout,
  theme: CarouselTheme | null,
  branding?: BrandingConfig,
  format?: CarouselFormat,
  patternId?: number,
  patternOpacity?: number,
  patternScale?: number,
  patternSpacing?: number,
  uniqueId: string = '',
  slideNumber?: number
): string => {
  return renderSlide(
    templateId,
    content,
    theme,
    branding,
    format,
    patternId,
    patternOpacity,
    patternScale,
    patternSpacing,
    uniqueId,
    slideNumber
  );
};