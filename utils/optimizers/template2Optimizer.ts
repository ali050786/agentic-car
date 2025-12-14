import { SlideContent, CarouselTheme, BrandingConfig, CarouselFormat } from '../../types';
import { getWrappedTextSpans } from './textUtils';
import { imageUrlToBase64 } from '../imageUtils';
import { generatePatternPNG } from '../patternGenerator';
import { generateIconSVG } from '../iconGenerator';

/**
 * Generates a Native SVG (without foreignObject) for Template 2 - Figma Export
 * Supports both portrait (1080x1374.14) and square (1080x1080) formats
 */
export const generateTemplate2Native = async (
  slide: SlideContent,
  theme: CarouselTheme,
  branding?: BrandingConfig,
  format: CarouselFormat = 'portrait',
  patternId?: number
): Promise<string> => {
  const bg = theme.background || '#091c33';
  const textHighlight = theme.textHighlight || '#f4782d';
  const bg2 = theme.background2 || '#6d51a2';
  const textDefault = theme.textDefault || '#ffffff';
  const bgGradStart = theme.bgGradStart || '#6d51a2';
  const bgGradEnd = theme.bgGradEnd || '#091c33';
  const patternColor = theme.patternColor || '#FFFFFF';
  const patternOpacity = theme.patternOpacity || '0.1';

  // Format-specific dimensions
  const isSquare = format === 'square';
  const WIDTH = 1080;
  const HEIGHT = isSquare ? 1080 : 1374.14;
  const CONTENT_X = 150;
  const TEXT_WIDTH = 800;

  // Vertical Stack Cursor
  let currentY = isSquare ? 250 : 280;

  // Icon Circle - positioned at top, using button color for Template 2
  const iconSize = slide.variant === 'hero' ? 150 : 80;
  const iconSvg = generateIconSVG(slide.icon, iconSize, bg);
  const iconCircleRadius = iconSize / 2;
  const iconCircleCx = CONTENT_X + iconCircleRadius;
  const iconCircleCy = currentY - 80; // Position above content

  const iconCircleSvg = slide.icon ? `
    <circle cx="${iconCircleCx}" cy="${iconCircleCy}" r="${iconCircleRadius}" fill="${textHighlight}"/>
    <g transform="translate(${iconCircleCx - iconSize * 0.3}, ${iconCircleCy - iconSize * 0.3})">
      ${iconSvg}
    </g>
  ` : '';

  // PreHeader (FIXED: Now uses textHighlight color)
  const preHeaderObj = getWrappedTextSpans(slide.preHeader || '', TEXT_WIDTH, 32, CONTENT_X);
  const preHeaderSvg = slide.preHeader ?
    `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="400" font-size="32" fill="${textHighlight}">${preHeaderObj.spans}</text>` : '';

  if (slide.preHeader) currentY += (preHeaderObj.lineCount * 32 * 1.2) + 50;

  // Headline - variant and format-specific sizes
  let hlSize = 92; // Default hero portrait
  if (slide.variant === 'hero') {
    hlSize = isSquare ? 86 : 92;
  } else if (slide.variant === 'cta') {
    hlSize = isSquare ? 86 : 104;
  } else { // body or list
    hlSize = isSquare ? 66 : 80;
  }

  const hlObj = getWrappedTextSpans(slide.headline || '', TEXT_WIDTH, hlSize, CONTENT_X, 1.1);
  const textTransform = slide.variant === 'hero' ? 'none' : 'uppercase';
  const hlSvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="900" font-size="${hlSize}" fill="${textDefault}" text-transform="${textTransform}">${hlObj.spans}</text>`;

  currentY += (hlObj.lineCount * hlSize * 1.1) + 60;

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
    const bodySize = isSquare ? 28 : 32;
    const bodyObj = getWrappedTextSpans(slide.body, TEXT_WIDTH, bodySize, CONTENT_X, 1.4);
    bodySvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Roboto, sans-serif" font-weight="500" font-size="${bodySize}" fill="${textDefault}">${bodyObj.spans}</text>`;
  }

  // Swipe/CTA Button - format-specific positioning
  const btnY = isSquare ? 850 : 1053;
  const btnX = isSquare ? 670 : 658;
  const btnSvg = `
    <rect x="${btnX}" y="${btnY}" width="292" height="125" fill="${textHighlight}"/>
    <text x="${slide.variant === 'cta' ? btnX + 146 : btnX + 77}" y="${btnY + 75}" font-family="Roboto, sans-serif" font-weight="700" font-size="32" letter-spacing="0.05em" fill="${bg}" text-anchor="${slide.variant === 'cta' ? 'middle' : 'start'}">${slide.variant === 'cta' ? 'FOLLOW US' : 'SWIPE'}</text>
    ${slide.variant !== 'cta' ? `
      <path d="M${btnX + 230},${btnY + 54} l9.31,9.18 l-9.31,9.18" fill="none" stroke="${bg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${btnX + 193},${btnY + 63} h46.54" fill="none" stroke="${bg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ` : ''}
  `;

  // Background & Decorative Elements
  const defs = `
    <defs>
      <radialGradient id="t2-native-grad" cx="845.36" cy="241.41" fx="1157.19" fy="-34.3" r="416.24" gradientUnits="userSpaceOnUse" gradientTransform="translate(-517.29 -50.02) scale(1.48 1.68)">
        <stop offset="0" stop-color="${bgGradStart}"/>
        <stop offset="0.59" stop-color="${bgGradEnd}"/>
      </radialGradient>
    </defs>
  `;

  const backgroundSvg = `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
    <!-- Gradient Design Element (behind pattern) -->
    <g transform="translate(2, -5)">
      <path d="M386.97,5.06c0,2.31,0,4.61.02,6.92,3.77,382.43,312.55,690.44,693,695.27V5.06H386.97Z" fill="url(#t2-native-grad)"/>
    </g>
    <!-- Bottom Arch Design -->
    <path d="M839.49,${isSquare ? 1032.66 : 1326.66}c23.07-116.89,125.7-197.83,240.51-197.7v-112.29c-197.43,0-357.47,160.04-357.47,357.47h112.29c.02-15.66,1.52-31.54,4.67-47.48Z" fill="${bg2}"/>
  `;

  // Signature Card Generation (with avatar image handling)
  let signatureSvg = '';
  if (branding && branding.enabled) {
    try {
      // Convert image URL to base64
      const imageBase64 = await imageUrlToBase64(branding.imageUrl);

      // Format-specific positions
      const positions = isSquare ? {
        'bottom-left': { x: 150, y: 870 },
        'bottom-right': { x: 150, y: 870 },
        'top-left': { x: 150, y: 100 },
        'top-right': { x: 520, y: 100 }
      } : {
        'bottom-left': { x: 150, y: 1070 },
        'bottom-right': { x: 150, y: 1070 },
        'top-left': { x: 150, y: 120 },
        'top-right': { x: 520, y: 120 }
      };

      const pos = positions[branding.position];
      const isRightAligned = branding.position === 'top-right';
      const clipId = `clip-${branding.position}-${Date.now()}`;

      if (isRightAligned) {
        signatureSvg = `
          <defs>
            <clipPath id="${clipId}">
              <circle cx="390" cy="46" r="40"/>
            </clipPath>
          </defs>
          <g transform="translate(${pos.x}, ${pos.y})">
            <circle fill="${textHighlight}" cx="390" cy="46" r="44"/>
            <circle fill="${textHighlight}" cx="390" cy="46" r="40"/>
            <image x="346" y="2" width="88" height="88" href="${imageBase64}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>
            <text fill="${textHighlight}" font-family="Roboto, sans-serif" font-size="28" font-weight="500" text-anchor="end" x="335" y="44">${branding.name}</text>
            <text fill="${textDefault}" font-family="Roboto, sans-serif" font-size="24" text-anchor="end" x="335" y="74">${branding.title}</text>
          </g>
        `;
      } else {
        signatureSvg = `
          <defs>
            <clipPath id="${clipId}">
              <circle cx="46" cy="46" r="40"/>
            </clipPath>
          </defs>
          <g transform="translate(${pos.x}, ${pos.y})">
            <circle fill="${textHighlight}" cx="46" cy="46" r="44"/>
            <circle fill="${textHighlight}" cx="46" cy="46" r="40"/>
            <image x="2" y="2" width="88" height="88" href="${imageBase64}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>
            <text fill="${textHighlight}" font-family="Roboto, sans-serif" font-size="28" font-weight="500" x="106" y="44">${branding.name}</text>
            <text fill="${textDefault}" font-family="Roboto, sans-serif" font-size="24" x="106" y="74">${branding.title}</text>
          </g>
        `;
      }
    } catch (error) {
      console.error('Failed to generate signature card for Figma:', error);
      signatureSvg = '';
    }
  }

  // Get pattern from store or use default
  const selectedPatternId = patternId || 1;

  // Generate Figma-compatible pattern as PNG base64
  const patternBase64 = generatePatternPNG(selectedPatternId, WIDTH, HEIGHT, patternColor, patternOpacity);

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="t2-native-grad" cx="845.36" cy="241.41" fx="1157.19" fy="-34.3" r="416.24" gradientUnits="userSpaceOnUse" gradientTransform="translate(-517.29 -50.02) scale(1.48 1.68)">
          <stop offset="0" stop-color="${bgGradStart}"/>
          <stop offset="0.59" stop-color="${bgGradEnd}"/>
        </radialGradient>
      </defs>
      ${backgroundSvg}
      <image x="0" y="0" width="${WIDTH}" height="${HEIGHT}" href="${patternBase64}" preserveAspectRatio="none"/>
      ${iconCircleSvg}
      ${preHeaderSvg}
      ${hlSvg}
      ${bodySvg}
      ${btnSvg}
      ${signatureSvg}
    </svg>
  `;
};