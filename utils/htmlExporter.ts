import { SlideContent, SlideLayout, CarouselTheme, BrandingConfig, CarouselFormat } from '../types';
import { injectContentIntoSvg } from './svgInjector';
import { embedImagesInSvg } from './imageUtils';

/**
 * Standalone HTML export.
 *
 * Serializes the whole deck into a single self-contained `.html` file. Each
 * slide reuses the exact same design-system markup the app renders on stage
 * (`injectContentIntoSvg` → `renderSlide`), so the export is 1:1 with the
 * canvas. Doodle/brand images are inlined as base64 data URIs via
 * `embedImagesInSvg`, so the file renders offline; web fonts still load from
 * the Google Fonts `@import` baked into each slide's `<style>` (needs a
 * connection for the exact typefaces, falls back to system fonts otherwise).
 */
export interface HtmlExportOptions {
  templateId: string;
  slides: (SlideContent | SlideLayout)[];
  theme: CarouselTheme | null;
  branding: BrandingConfig;
  format: CarouselFormat;
  pattern: number;
  patternOpacity: number;
  patternScale: number;
  patternSpacing: number;
  title?: string;
}

/** Render one slide's SVG string and inline its external images as base64. */
const renderSlideWithEmbeddedImages = async (svgString: string): Promise<string> => {
  const holder = document.createElement('div');
  holder.innerHTML = svgString;
  const svgEl = holder.querySelector('svg');
  if (svgEl) {
    try {
      await embedImagesInSvg(svgEl);
    } catch (err) {
      console.warn('[htmlExporter] Failed to embed images for a slide:', err);
    }
  }
  return holder.innerHTML;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const exportCarouselToHtml = async (opts: HtmlExportOptions): Promise<void> => {
  const { slides, title } = opts;
  if (!slides || slides.length === 0) {
    throw new Error('No slides to export');
  }

  await document.fonts.ready;

  const slideMarkup = await Promise.all(
    slides.map((slide, i) => {
      const svg = injectContentIntoSvg(
        opts.templateId,
        slide,
        opts.theme,
        opts.branding,
        opts.format,
        opts.pattern,
        opts.patternOpacity,
        opts.patternScale,
        opts.patternSpacing,
        `export-${i}`
      );
      return renderSlideWithEmbeddedImages(svg);
    })
  );

  const deckTitle = escapeHtml((title && title.trim()) || 'Carousel');
  // Each slide SVG carries its own :root theme vars + fonts, so the wrapper
  // stays deliberately minimal — just a centered, responsive gallery.
  const slidesHtml = slideMarkup
    .map(
      (m, i) => `      <figure class="slide">
        ${m}
        <figcaption>Slide ${i + 1} of ${slideMarkup.length}</figcaption>
      </figure>`
    )
    .join('\n');

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${deckTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px 16px;
      background: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    h1.deck-title { color: #fff; font-size: 20px; font-weight: 600; margin: 0 0 8px; text-align: center; }
    .slide {
      margin: 0;
      width: 100%;
      max-width: 540px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      background: #fff;
    }
    .slide svg { display: block; width: 100%; height: auto; }
    .slide figcaption {
      color: #888;
      font-size: 12px;
      text-align: center;
      padding: 10px 0 0;
    }
  </style>
</head>
<body>
  <h1 class="deck-title">${deckTitle}</h1>
${slidesHtml}
</body>
</html>`;

  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = ((title && title.trim()) || 'carousel')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'carousel';
  link.download = `${safeName}.html`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
