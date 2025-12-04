import { SlideContent, CarouselTheme } from '../../types';
import { getWrappedTextSpans } from './textUtils';

/**
 * Generates a Native SVG (without foreignObject or Satori paths) for Template 2.
 */
export const generateTemplate2Native = (slide: SlideContent, theme: CarouselTheme): string => {
  const bg = theme.background || '#091c33';
  const textHighlight = theme.textHighlight || '#f4782d';
  const bg2 = theme.background2 || '#6d51a2';
  const textDefault = theme.textDefault || '#ffffff';
  const bgGradStart = theme.bgGradStart || '#6d51a2';
  const bgGradEnd = theme.bgGradEnd || '#091c33';
  
  const WIDTH = 1080;
  const HEIGHT = 1374;
  const CONTENT_X = 150;
  const TEXT_WIDTH = 800;

  let currentY = 240;

  // Preheader
  const preHeaderObj = getWrappedTextSpans(slide.preHeader || '', TEXT_WIDTH, 32, CONTENT_X);
  const preHeaderSvg = slide.preHeader ? 
    `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="400" font-size="32" fill="${textDefault}">${preHeaderObj.spans}</text>` : '';
  
  if (slide.preHeader) currentY += (preHeaderObj.lineCount * 32 * 1.2) + 40;

  // Headline
  const hlSize = slide.variant === 'hero' || slide.variant === 'closing' ? 104 : 80;
  
  const hlObj = getWrappedTextSpans(slide.headline || '', TEXT_WIDTH, hlSize, CONTENT_X, 1.1);
  const hlSvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="900" font-size="${hlSize}" fill="${textDefault}" text-transform="${slide.variant === 'hero' ? 'none' : 'uppercase'}">${hlObj.spans}</text>`;
  
  currentY += (hlObj.lineCount * hlSize * 1.1) + 10;

  const hlHighObj = getWrappedTextSpans(slide.headlineHighlight || '', TEXT_WIDTH, hlSize, CONTENT_X, 1.1);
  const hlHighSvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="900" font-size="${hlSize}" fill="${textHighlight}" text-transform="${slide.variant === 'hero' ? 'none' : 'uppercase'}">${hlHighObj.spans}</text>`;

  currentY += (hlHighObj.lineCount * hlSize * 1.1) + 50;

  // Body or List
  let bodySvg = '';
  if (slide.variant === 'list' && slide.listItems) {
     const listItemsSvg = slide.listItems.map((item, i) => {
       const parts = item.split(':');
       const hasKey = parts.length > 1;
       const key = hasKey ? parts[0] + ':' : '';
       const val = hasKey ? parts.slice(1).join(':') : item;
       
       const itemY = currentY;
       
       const bullet = `<text x="${CONTENT_X}" y="${itemY}" font-family="Roboto, sans-serif" font-size="32" fill="${textHighlight}">•</text>`;
       
       let keySvg = '';
       let valX = CONTENT_X + 30;
       if (hasKey) {
           keySvg = `<text x="${valX}" y="${itemY}" font-family="Roboto, sans-serif" font-weight="700" font-size="32" fill="${textHighlight}">${key}</text>`;
           valX += (key.length * 20); 
       }
       
       const valSvg = `<text x="${valX}" y="${itemY}" font-family="Roboto, sans-serif" font-weight="500" font-size="32" fill="${textDefault}">${val}</text>`;

       currentY += 60;
       return bullet + keySvg + valSvg;
     }).join('');
     bodySvg = listItemsSvg;
  } else if (slide.body) {
     const bodyObj = getWrappedTextSpans(slide.body, TEXT_WIDTH, 32, CONTENT_X, 1.4);
     bodySvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="500" font-size="32" fill="${textDefault}">${bodyObj.spans}</text>`;
  }

  // Swipe/CTA
  const btnY = 903;
  const btnSvg = `
    <rect x="150" y="${btnY}" width="292" height="125" fill="${textHighlight}"/>
    <text x="${slide.variant === 'closing' ? 296 : 227}" y="${btnY + 75}" font-family="Roboto, sans-serif" font-weight="700" font-size="32" fill="${bg}" text-anchor="${slide.variant === 'closing' ? 'middle' : 'start'}">${slide.variant === 'closing' ? 'FOLLOW US' : 'SWIPE ->'}</text>
  `;

  // --- Background & Decorative Elements ---

  // 1. Defs for Gradient
  // Added fx and fy to move the focal point of the gradient to the top-right
  const defs = `
    <defs>
      <radialGradient id="t2-native-grad" cx="845.36" cy="241.41" fx="1350.00" fy="0" r="416.24" gradientUnits="userSpaceOnUse" gradientTransform="translate(-517.29 -50.02) scale(1.48 1.68)">
        <stop offset="0" stop-color="${bgGradStart}"/>
        <stop offset="0.59" stop-color="${bgGradEnd}"/>
      </radialGradient>
    </defs>
  `;

  // 2. Background Layers
  const backgroundSvg = `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
    <!-- Gradient Design Element -->
    <path d="M386.97,5.06c0,2.31,0,4.61.02,6.92,3.77,382.43,312.55,690.44,693,695.27V5.06H386.97Z" fill="url(#t2-native-grad)"/>
    <!-- Bottom Arch Design -->
    <path d="M839.49,1326.66c23.07-116.89,125.7-197.83,240.51-197.7v-112.29c-197.43,0-357.47,160.04-357.47,357.47h112.29c.02-15.66,1.52-31.54,4.67-47.48Z" fill="${bg2}"/>
  `;

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${defs}
      ${backgroundSvg}
      ${preHeaderSvg}
      ${hlSvg}
      ${hlHighSvg}
      ${bodySvg}
      ${btnSvg}
    </svg>
  `;
};