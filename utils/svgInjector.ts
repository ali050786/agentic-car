import { SlideContent, CarouselTheme, BrandingConfig, CarouselFormat } from '../types';
import { T1_HERO_SVG, T1_BODY_SVG, T1_LIST_SVG, T1_CTA_SVG } from '../assets/templates/template1';
import { T1_HERO_SVG_SQUARE, T1_BODY_SVG_SQUARE, T1_LIST_SVG_SQUARE, T1_CTA_SVG_SQUARE } from '../assets/templates/template1_square';
import { T3_HERO_SVG, T3_BODY_SVG, T3_LIST_SVG, T3_CTA_SVG } from '../assets/templates/template3';
import { T3_HERO_SVG_SQUARE, T3_BODY_SVG_SQUARE, T3_LIST_SVG_SQUARE, T3_CTA_SVG_SQUARE } from '../assets/templates/template3_square';
import { T4_HERO_SVG, T4_BODY_SVG, T4_LIST_SVG, T4_CTA_SVG } from '../assets/templates/template4';
import { T4_HERO_SVG_SQUARE, T4_BODY_SVG_SQUARE, T4_LIST_SVG_SQUARE, T4_CTA_SVG_SQUARE } from '../assets/templates/template4_square';
import { generateSignatureCard } from './signatureCardGenerator';
import { generatePatternSVG } from './patternGenerator';
import { generateIconSVG } from './iconGenerator';

/**
 * The Injector Engine.
 * Takes the raw SVG string and replaces placeholder tokens with actual content and theme colors.
 */
export const injectContentIntoSvg = (
  templateId: string,
  content: SlideContent,
  theme: CarouselTheme | null,
  branding?: BrandingConfig,
  format?: CarouselFormat,
  patternId?: number,  // Pattern ID for background pattern
  patternOpacity?: number,  // User-controlled pattern opacity (0-1)
  patternScale?: number,    // User-controlled pattern scale
  patternSpacing?: number,  // User-controlled pattern spacing
  uniqueId: string = '' // Optional unique identifier for DOM element isolation
): string => {
  let baseSvg = '';
  let listHtml = '';
  let themeCss = '';

  // Inline-editing markers: T3/T4 render their text in HTML (foreignObject),
  // so we wrap each editable value in a tagged <span> that ArtifactPanel turns
  // into a click-to-edit region. T1/T2 render text as SVG <text> where a span
  // is invalid, so they opt out. The attributes are inert for exports/thumbs.
  // `contenteditable` lives in the markup (not applied by a later effect) so the
  // text is editable the instant it renders — the click-to-edit affordance and
  // the actual editability can never drift out of sync. ArtifactPanel only adds
  // delegated commit/key handling on top. Inert in exports/thumbnails.
  const htmlEditable = templateId === 'template-1' || templateId === 'template-3' || templateId === 'template-4';
  const EDIT_ATTRS = 'contenteditable="true" spellcheck="false"';
  const wrapEditable = (field: string, inner: string, extraAttrs = ''): string =>
    htmlEditable ? `<span data-edit-field="${field}" ${EDIT_ATTRS}${extraAttrs}>${inner}</span>` : inner;

  // 1. Select Base SVG based on template and format
  const isSquare = format === 'square';

  if (templateId === 'template-1') {
    if (isSquare) {
      switch (content.variant) {
        case 'hero': baseSvg = T1_HERO_SVG_SQUARE; break;
        case 'body': baseSvg = T1_BODY_SVG_SQUARE; break;
        case 'list': baseSvg = T1_LIST_SVG_SQUARE; break;
        case 'cta':
        case 'closing':  // LLM uses 'closing' variant
          baseSvg = T1_CTA_SVG_SQUARE;
          break;
        default: baseSvg = T1_HERO_SVG_SQUARE;
      }
    } else {
      switch (content.variant) {
        case 'hero': baseSvg = T1_HERO_SVG; break;
        case 'body': baseSvg = T1_BODY_SVG; break;
        case 'list': baseSvg = T1_LIST_SVG; break;
        case 'cta':
        case 'closing':  // LLM uses 'closing' variant
          baseSvg = T1_CTA_SVG;
          break;
        default: baseSvg = T1_HERO_SVG;
      }
    }

    // Conditionally adjust foreignObject position for the signature card (T1).
    // Bottom-left: shift content up 60px AND shrink the height so the SWIPE row
    // (pinned to the foreignObject bottom) ends ~30px above the card (card top:
    // 1120 portrait / 860 square). Top-left/right: push content down past the
    // card (bottom edge ~210 portrait / ~175 square) and shrink the height so
    // the SWIPE row keeps its original bottom edge.
    if (branding && branding.enabled && branding.position === 'bottom-left') {
      if (isSquare) {
        baseSvg = baseSvg.replace(/foreignObject x="80" y="150" width="920" height="800"/g, 'foreignObject x="80" y="90" width="920" height="740"');
      } else {
        baseSvg = baseSvg.replace(/foreignObject x="90" y="190" width="900" height="1010"/g, 'foreignObject x="90" y="130" width="900" height="960"');
      }
    } else if (branding && branding.enabled && (branding.position === 'top-left' || branding.position === 'top-right')) {
      if (isSquare) {
        baseSvg = baseSvg.replace(/foreignObject x="80" y="150" width="920" height="800"/g, 'foreignObject x="80" y="260" width="920" height="690"');
      } else {
        baseSvg = baseSvg.replace(/foreignObject x="90" y="190" width="900" height="1010"/g, 'foreignObject x="90" y="300" width="900" height="900"');
      }
    }

    // T1: Inject CSS Variables for Theme
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

    // T1: Slide number for the kicker counter + ghost numeral
    const t1IdxMatch = (content.id || '').match(/slide-(\d+)/);
    const t1SlideNum = String((t1IdxMatch ? parseInt(t1IdxMatch[1], 10) : 0) + 1).padStart(2, '0');
    baseSvg = baseSvg.replace(/\{\{SLIDE_NUM\}\}/g, t1SlideNum);

    // T1: Headline with the accent phrase set in italic serif + accent color —
    // the grotesk-x-serif contrast is the template's signature move.
    const t1Headline = content.headline || '';
    let t1HeadlineHtml = t1Headline;
    if (content.accentPhrase && t1Headline.toLowerCase().includes(content.accentPhrase.toLowerCase())) {
      const start = t1Headline.toLowerCase().indexOf(content.accentPhrase.toLowerCase());
      const end = start + content.accentPhrase.length;
      t1HeadlineHtml =
        t1Headline.slice(0, start) +
        `<em style="font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; letter-spacing: -0.01em; color: var(--background-2);">${t1Headline.slice(start, end)}</em>` +
        t1Headline.slice(end);
    }
    baseSvg = baseSvg.replace('{{HEADLINE_HTML}}', wrapEditable('headline', t1HeadlineHtml));

    // T1 List Style: mono index + bold key, hairline dividers between rows
    const listFontSize = isSquare ? '28px' : '31px';
    const listIdxSize = isSquare ? '24px' : '26px';

    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item, itemIndex) => {
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] + ':' : '';
          desc = parts.length > 1 ? parts.slice(1).join(':') : item;
        } else if (typeof item === 'object' && item !== null) {
          title = item.bullet || '';
          desc = item.description || '';
        }

        return `
          ${itemIndex > 0 ? '<div style="height: 1px; background: var(--text-default); opacity: 0.2;"></div>' : ''}
          <div style="display: flex; align-items: flex-start; gap: 30px; padding: ${isSquare ? '22px' : '28px'} 0;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: ${listIdxSize}; color: var(--background-2); min-width: 52px; padding-top: 4px;">${String(itemIndex + 1).padStart(2, '0')}</div>
            <div data-edit-field="listItem" data-edit-index="${itemIndex}" contenteditable="true" spellcheck="false" style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.45;">
              ${title ? `<span style="color: var(--text-highlight); font-weight: 700;">${title}</span>` : ''}
              ${desc}
            </div>
          </div>
          `;
      }).join('')
      : '';


  } else if (templateId === 'template-3') {
    if (isSquare) {
      switch (content.variant) {
        case 'hero': baseSvg = T3_HERO_SVG_SQUARE; break;
        case 'body': baseSvg = T3_BODY_SVG_SQUARE; break;
        case 'list': baseSvg = T3_LIST_SVG_SQUARE; break;
        case 'cta':
        case 'closing':
          baseSvg = T3_CTA_SVG_SQUARE;
          break;
        default: baseSvg = T3_HERO_SVG_SQUARE;
      }
    } else {
      switch (content.variant) {
        case 'hero': baseSvg = T3_HERO_SVG; break;
        case 'body': baseSvg = T3_BODY_SVG; break;
        case 'list': baseSvg = T3_LIST_SVG; break;
        case 'cta':
        case 'closing':
          baseSvg = T3_CTA_SVG;
          break;
        default: baseSvg = T3_HERO_SVG;
      }
    }

    // T3: Shift content DOWN for top signatures to avoid overlap. The top
    // signature card sits at y≈85 (square) / y≈120 (portrait) with a ~90px
    // avatar, so its bottom edge is ~175 / ~210. Push content well past that
    // to leave a comfortable gap instead of letting them touch.
    if (branding && branding.enabled && (branding.position === 'top-left' || branding.position === 'top-right')) {
      if (isSquare) {
        // Square Hero/CTA: y="100" -> y="240"
        baseSvg = baseSvg.replace(/foreignObject x="80" y="100"/g, 'foreignObject x="80" y="240"');
        // Square Body/List: y="200" -> y="280"
        baseSvg = baseSvg.replace(/foreignObject x="80" y="200"/g, 'foreignObject x="80" y="280"');
      } else {
        // Portrait: y="160" -> y="290"
        baseSvg = baseSvg.replace(/foreignObject x="80" y="160"/g, 'foreignObject x="80" y="290"');
      }
    }

    // T3: Inject CSS Variables for Theme (Editorial Paper Style)
    // --highlight-soft: the accent at ~28% alpha, used for the marker
    // highlight behind the headline's accent phrase.
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

    // T3: Headline without decorative highlight
    const t3Headline = content.headline || '';
    baseSvg = baseSvg.replace('{{HEADLINE_HTML}}', wrapEditable('headline', t3Headline));

    // T3 List Style (accent checkmarks, editorial checklist)
    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item, itemIndex) => {
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] + ':' : '';
          desc = parts.length > 1 ? parts.slice(1).join(':') : item;
        } else if (typeof item === 'object' && item !== null) {
          title = item.bullet || '';
          desc = item.description || '';
        }

        const listFontSize = isSquare ? '26px' : '30px';
        const checkSize = isSquare ? '30px' : '34px';

        return `
          <div style="display: flex; align-items: flex-start; gap: 22px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.45;">
            <div style="min-width: ${checkSize}; font-size: ${checkSize}; line-height: 1.1; color: var(--text-highlight); font-weight: 700;">&#10003;</div>
            <div data-edit-field="listItem" data-edit-index="${itemIndex}" contenteditable="true" spellcheck="false">
              ${title ? `<span style="font-weight: 700;">${title}</span>` : ''}
              ${desc}
            </div>
          </div>
          `;
      }).join('')
      : '';

    // T3: Dynamic Doodle Image URL
    const fallbackDoodle = `https://image.pollinations.ai/prompt/${encodeURIComponent('minimal editorial spot illustration of a person sprinting up a huge rising arrow like a ramp, loose confident black ink line art, monochrome black ink only, elegant magazine spot illustration style, isolated on a plain white background, no text')}?width=600&height=1000&nologo=true`;
    const doodleUrl = content.doodleUrl || fallbackDoodle;
    baseSvg = baseSvg.replace('{{DOODLE_IMAGE_URL}}', doodleUrl);
  } else if (templateId === 'template-4') {
    if (isSquare) {
      switch (content.variant) {
        case 'hero': baseSvg = T4_HERO_SVG_SQUARE; break;
        case 'body': baseSvg = T4_BODY_SVG_SQUARE; break;
        case 'list': baseSvg = T4_LIST_SVG_SQUARE; break;
        case 'cta':
        case 'closing':
          baseSvg = T4_CTA_SVG_SQUARE;
          break;
        default: baseSvg = T4_HERO_SVG_SQUARE;
      }
    } else {
      switch (content.variant) {
        case 'hero': baseSvg = T4_HERO_SVG; break;
        case 'body': baseSvg = T4_BODY_SVG; break;
        case 'list': baseSvg = T4_LIST_SVG; break;
        case 'cta':
        case 'closing':
          baseSvg = T4_CTA_SVG;
          break;
        default: baseSvg = T4_HERO_SVG;
      }
    }

    // T4: Inject CSS Variables for Theme (Statement Style)
    themeCss = `
      :root {
        --text-default: ${theme?.textDefault || '#A9A6C9'};
        --text-highlight: ${theme?.textHighlight || '#F5F4FF'};
        --background: ${theme?.background || '#1D1A45'};
        --background-2: ${theme?.background2 || '#F0997B'};
      }
    `;

    // T4: Slide number from the slide id (e.g. "template-4-slide-2" -> "03")
    const idxMatch = (content.id || '').match(/slide-(\d+)/);
    const slideNum = String((idxMatch ? parseInt(idxMatch[1], 10) : 0) + 1).padStart(2, '0');
    baseSvg = baseSvg.replace(/\{\{SLIDE_NUM\}\}/g, slideNum);

    // T4: Headline with accent-colored phrase chosen by the agent
    const headline = content.headline || '';
    let headlineHtml = headline;
    if (content.accentPhrase && headline.toLowerCase().includes(content.accentPhrase.toLowerCase())) {
      const start = headline.toLowerCase().indexOf(content.accentPhrase.toLowerCase());
      const end = start + content.accentPhrase.length;
      headlineHtml =
        headline.slice(0, start) +
        `<span style="color: var(--background-2);">${headline.slice(start, end)}</span>` +
        headline.slice(end);
    }
    baseSvg = baseSvg.replace('{{HEADLINE_HTML}}', wrapEditable('headline', headlineHtml));

    // T4: Default pill text on the closing slide
    baseSvg = baseSvg.replace('{{FOOTER}}', wrapEditable('footer', content.footer || 'Follow for more →'));

    // T4 List Style (numbered rows with hairline dividers)
    const listFontSize = isSquare ? '28px' : '32px';
    const listNumSize = isSquare ? '26px' : '30px';
    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item, itemIndex) => {
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] : '';
          desc = parts.length > 1 ? parts.slice(1).join(':').trim() : item;
        } else if (typeof item === 'object' && item !== null) {
          title = (item.bullet || '').replace(/:$/, '');
          desc = item.description || '';
        }

        return `
          <div style="height: 1px; background: var(--text-default); opacity: 0.3;"></div>
          <div style="display: flex; align-items: flex-start; gap: 32px; padding: ${isSquare ? '24px' : '30px'} 0;">
            <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: ${listNumSize}; color: var(--background-2); min-width: 56px;">${String(itemIndex + 1).padStart(2, '0')}</div>
            <div data-edit-field="listItem" data-edit-index="${itemIndex}" contenteditable="true" spellcheck="false" style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.45;">
              ${title ? `<span style="color: var(--text-highlight); font-weight: 500;">${title}.</span> ` : ''}${desc}
            </div>
          </div>
          `;
      }).join('')
      : '';
  }

  // Inject Theme CSS
  baseSvg = baseSvg.replace('{{THEME_CSS}}', themeCss);

  // Inject Background Pattern Definition
  if (templateId !== 'template-3') {
    const patternSvg = patternId
      ? generatePatternSVG(patternId, patternScale, patternSpacing)
      : generatePatternSVG(1, patternScale, patternSpacing); // Default to pattern 1
    baseSvg = baseSvg.replace('{{PATTERN_DEFINITION}}', patternSvg);
  }

  // Also inject individual color variables for square templates
  baseSvg = baseSvg.replace(/\{\{TEXT_COLOR\}\}/g, theme?.textDefault || '#A2A2A2');
  baseSvg = baseSvg.replace(/\{\{TEXT_HIGHLIGHT\}\}/g, theme?.textHighlight || '#FFFFFF');
  baseSvg = baseSvg.replace(/\{\{BACKGROUND\}\}/g, theme?.background || '#141414');

  // 3. Helper for safe replacement
  const replaceSafe = (key: string, value?: string) => {
    return baseSvg.replace(key, value || '');
  };

  // 4. Injection Execution
  // T3/T4 wrap preheader/body in click-to-edit spans; {{HEADLINE_HTML}} and the
  // list rows were already wrapped in their template branches above.
  baseSvg = replaceSafe('{{PREHEADER}}', content.preHeader ? wrapEditable('preHeader', content.preHeader) : '');
  baseSvg = replaceSafe('{{HEADLINE}}', content.headline);
  baseSvg = replaceSafe('{{BODY}}', content.body ? wrapEditable('body', content.body) : '');
  baseSvg = replaceSafe('{{FOOTER}}', content.footer);

  // Inject List HTML
  baseSvg = replaceSafe('{{LIST_ITEMS}}', listHtml);

  // Inject Icon SVG
  if (templateId !== 'template-3') {
    const iconSize = content.variant === 'hero' ? 150 : 80;
    const iconColor = theme?.background || '#141414';  // Icon color matches background
    const iconSvg = generateIconSVG(content.icon, iconSize, iconColor);
    baseSvg = replaceSafe('{{ICON_SVG}}', iconSvg);
  }

  // 5. Cleanup
  baseSvg = replaceSafe('{{PREHEADER}}', '');
  baseSvg = replaceSafe('{{HEADLINE}}', '');
  baseSvg = replaceSafe('{{BODY}}', '');
  baseSvg = replaceSafe('{{FOOTER}}', '');
  baseSvg = replaceSafe('{{LIST_ITEMS}}', '');
  baseSvg = replaceSafe('{{ICON_SVG}}', '');  // Cleanup icon placeholder

  // 6. Inject Signature Card from Branding Config
  let signatureCardHtml = '';
  if (branding && branding.enabled) {
    const fontFamily = (templateId === 'template-1' || templateId === 'template-3') ? 'Lato' : 'Roboto';
    signatureCardHtml = generateSignatureCard(branding, fontFamily, format, uniqueId, templateId);
  }
  baseSvg = replaceSafe('{{SIGNATURE_CARD}}', signatureCardHtml);

  return baseSvg;
};