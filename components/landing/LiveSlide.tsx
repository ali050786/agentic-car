import React, { useId, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { injectContentIntoSvg } from '../../utils/svgInjector';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { BrandingConfig, CarouselFormat, TemplateId } from '../../types';
import { AnySlide } from './sampleDeck';

interface LiveSlideProps {
  slide: AnySlide;
  templateId: TemplateId;
  presetId: string;
  format?: CarouselFormat;
  branding?: BrandingConfig;
  slideNumber?: number;
  className?: string;
  style?: React.CSSProperties;
}

const svgCache = new Map<string, string>();

/**
 * Renders a slide through the production SVG engine and scopes it so many
 * slides with different themes can live on one page:
 *  - the engine emits its theme as `:root { --vars }`, which would leak globally,
 *    so we rewrite `:root` to a per-instance class;
 *  - gradient / pattern / clip ids get a per-instance suffix so `url(#id)`
 *    references never resolve to another card's defs.
 */
export const renderScopedSlide = (
  slide: AnySlide,
  templateId: TemplateId,
  presetId: string,
  scope: string,
  format: CarouselFormat = 'portrait',
  branding?: BrandingConfig,
  slideNumber?: number,
): string => {
  const key = `${scope}|${templateId}|${presetId}|${format}|${slideNumber ?? ''}|${branding?.enabled ? 'b' : ''}|${JSON.stringify(slide)}`;
  const cached = svgCache.get(key);
  if (cached) return cached;

  const preset = getPresetById(presetId);
  const theme = preset ? resolveTheme(preset.seeds, templateId) : null;
  let svg = '';
  try {
    svg = injectContentIntoSvg(templateId, slide, theme, branding, format, undefined, undefined, undefined, undefined, scope, slideNumber);
  } catch (err) {
    console.error('[LiveSlide] render failed', err);
    return '';
  }

  const ids = new Set<string>();
  svg.replace(/\sid="([^"]+)"/g, (_m, id) => {
    ids.add(id);
    return _m;
  });
  svg = svg.replace(/:root/g, `.${scope}`);
  ids.forEach((id) => {
    if (id.endsWith(scope)) return;
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    svg = svg
      .replace(new RegExp(`id="${esc}"`, 'g'), `id="${id}-${scope}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${scope})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${id}-${scope}"`);
  });

  if (svgCache.size > 400) svgCache.clear();
  svgCache.set(key, svg);
  return svg;
};

export const useScope = (prefix = 'lps') => {
  const raw = useId();
  return `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
};

/** A static live-rendered slide. */
export const LiveSlide: React.FC<LiveSlideProps> = ({ slide, templateId, presetId, format = 'portrait', branding, slideNumber, className = '', style }) => {
  const scope = useScope();
  const svg = useMemo(
    () => renderScopedSlide(slide, templateId, presetId, scope, format, branding, slideNumber),
    [slide, templateId, presetId, scope, format, branding, slideNumber],
  );
  return (
    <div
      className={`lp-slide ${scope} ${className}`}
      style={{ aspectRatio: format === 'square' ? '1 / 1' : '1080 / 1384', ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/**
 * A live slide that cross-fades (with a little blur + scale) whenever its
 * content, template or palette changes. Used by the interactive demos.
 */
export const MorphSlide: React.FC<LiveSlideProps & { morphKey: string }> = ({ morphKey, format = 'portrait', className = '', ...rest }) => (
  <div className={`relative ${className}`} style={{ aspectRatio: format === 'square' ? '1 / 1' : '1080 / 1384' }}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={morphKey}
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.965, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <LiveSlide format={format} className="w-full h-full" {...rest} />
      </motion.div>
    </AnimatePresence>
  </div>
);
