import { SlideContent, SlideLayout, CarouselTheme, BrandingConfig, CarouselFormat } from '../../types';
import { slideToLayout } from '../../utils/slideMigration';
import { generateSignatureCard } from '../../utils/signatureCardGenerator';
import { generatePatternSVG } from '../../utils/patternGenerator';
import { generateIconSVG } from '../../utils/iconGenerator';
import { sanitizeText } from '../../utils/svgSanitizer';
import { dotGrid } from '../../assets/templates/template4';
import { renderHeroBlock } from './blocks/heroBlock';
import { renderBodyBlock } from './blocks/bodyBlock';
import { renderListBlock } from './blocks/listBlock';
import { renderClosingBlock } from './blocks/closingBlock';
import { renderStatBlock } from './blocks/statBlock';
import { renderQuoteBlock } from './blocks/quoteBlock';
import { renderSplitBlock } from './blocks/splitBlock';
import { FONTS } from './tokens';

/**
 * Unified Slide Renderer
 *
 * Consolidates slide layout construction, design-system tokens, and block rendering.
 * Consumes `SlideLayout` IR natively (and automatically migrates legacy `SlideContent`).
 * Produces export-safe SVG output while maintaining 100% backward compatibility
 * with existing templates, themes, signature cards, and inline-editing markers.
 */
export const renderSlide = (
  templateId: string,
  content: SlideContent | SlideLayout,
  theme: CarouselTheme | null,
  branding?: BrandingConfig,
  format?: CarouselFormat,
  patternId?: number,
  patternOpacity?: number,
  patternScale?: number,
  patternSpacing?: number,
  uniqueId: string = ''
): string => {
  // Normalize input into SlideLayout IR
  const layout = slideToLayout(content);

  // Sanitize slots
  const sanitizedSlots = {
    ...layout.slots,
    preHeader: layout.slots.preHeader ? sanitizeText(layout.slots.preHeader) : '',
    headline: layout.slots.headline ? sanitizeText(layout.slots.headline) : '',
    body: layout.slots.body ? sanitizeText(layout.slots.body) : '',
    footer: layout.slots.footer ? sanitizeText(layout.slots.footer) : '',
    statNumber: layout.slots.statNumber ? sanitizeText(layout.slots.statNumber) : '',
    statLabel: layout.slots.statLabel ? sanitizeText(layout.slots.statLabel) : '',
    quoteAuthor: layout.slots.quoteAuthor ? sanitizeText(layout.slots.quoteAuthor) : '',
    splitLeft: layout.slots.splitLeft ? sanitizeText(layout.slots.splitLeft) : '',
    splitRight: layout.slots.splitRight ? sanitizeText(layout.slots.splitRight) : '',
    listItems: layout.slots.listItems
      ? layout.slots.listItems.map((item) => {
          if (typeof item === 'string') {
            return sanitizeText(item);
          } else if (typeof item === 'object' && item !== null) {
            return {
              ...item,
              bullet: item.bullet ? sanitizeText(item.bullet) : '',
              description: item.description ? sanitizeText(item.description) : '',
            };
          }
          return item;
        })
      : undefined,
  };

  const sanitizedBranding = branding
    ? {
        ...branding,
        name: branding.name ? sanitizeText(branding.name) : '',
        title: branding.title ? sanitizeText(branding.title) : '',
      }
    : undefined;

  const isSquare = format === 'square';
  const htmlEditable = templateId === 'template-1' || templateId === 'template-3' || templateId === 'template-4';
  const EDIT_ATTRS = 'contenteditable="true" spellcheck="false"';

  const wrapEditable = (field: string, inner: string, extraAttrs = ''): string =>
    htmlEditable ? `<span data-edit-field="${field}" ${EDIT_ATTRS}${extraAttrs}>${inner}</span>` : inner;

  // Compute slide number string
  const idxMatch = (layout.id || '').match(/slide-(\d+)/);
  const slideNum = String((idxMatch ? parseInt(idxMatch[1], 10) : 0) + 1).padStart(2, '0');

  // Prepare theme CSS variables
  let themeCss = '';
  if (templateId === 'template-1') {
    themeCss = `
      :root {
        --text-default: ${theme?.textDefault || '#A2A2A2'};
        --text-highlight: ${theme?.textHighlight || '#FFFFFF'};
        --background: ${theme?.background || '#141414'};
        --background-2: ${theme?.background2 || '#FFFFFF'};
        --pattern-color: ${theme?.patternColor || '#2A2A2A'};
        --pattern-opacity: ${patternOpacity !== undefined ? patternOpacity : (theme?.patternOpacity || '0.2')};
      }
    `;
  } else if (templateId === 'template-3') {
    const t3Accent = theme?.textHighlight || '#0E8A5F';
    themeCss = `
      :root {
        --text-default: ${theme?.textDefault || '#1A1A18'};
        --text-highlight: ${t3Accent};
        --highlight-soft: ${t3Accent}48;
        --background: ${theme?.background || '#F5F1E8'};
        --background-2: ${theme?.background2 || '#DCEFE6'};
        --pattern-color: ${theme?.patternColor || '#E0E7FF'};
        --pattern-opacity: ${patternOpacity !== undefined ? patternOpacity : (theme?.patternOpacity || '0.1')};
      }
    `;
  } else if (templateId === 'template-4') {
    themeCss = `
      :root {
        --text-default: ${theme?.textDefault || '#A9A6C9'};
        --text-highlight: ${theme?.textHighlight || '#F5F4FF'};
        --background: ${theme?.background || '#1D1A45'};
        --background-2: ${theme?.background2 || '#F0997B'};
        --pattern-color: ${theme?.patternColor || '#A9A6C9'};
        --pattern-opacity: ${patternOpacity !== undefined ? patternOpacity : (theme?.patternOpacity || '0.15')};
      }
    `;
  }

  // Format headline HTML with accent phrase if present
  const rawHeadline = sanitizedSlots.headline || '';
  let headlineHtml = rawHeadline;
  if (sanitizedSlots.accentPhrase && rawHeadline.toLowerCase().includes(sanitizedSlots.accentPhrase.toLowerCase())) {
    const start = rawHeadline.toLowerCase().indexOf(sanitizedSlots.accentPhrase.toLowerCase());
    const end = start + sanitizedSlots.accentPhrase.length;
    const accentSub = rawHeadline.slice(start, end);

    if (templateId === 'template-1') {
      headlineHtml =
        rawHeadline.slice(0, start) +
        `<em style="font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; letter-spacing: -0.01em; color: var(--background-2);">${accentSub}</em>` +
        rawHeadline.slice(end);
    } else if (templateId === 'template-4') {
      headlineHtml =
        rawHeadline.slice(0, start) +
        `<span style="color: var(--background-2);">${accentSub}</span>` +
        rawHeadline.slice(end);
    }
  }

  // Select block renderer
  const blockType = layout.blockType || 'hero';
  let blockHtml = '';
  const blockParams = {
    templateId,
    isSquare,
    slideNum,
    preHeader: sanitizedSlots.preHeader,
    headlineHtml,
    body: sanitizedSlots.body,
    listItems: sanitizedSlots.listItems,
    footer: sanitizedSlots.footer,
    statNumber: sanitizedSlots.statNumber,
    statLabel: sanitizedSlots.statLabel,
    quoteAuthor: sanitizedSlots.quoteAuthor,
    splitLeft: sanitizedSlots.splitLeft,
    splitRight: sanitizedSlots.splitRight,
    doodleUrl: layout.visual?.doodleUrl,
    wrapEditable,
  };

  switch (blockType) {
    case 'hero':
      blockHtml = renderHeroBlock(blockParams);
      break;
    case 'body':
      blockHtml = renderBodyBlock(blockParams);
      break;
    case 'list':
      blockHtml = renderListBlock(blockParams);
      break;
    case 'cta':
    case 'closing':
      blockHtml = renderClosingBlock(blockParams);
      break;
    case 'stat':
      blockHtml = renderStatBlock(blockParams);
      break;
    case 'quote':
      blockHtml = renderQuoteBlock(blockParams);
      break;
    case 'split':
      blockHtml = renderSplitBlock(blockParams);
      break;
    default:
      blockHtml = renderBodyBlock(blockParams);
      break;
  }

  // Prepare pattern definition
  let patternSvg = generatePatternSVG(patternId || 1, patternScale, patternSpacing);
  if (uniqueId) {
    patternSvg = patternSvg.replace(/id="bgPattern"/g, `id="bgPattern-${uniqueId}"`);
  }

  // Calculate foreignObject positioning & dimension shims
  let foX = '90';
  let foY = '190';
  let foWidth = '900';
  let foHeight = '1010';

  if (templateId === 'template-1') {
    if (isSquare) {
      foX = '80'; foY = '150'; foWidth = '920'; foHeight = '800';
      if (sanitizedBranding && sanitizedBranding.enabled && sanitizedBranding.position === 'bottom-left') {
        foY = '90'; foHeight = '740';
      } else if (sanitizedBranding && sanitizedBranding.enabled && (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right')) {
        foY = '260'; foHeight = '690';
      }
    } else {
      foX = '90'; foY = '190'; foWidth = '900'; foHeight = '1010';
      if (sanitizedBranding && sanitizedBranding.enabled && sanitizedBranding.position === 'bottom-left') {
        foY = '130'; foHeight = '960';
      } else if (sanitizedBranding && sanitizedBranding.enabled && (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right')) {
        foY = '300'; foHeight = '900';
      }
    }
  } else if (templateId === 'template-3') {
    if (isSquare) {
      foX = '80'; foWidth = '920';
      if (blockType === 'body' || blockType === 'list' || blockType === 'stat' || blockType === 'quote' || blockType === 'split') {
        foY = '200'; foHeight = '780';
      } else {
        foY = '100'; foHeight = '880';
      }
      if (sanitizedBranding && sanitizedBranding.enabled && (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right')) {
        if (blockType === 'body' || blockType === 'list' || blockType === 'stat' || blockType === 'quote' || blockType === 'split') {
          foY = '280';
        } else {
          foY = '240';
        }
      }
    } else {
      foX = '80'; foY = '160'; foWidth = '920'; foHeight = '1000';
      if (sanitizedBranding && sanitizedBranding.enabled && (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right')) {
        foY = '290';
      }
    }
  } else if (templateId === 'template-4') {
    if (isSquare) {
      foX = '90'; foWidth = '900';
      switch (blockType) {
        case 'hero': foY = '200'; foHeight = '660'; break;
        case 'body':
        case 'stat':
        case 'quote':
        case 'split': foY = '250'; foHeight = '680'; break;
        case 'list': foY = '250'; foHeight = '720'; break;
        case 'cta':
        case 'closing': foY = '180'; foHeight = '720'; break;
      }
      if (sanitizedBranding && sanitizedBranding.enabled) {
        if (sanitizedBranding.position === 'bottom-left') {
          switch (blockType) {
            case 'hero': foY = '110'; foHeight = '640'; break;
            case 'body':
            case 'stat':
            case 'quote':
            case 'split': foY = '200'; foHeight = '560'; break;
            case 'list': foY = '200'; foHeight = '600'; break;
            case 'cta':
            case 'closing': foY = '110'; foHeight = '660'; break;
          }
        } else if (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right') {
          switch (blockType) {
            case 'hero': foY = '260'; foHeight = '600'; break;
            case 'body':
            case 'stat':
            case 'quote':
            case 'split': foY = '300'; foHeight = '620'; break;
            case 'list': foY = '300'; foHeight = '660'; break;
            case 'cta':
            case 'closing': foY = '240'; foHeight = '660'; break;
          }
        }
      }
    } else {
      foX = '100'; foWidth = '880';
      switch (blockType) {
        case 'hero': foY = '260'; foHeight = '840'; break;
        case 'body':
        case 'stat':
        case 'quote':
        case 'split': foY = '320'; foHeight = '840'; break;
        case 'list': foY = '310'; foHeight = '920'; break;
        case 'cta':
        case 'closing': foY = '240'; foHeight = '900'; break;
      }
      if (sanitizedBranding && sanitizedBranding.enabled) {
        if (sanitizedBranding.position === 'bottom-left') {
          switch (blockType) {
            case 'hero': foY = '180'; foHeight = '820'; break;
            case 'body':
            case 'stat':
            case 'quote':
            case 'split': foY = '250'; foHeight = '770'; break;
            case 'list': foY = '250'; foHeight = '830'; break;
            case 'cta':
            case 'closing': foY = '170'; foHeight = '830'; break;
          }
        } else if (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right') {
          switch (blockType) {
            case 'hero': foY = '330'; foHeight = '770'; break;
            case 'body':
            case 'stat':
            case 'quote':
            case 'split': foY = '380'; foHeight = '780'; break;
            case 'list': foY = '380'; foHeight = '840'; break;
            case 'cta':
            case 'closing': foY = '310'; foHeight = '830'; break;
          }
        }
      }
    }
  }

  // Construct complete SVG string per template
  let svgOutput = '';
  const patternRef = uniqueId ? `url(#bgPattern-${uniqueId})` : 'url(#bgPattern)';

  if (templateId === 'template-1') {
    const viewBox = isSquare ? '0 0 1080 1080' : '0 0 1080.35 1383.91';
    const canvasH = isSquare ? 1080 : 1380;
    const glowR = isSquare ? 600 : 720;

    svgOutput = `
<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;800;900&amp;family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&amp;family=JetBrains+Mono:wght@500;700&amp;family=Lato:wght@400;700&amp;display=swap');
      ${themeCss}
    </style>
    ${patternSvg}
    <radialGradient id="t1Glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--background-2)" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="var(--background-2)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="1080" height="${canvasH}" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="${canvasH}" fill="${patternRef}"/>
  <circle cx="1080" cy="0" r="${glowR}" fill="url(#t1Glow)"/>

  <foreignObject x="${foX}" y="${foY}" width="${foWidth}" height="${foHeight}">
    ${blockHtml}
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
  } else if (templateId === 'template-3') {
    const viewBox = isSquare ? '0 0 1080 1080' : '0 0 1080.35 1383.91';
    const canvasH = isSquare ? 1080 : 1380;
    const fallbackDoodle = `https://image.pollinations.ai/prompt/${encodeURIComponent('minimal editorial spot illustration of a person sprinting up a huge rising arrow like a ramp, loose confident black ink line art, monochrome black ink only, isolated on a plain white background, no text')}?width=600&height=1000&nologo=true`;
    const doodleUrl = layout.visual?.doodleUrl || fallbackDoodle;

    let backgroundDecorations = '';
    if (blockType === 'hero') {
      if (isSquare) {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(600,500) scale(0.9)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(570,450)" fill="var(--text-highlight)"/>
        `;
      } else {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(590,760) scale(1.05)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(560,700)" fill="var(--text-highlight)"/>
        `;
      }
    } else if (blockType === 'body' || blockType === 'stat' || blockType === 'quote' || blockType === 'split') {
      if (isSquare) {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(-140,500) scale(0.9)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(430,470)" fill="var(--text-highlight)"/>
        `;
      } else {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(-130,780) scale(1.05)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(470,740)" fill="var(--text-highlight)"/>
        `;
      }
    } else if (blockType === 'list') {
      if (isSquare) {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(620,540) scale(0.8)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(920,120)" fill="var(--text-highlight)"/>
        `;
      } else {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(620,820) scale(0.9)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(920,160)" fill="var(--text-highlight)"/>
        `;
      }
    } else if (blockType === 'cta' || blockType === 'closing') {
      if (isSquare) {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(560,420) scale(0.95)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(530,380)" fill="var(--text-highlight)"/>
        `;
      } else {
        backgroundDecorations = `
          <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(560,680) scale(1.1)" fill="var(--background-2)" opacity="0.3"/>
          <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C26,24 28,16 30,4 Z" transform="translate(530,640)" fill="var(--text-highlight)"/>
        `;
      }
    }

    let doodleOverlay = '';
    if (blockType === 'hero') {
      doodleOverlay = isSquare
        ? `<image href="${doodleUrl}" x="560" y="440" width="480" height="520" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>`
        : `<image href="${doodleUrl}" x="540" y="660" width="520" height="580" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>`;
    } else if (blockType === 'body' || blockType === 'stat' || blockType === 'quote' || blockType === 'split') {
      doodleOverlay = isSquare
        ? `<image href="${doodleUrl}" x="-40" y="440" width="480" height="520" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>`
        : `<image href="${doodleUrl}" x="-40" y="660" width="520" height="580" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>`;
    } else if (blockType === 'cta' || blockType === 'closing') {
      doodleOverlay = isSquare
        ? `<image href="${doodleUrl}" x="540" y="380" width="500" height="560" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>`
        : `<image href="${doodleUrl}" x="520" y="600" width="540" height="620" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>`;
    }

    const swipeHintY = isSquare ? 1000 : 1296;
    const swipeHint = `
      <g transform="translate(980, ${swipeHintY})">
        <circle r="${isSquare ? 38 : 44}" fill="none" stroke="var(--text-highlight)" stroke-width="3"/>
        <g fill="none" stroke="var(--text-highlight)" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">
          <path d="M-16 0 H 16"/>
          <path d="M 6 -10 L 16 0 L 6 10"/>
        </g>
      </g>
    `;

    svgOutput = `
<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&amp;family=Lato:wght@300;400;700&amp;display=swap');
      ${themeCss}
    </style>
    ${patternSvg}
    <symbol id="t3Wash" viewBox="0 0 600 600">
      <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z"/>
    </symbol>
    <symbol id="t3Swash" viewBox="0 0 400 200">
      <path d="M20,150 C90,40 280,10 380,80 C300,40 140,70 60,170 C45,175 25,165 20,150 Z"/>
    </symbol>
    <symbol id="t3Spark" viewBox="0 0 60 60">
      <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z"/>
    </symbol>
  </defs>

  <rect x="0" y="0" width="1080" height="${canvasH}" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="${canvasH}" fill="${patternRef}"/>

  ${backgroundDecorations}

  <foreignObject x="${foX}" y="${foY}" width="${foWidth}" height="${foHeight}">
    ${blockHtml}
  </foreignObject>

  ${doodleOverlay}
  ${swipeHint}

  {{SIGNATURE_CARD}}
</svg>
`;
  } else if (templateId === 'template-4') {
    const viewBox = isSquare ? '0 0 1080 1080' : '0 0 1080 1380';
    const canvasH = isSquare ? 1080 : 1380;

    let topDotGridY = 90;
    if (sanitizedBranding && sanitizedBranding.enabled && sanitizedBranding.position === 'top-right') {
      topDotGridY = isSquare ? 200 : 240;
    } else {
      topDotGridY = isSquare ? 90 : (blockType === 'hero' ? 100 : 110);
    }

    const topDotGridHtml = isSquare
      ? (blockType === 'hero' ? dotGrid(820, topDotGridY, 5, 5, 32, 4, 0.5) : dotGrid(850, topDotGridY, 4, 4, 28, 3.5, 0.4))
      : (blockType === 'hero' ? dotGrid(800, topDotGridY, 6, 6, 34, 4, 0.5) : dotGrid(830, topDotGridY, 5, 5, 30, 3.5, 0.4));

    let headerElements = '';
    let footerDecorations = '';

    if (blockType === 'hero') {
      const numY = isSquare ? 1045 : 1345;
      const numFont = isSquare ? 300 : 360;
      headerElements = `
        <circle cx="10" cy="10" r="${isSquare ? 220 : 270}" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.3"/>
        <circle cx="10" cy="10" r="${isSquare ? 150 : 195}" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.2"/>
        ${topDotGridHtml}
        <text x="1055" y="${numY}" text-anchor="end" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="${numFont}" fill="var(--background-2)" opacity="0.12" letter-spacing="-15">${slideNum}</text>
      `;
    } else if (blockType === 'body' || blockType === 'stat' || blockType === 'quote' || blockType === 'split') {
      let numY = isSquare ? 150 : 200;
      let lineY = isSquare ? 186 : 240;
      let numX = isSquare ? 90 : 100;
      let lineX1 = numX;
      let lineX2 = isSquare ? 990 : 980;

      if (sanitizedBranding && sanitizedBranding.enabled && (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right')) {
        numY = isSquare ? 240 : 300;
        lineY = isSquare ? 270 : 340;
      }

      headerElements = `
        <text x="${numX}" y="${numY}" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="${isSquare ? 46 : 54}" fill="var(--background-2)">${slideNum}</text>
        <line x1="${lineX1}" y1="${lineY}" x2="${lineX2}" y2="${lineY}" stroke="var(--text-default)" stroke-width="1" opacity="0.25"/>
      `;
      footerDecorations = isSquare
        ? `
          <circle cx="1080" cy="1080" r="260" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.2"/>
          <circle cx="1080" cy="1080" r="180" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.14"/>
        `
        : `
          <circle cx="1080" cy="1380" r="320" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.2"/>
          <circle cx="1080" cy="1380" r="230" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.14"/>
        `;
    } else if (blockType === 'list') {
      let numY = isSquare ? 150 : 200;
      let lineY = isSquare ? 186 : 240;
      let numX = isSquare ? 90 : 100;
      let lineX1 = numX;
      let lineX2 = isSquare ? 990 : 980;

      if (sanitizedBranding && sanitizedBranding.enabled && (sanitizedBranding.position === 'top-left' || sanitizedBranding.position === 'top-right')) {
        numY = isSquare ? 240 : 300;
        lineY = isSquare ? 270 : 340;
      }

      headerElements = `
        <text x="${numX}" y="${numY}" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="${isSquare ? 46 : 54}" fill="var(--background-2)">${slideNum}</text>
        <line x1="${lineX1}" y1="${lineY}" x2="${lineX2}" y2="${lineY}" stroke="var(--text-default)" stroke-width="1" opacity="0.25"/>
      `;
      footerDecorations = isSquare
        ? dotGrid(850, 920, 4, 4, 26, 3, 0.4)
        : dotGrid(830, 1180, 5, 5, 30, 3.5, 0.4);
    } else if (blockType === 'cta' || blockType === 'closing') {
      headerElements = isSquare
        ? `
          <circle cx="980" cy="100" r="200" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.25"/>
          <circle cx="980" cy="100" r="140" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.15"/>
        `
        : `
          <circle cx="980" cy="120" r="240" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.25"/>
          <circle cx="980" cy="120" r="170" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.15"/>
        `;
    }

    svgOutput = `
<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&display=swap');
      ${themeCss}
    </style>
    ${patternSvg}
  </defs>

  <rect x="0" y="0" width="1080" height="${canvasH}" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="${canvasH}" fill="${patternRef}"/>

  ${headerElements}
  ${footerDecorations}

  <foreignObject x="${foX}" y="${foY}" width="${foWidth}" height="${foHeight}">
    ${blockHtml}
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
  }

  // Inject Signature Card
  let signatureCardHtml = '';
  if (sanitizedBranding && sanitizedBranding.enabled) {
    const fontFamily = (templateId === 'template-1' || templateId === 'template-3') ? 'Lato' : 'Roboto';
    signatureCardHtml = generateSignatureCard(sanitizedBranding, fontFamily, format, uniqueId, templateId);
  }
  svgOutput = svgOutput.replace('{{SIGNATURE_CARD}}', signatureCardHtml);

  // Inject Icon SVG for non-T3 templates
  if (templateId !== 'template-3') {
    const iconSize = blockType === 'hero' ? 150 : 80;
    const iconColor = theme?.background || '#141414';
    const iconSvg = generateIconSVG(layout.visual?.icon, iconSize, iconColor);
    svgOutput = svgOutput.replace('{{ICON_SVG}}', iconSvg);
    svgOutput = svgOutput.replace('{{ICON_SVG}}', '');
  }

  return svgOutput;
};
