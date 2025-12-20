import { SlideContent, CarouselTheme, BrandingConfig, CarouselFormat } from '../types';
import { T1_HERO_SVG, T1_BODY_SVG, T1_LIST_SVG, T1_CTA_SVG } from '../assets/templates/template1';
import { T2_HERO_SVG, T2_BODY_SVG, T2_LIST_SVG, T2_CTA_SVG } from '../assets/templates/template2';
import { T1_HERO_SVG_SQUARE, T1_BODY_SVG_SQUARE, T1_LIST_SVG_SQUARE, T1_CTA_SVG_SQUARE } from '../assets/templates/template1_square';
import { T2_HERO_SVG_SQUARE, T2_BODY_SVG_SQUARE, T2_LIST_SVG_SQUARE, T2_CTA_SVG_SQUARE } from '../assets/templates/template2_square';
import { T3_HERO_SVG, T3_BODY_SVG, T3_LIST_SVG, T3_CTA_SVG } from '../assets/templates/template3';
import { T3_HERO_SVG_SQUARE, T3_BODY_SVG_SQUARE, T3_LIST_SVG_SQUARE, T3_CTA_SVG_SQUARE } from '../assets/templates/template3_square';
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

    // Conditionally adjust foreignObject position for bottom-left signature (T1)
    if (branding && branding.enabled && branding.position === 'bottom-left') {
      if (isSquare) {
        // Square: y="180" -> y="120" (move up 60px)
        baseSvg = baseSvg.replace(/foreignObject x="150" y="180"/g, 'foreignObject x="150" y="120"');
      } else {
        // Portrait: y="220" -> y="160" (move up 60px)
        baseSvg = baseSvg.replace(/foreignObject x="150" y="220"/g, 'foreignObject x="150" y="160"');
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

    // T1 List Style (Matching Updated Design: Bullet + Bold Key)
    // Format-specific sizing: Portrait 32px/1.2, Square 28px/1.35
    const listFontSize = isSquare ? '28px' : '32px';
    const listLineHeight = isSquare ? '1.35' : '1.2';

    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item) => {
        // Handle both string format and object format
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] + ':' : '';
          desc = parts.length > 1 ? parts.slice(1).join(':') : item;
        } else if (typeof item === 'object' && item !== null) {
          // Object format: { bullet: 'Key:', description: 'Value' }
          title = item.bullet || '';
          desc = item.description || '';
        }

        return `
          <div style="display: flex; align-items: flex-start; gap: 24px; font-family: 'Lato', sans-serif; font-weight: 500; font-size: ${listFontSize}; color: var(--text-default); line-height: ${listLineHeight};">
            <div style="min-width: 20px;">•</div>
            <div>
              ${title ? `<span style="color: var(--text-highlight); font-weight: 700;">${title}</span>` : ''} 
              ${desc}
            </div>
          </div>
          `;
      }).join('')
      : '';


  } else if (templateId === 'template-2') {
    if (isSquare) {
      switch (content.variant) {
        case 'hero': baseSvg = T2_HERO_SVG_SQUARE; break;
        case 'body': baseSvg = T2_BODY_SVG_SQUARE; break;
        case 'list': baseSvg = T2_LIST_SVG_SQUARE; break;
        case 'cta':
        case 'closing':  // LLM uses 'closing' variant
          baseSvg = T2_CTA_SVG_SQUARE;
          break;
        default: baseSvg = T2_HERO_SVG_SQUARE;
      }
    } else {
      switch (content.variant) {
        case 'hero': baseSvg = T2_HERO_SVG; break;
        case 'body': baseSvg = T2_BODY_SVG; break;
        case 'list': baseSvg = T2_LIST_SVG; break;
        case 'cta':
        case 'closing':  // LLM uses 'closing' variant
          baseSvg = T2_CTA_SVG;
          break;
        default: baseSvg = T2_HERO_SVG;
      }
    }

    // 2. Conditionally adjust foreignObject position for bottom-left signature
    // Move content up to create better spacing when bottom signature is visible
    if (branding && branding.enabled && branding.position === 'bottom-left') {
      if (isSquare) {
        // Square: y="220" -> y="160" (move up 60px) for hero
        baseSvg = baseSvg.replace(/foreignObject x="150" y="220"/g, 'foreignObject x="150" y="160"');
        // Square: y="200" -> y="140" (move up 60px) for body/list/cta
        baseSvg = baseSvg.replace(/foreignObject x="150" y="200"/g, 'foreignObject x="150" y="140"');
      } else {
        // Portrait: y="240" -> y="180" (move up 60px)
        baseSvg = baseSvg.replace(/foreignObject x="150" y="240"/g, 'foreignObject x="150" y="180"');
      }
    }

    // T2: Inject CSS Variables for Theme (Exact PDF Mapping)
    themeCss = `
      :root {
        --background: ${theme?.background || '#091c33'};
        --text-highlight: ${theme?.textHighlight || '#f4782d'};
        --background-2: ${theme?.background2 || '#6d51a2'};
        --button-color: ${theme?.buttonColor || theme?.textHighlight || '#f4782d'};
        --text-default: ${theme?.textDefault || '#ffffff'};
        --pattern-color: ${theme?.patternColor || '#1A3A52'};
        --pattern-opacity: ${patternOpacity !== undefined ? patternOpacity : (theme?.patternOpacity || '0.2')};
        
        /* Gradient Stops */
        --bg-grad-start: ${theme?.bgGradStart || '#6d51a2'};
        --bg-grad-end: ${theme?.bgGradEnd || '#091c33'};
      }
    `;

    // T2 List Style (Matching PDF Slide 7: Bullet + Bold Key)
    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item) => {
        // Handle both string format and object format
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          // Split "Key: Value" -> ["Key", "Value"]
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] + ':' : '';
          desc = parts.length > 1 ? parts.slice(1).join(':') : item;
        } else if (typeof item === 'object' && item !== null) {
          // Object format: { bullet: 'Key:', description: 'Value' }
          title = item.bullet || '';
          desc = item.description || '';
        }

        return `
          <div style="display: flex; align-items: flex-start; gap: 20px; font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 32px; color: var(--text-default); line-height: 1.4;">
             <div style="min-width: 15px; color: var(--text-highlight);">•</div>
             <div>
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

    // T3: Shift content DOWN for top signatures to avoid overlap
    if (branding && branding.enabled && (branding.position === 'top-left' || branding.position === 'top-right')) {
      if (isSquare) {
        // Square Hero/CTA: y="100" -> y="160"
        baseSvg = baseSvg.replace(/foreignObject x="80" y="100"/g, 'foreignObject x="80" y="160"');
        // Square Body/List: y="200" -> y="260"
        baseSvg = baseSvg.replace(/foreignObject x="80" y="200"/g, 'foreignObject x="80" y="260"');
      } else {
        // Portrait: y="160" -> y="220"
        baseSvg = baseSvg.replace(/foreignObject x="80" y="160"/g, 'foreignObject x="80" y="220"');
      }
    }

    // T3: Inject CSS Variables for Theme (Sketch Style)
    themeCss = `
      :root {
        --text-default: ${theme?.textDefault || '#1E1B4B'};
        --text-highlight: ${theme?.textHighlight || '#9333EA'};
        --background: ${theme?.background || '#FFFFFF'};
        --background-2: ${theme?.background2 || '#055569'};
        --pattern-color: ${theme?.patternColor || '#E0E7FF'};
        --pattern-opacity: ${patternOpacity !== undefined ? patternOpacity : (theme?.patternOpacity || '0.1')};
      }
    `;

    // T3 List Style (Sketchy Bullet)
    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item) => {
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

        const listFontSize = isSquare ? '26px' : '32px';

        return `
          <div style="display: flex; align-items: flex-start; gap: 20px; font-family: 'Lato', sans-serif; font-weight: 500; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.4;">
            <div style="min-width: 15px; color: var(--text-highlight);">•</div>
            <div>
              ${title ? `<span style="color: var(--text-highlight); font-weight: 700;">${title}</span>` : ''} 
              ${desc}
            </div>
          </div>
          `;
      }).join('')
      : '';

    // T3: Dynamic Doodle Image URL
    const fallbackDoodle = `https://image.pollinations.ai/prompt/A%20simple%20blackpencil%20doodle%20sketch%20of%20a%20rocket%20ship%20launching%20upwards%20representing%20startup%20growth%20isolated%20on%20strict%20pure%20white%20background%20%23FFFFFF?width=600&height=1000&nologo=true`;
    const doodleUrl = content.doodleUrl || fallbackDoodle;
    baseSvg = baseSvg.replace('{{DOODLE_IMAGE_URL}}', doodleUrl);
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
  baseSvg = replaceSafe('{{PREHEADER}}', content.preHeader);
  baseSvg = replaceSafe('{{HEADLINE}}', content.headline);
  baseSvg = replaceSafe('{{BODY}}', content.body);
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