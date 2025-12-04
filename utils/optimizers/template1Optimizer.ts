import { SlideContent, CarouselTheme } from '../../types';
import { getWrappedTextSpans } from './textUtils';

/**
 * Generates a Native SVG (without foreignObject or Satori paths) for Template 1.
 */
export const generateTemplate1Native = (slide: SlideContent, theme: CarouselTheme): string => {
  const bg = theme.background || '#141414';
  const bg2 = theme.background2 || '#333333';
  const textDefault = theme.textDefault || '#A2A2A2';
  const textHighlight = theme.textHighlight || '#FFFFFF';
  
  const WIDTH = 1080;
  const HEIGHT = 1384;
  const CONTENT_X = 150;
  const TEXT_WIDTH = 780;
  
  // Vertical Stack Cursor
  let currentY = 300; // Start Y position

  // Preheader
  const preHeaderObj = getWrappedTextSpans(slide.preHeader || '', TEXT_WIDTH, 32, CONTENT_X);
  const preHeaderSvg = slide.preHeader ? 
    `<text x="${CONTENT_X}" y="${currentY}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${textHighlight}" letter-spacing="0.05em">${preHeaderObj.spans}</text>` : '';
  
  if (slide.preHeader) currentY += (preHeaderObj.lineCount * 32 * 1.2) + 40; // Add height + gap

  // Headline
  const hlSize = slide.variant === 'hero' || slide.variant === 'closing' ? 96 : 80;
  const hlColor = slide.variant === 'hero' ? textDefault : textDefault; // Can vary
  
  // Combine Headline parts for flow
  const fullHeadline = slide.headline || '';
  const hlObj = getWrappedTextSpans(fullHeadline, TEXT_WIDTH, hlSize, CONTENT_X, 1.1);
  const hlSvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Oswald, sans-serif" font-weight="700" font-size="${hlSize}" fill="${hlColor}" text-transform="uppercase">${hlObj.spans}</text>`;
  
  currentY += (hlObj.lineCount * hlSize * 1.1) + 10;

  const hlHighObj = getWrappedTextSpans(slide.headlineHighlight || '', TEXT_WIDTH, hlSize, CONTENT_X, 1.1);
  const hlHighSvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Oswald, sans-serif" font-weight="700" font-size="${hlSize}" fill="${textHighlight}" text-transform="uppercase">${hlHighObj.spans}</text>`;

  currentY += (hlHighObj.lineCount * hlSize * 1.1) + 50;

  // Body or List
  let bodySvg = '';
  if (slide.variant === 'list' && slide.listItems) {
     const listItemsSvg = slide.listItems.map((item, i) => {
       const parts = item.split(':');
       const hasKey = parts.length > 1;
       const key = hasKey ? parts[0] + ':' : '';
       const val = hasKey ? parts.slice(1).join(':') : item;
       
       // Rough calc for list item height
       const itemY = currentY;
       
       // Render bullet
       const bullet = `<text x="${CONTENT_X}" y="${itemY}" font-family="Lato, sans-serif" font-size="32" fill="${textDefault}">•</text>`;
       
       // Render Key
       let keySvg = '';
       let valX = CONTENT_X + 30;
       if (hasKey) {
           keySvg = `<text x="${valX}" y="${itemY}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${textHighlight}">${key}</text>`;
           valX += (key.length * 18); // Rough spacing advance for key
       }
       
       // Render Value (Simple wrap not fully supported in this simple list logic, simplified for single line or 2 lines)
       const valSvg = `<text x="${valX}" y="${itemY}" font-family="Lato, sans-serif" font-weight="500" font-size="32" fill="${textDefault}">${val}</text>`;

       currentY += 60; // Spacing per item
       return bullet + keySvg + valSvg;
     }).join('');
     bodySvg = listItemsSvg;
  } else if (slide.body) {
     const bodyObj = getWrappedTextSpans(slide.body, TEXT_WIDTH, 32, CONTENT_X, 1.3);
     bodySvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Lato, sans-serif" font-weight="300" font-size="32" fill="${textDefault}">${bodyObj.spans}</text>`;
  }

  // Footer/Bottom Area
  const bottomRectY = 1104;
  const bottomSvg = `
    <rect x="0" y="${bottomRectY}" width="${WIDTH}" height="275" fill="${bg2}"/>
    ${(slide.variant !== 'closing') ? `
    <rect x="788" y="${bottomRectY}" width="292" height="125" fill="${textHighlight}"/>
    <text x="860" y="${bottomRectY + 75}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${bg}">SWIPE -></text>
    ` : `
    <rect x="150" y="${bottomRectY - 174}" width="292" height="125" fill="${textHighlight}"/>
    <text x="200" y="${bottomRectY - 100}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${bg}">FOLLOW US</text>
    `}
  `;

  // Decorative Lines
  const linesSvg = `
    <line x1="150" y1="0" x2="150" y2="${HEIGHT}" stroke="${bg2}" stroke-width="1" />
    <line x1="${slide.variant === 'closing' ? 788 : 930}" y1="0" x2="${slide.variant === 'closing' ? 788 : 930}" y2="${HEIGHT}" stroke="${bg2}" stroke-width="1" />
  `;

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
      ${linesSvg}
      ${preHeaderSvg}
      ${hlSvg}
      ${hlHighSvg}
      ${bodySvg}
      ${bottomSvg}
    </svg>
  `;
};