import { SlideContent, CarouselTheme, BrandingConfig } from '../types';
import { T1_HERO_SVG, T1_BODY_SVG, T1_LIST_SVG, T1_CTA_SVG } from '../assets/templates/template1';
import { T2_HERO_SVG, T2_BODY_SVG, T2_LIST_SVG, T2_CTA_SVG } from '../assets/templates/template2';
import { generateSignatureCard } from './signatureCardGenerator';

/**
 * The Injector Engine.
 * Takes the raw SVG string and replaces placeholder tokens with actual content and theme colors.
 */
export const injectContentIntoSvg = (
  templateId: string,
  content: SlideContent,
  theme: CarouselTheme | null,
  branding?: BrandingConfig
): string => {
  let baseSvg = '';
  let listHtml = '';
  let themeCss = '';

  // 1. Select Base SVG
  if (templateId === 'template-1') {
    switch (content.variant) {
      case 'hero': baseSvg = T1_HERO_SVG; break;
      case 'body': baseSvg = T1_BODY_SVG; break;
      case 'list': baseSvg = T1_LIST_SVG; break;
      case 'closing': baseSvg = T1_CTA_SVG; break;
      default: baseSvg = T1_HERO_SVG;
    }

    // T1: Inject CSS Variables for Theme
    themeCss = `
      :root {
        --text-default: ${theme?.textDefault || '#A2A2A2'};
        --text-highlight: ${theme?.textHighlight || '#FFFFFF'};
        --background: ${theme?.background || '#141414'};
        --background-2: ${theme?.background2 || 'rgba(255, 255, 255, 0.1)'};
      }
    `;

    // T1 List Style (Matching PDF Slide 3: Bullet + Bold Key)
    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item) => {
        const parts = item.split(':');
        const title = parts.length > 1 ? parts[0] + ':' : '';
        const desc = parts.length > 1 ? parts.slice(1).join(':') : item;

        return `
          <div style="display: flex; align-items: flex-start; gap: 24px; font-family: 'Lato', sans-serif; font-weight: 500; font-size: 32px; color: var(--text-default); line-height: 1.2;">
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
    switch (content.variant) {
      case 'hero': baseSvg = T2_HERO_SVG; break;
      case 'body': baseSvg = T2_BODY_SVG; break;
      case 'list': baseSvg = T2_LIST_SVG; break;
      case 'closing': baseSvg = T2_CTA_SVG; break;
      default: baseSvg = T2_HERO_SVG;
    }

    // T2: Inject CSS Variables for Theme (Exact PDF Mapping)
    themeCss = `
      :root {
        --background: ${theme?.background || '#091c33'};
        --text-highlight: ${theme?.textHighlight || '#f4782d'};
        --background-2: ${theme?.background2 || '#6d51a2'};
        --text-default: ${theme?.textDefault || '#ffffff'};
        
        /* Gradient Stops */
        --bg-grad-start: ${theme?.bgGradStart || '#6d51a2'};
        --bg-grad-end: ${theme?.bgGradEnd || '#091c33'};
      }
    `;

    // T2 List Style (Matching PDF Slide 7: Bullet + Bold Key)
    listHtml = content.listItems && content.listItems.length > 0
      ? content.listItems.map((item) => {
        // Split "Key: Value" -> ["Key", "Value"]
        const parts = item.split(':');
        const title = parts.length > 1 ? parts[0] + ':' : '';
        const desc = parts.length > 1 ? parts.slice(1).join(':') : item;

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
  }

  // Inject Theme CSS
  baseSvg = baseSvg.replace('{{THEME_CSS}}', themeCss);

  // 3. Helper for safe replacement
  const replaceSafe = (key: string, value?: string) => {
    return baseSvg.replace(key, value || '');
  };

  // 4. Injection Execution
  baseSvg = replaceSafe('{{PREHEADER}}', content.preHeader);
  baseSvg = replaceSafe('{{HEADLINE}}', content.headline);
  baseSvg = replaceSafe('{{HEADLINE_HIGHLIGHT}}', content.headlineHighlight);
  baseSvg = replaceSafe('{{BODY}}', content.body);
  baseSvg = replaceSafe('{{FOOTER}}', content.footer);

  // Inject List HTML
  baseSvg = replaceSafe('{{LIST_ITEMS}}', listHtml);

  // 5. Cleanup
  baseSvg = replaceSafe('{{PREHEADER}}', '');
  baseSvg = replaceSafe('{{HEADLINE}}', '');
  baseSvg = replaceSafe('{{HEADLINE_HIGHLIGHT}}', '');
  baseSvg = replaceSafe('{{BODY}}', '');
  baseSvg = replaceSafe('{{FOOTER}}', '');
  baseSvg = replaceSafe('{{LIST_ITEMS}}', '');

  // 6. Inject Signature Card from Branding Config
  let signatureCardHtml = '';
  if (branding && branding.enabled) {
    const fontFamily = templateId === 'template-1' ? 'Lato' : 'Roboto';
    signatureCardHtml = generateSignatureCard(branding, fontFamily);
  }
  baseSvg = replaceSafe('{{SIGNATURE_CARD}}', signatureCardHtml);

  return baseSvg;
};