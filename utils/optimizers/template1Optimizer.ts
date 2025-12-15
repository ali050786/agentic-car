import { SlideContent, CarouselTheme, BrandingConfig, CarouselFormat } from '../../types';
import { getWrappedTextSpans } from './textUtils';
import { imageUrlToBase64 } from '../imageUtils';
import { generatePatternPNG } from '../patternGenerator';
import { generateIconSVG } from '../iconGenerator';

/**
 * Generates a Native SVG (without foreignObject or Satori paths) for Template 1.
 */
export const generateTemplate1Native = async (
  slide: SlideContent,
  theme: CarouselTheme,
  branding?: BrandingConfig,
  format: CarouselFormat = 'portrait',
  patternId?: number,
  userPatternOpacity?: number
): Promise<string> => {
  const bg = theme.background || '#141414';
  const bg2 = theme.background2 || '#FFFFFF';
  const textDefault = theme.textDefault || '#A2A2A2';
  const textHighlight = theme.textHighlight || '#FFFFFF';
  const patternColor = theme.patternColor || '#FFFFFF';
  const patternOpacity = userPatternOpacity !== undefined ? String(userPatternOpacity) : (theme.patternOpacity || '0.2');

  // Format-specific dimensions
  const isSquare = format === 'square';
  const WIDTH = 1080;
  const HEIGHT = isSquare ? 1080 : 1384;
  const CONTENT_X = 150;
  const TEXT_WIDTH = 780;

  // Vertical Stack Cursor
  let currentY = 300; // Start Y position

  // Icon Circle - positioned at top
  const iconSize = slide.variant === 'hero' ? 150 : 80;
  const iconSvg = generateIconSVG(slide.icon, iconSize, bg);
  const iconCircleRadius = iconSize / 2;
  const iconCircleCx = CONTENT_X + iconCircleRadius;
  const iconCircleCy = currentY - 80; // Position above content

  const iconCircleSvg = slide.icon ? `
    <circle cx="${iconCircleCx}" cy="${iconCircleCy}" r="${iconCircleRadius}" fill="${bg2}"/>
    <g transform="translate(${iconCircleCx - iconSize * 0.3}, ${iconCircleCy - iconSize * 0.3})">
      ${iconSvg}
    </g>
  ` : '';

  // Preheader
  const preHeaderObj = getWrappedTextSpans(slide.preHeader || '', TEXT_WIDTH, 32, CONTENT_X);
  const preHeaderSvg = slide.preHeader ?
    `<text x="${CONTENT_X}" y="${currentY}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${textHighlight}" letter-spacing="0.05em">${preHeaderObj.spans}</text>` : '';

  if (slide.preHeader) currentY += (preHeaderObj.lineCount * 32 * 1.2) + 40; // Add height + gap

  // Headline - variant and format-specific sizes
  let hlSize = 96; // Default hero portrait
  if (slide.variant === 'hero' || slide.variant === 'cta') {
    hlSize = isSquare ? 86 : 96;
  } else { // body or list
    hlSize = isSquare ? 72 : 80;
  }
  const hlColor = textHighlight; // White for all variants

  // Combine Headline parts for flow
  const fullHeadline = slide.headline || '';
  const hlObj = getWrappedTextSpans(fullHeadline, TEXT_WIDTH, hlSize, CONTENT_X, 1.1);
  const hlSvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Oswald, sans-serif" font-weight="700" font-size="${hlSize}" fill="${hlColor}" text-transform="uppercase">${hlObj.spans}</text>`;

  currentY += (hlObj.lineCount * hlSize * 1.1) + 50; // Adjusted spacing after headline

  // Body or List
  let bodySvg = '';
  if (slide.variant === 'list' && slide.listItems) {
    // Format-specific list item font size
    const listFontSize = isSquare ? 28 : 32;
    const listItemsSvg = slide.listItems.map((item, i) => {
      // Handle both string and ListItemObject types
      let key = '';
      let val = '';
      let hasKey = false;

      if (typeof item === 'string') {
        // Original string handling logic
        const parts = item.split(':');
        hasKey = parts.length > 1;
        key = hasKey ? parts[0] + ':' : '';
        val = hasKey ? parts.slice(1).join(':') : item;
      } else {
        // Handle ListItemObject
        key = item.bullet ? item.bullet + ':' : '';
        val = item.description;
        hasKey = !!item.bullet;
      }

      // Rough calc for list item height
      const itemY = currentY;

      // Render bullet
      const bullet = `<text x="${CONTENT_X}" y="${itemY}" font-family="Lato, sans-serif" font-size="${listFontSize}" fill="${textDefault}">•</text>`;

      // Render Key
      let keySvg = '';
      let valX = CONTENT_X + 30;
      if (hasKey) {
        keySvg = `<text x="${valX}" y="${itemY}" font-family="Lato, sans-serif" font-weight="700" font-size="${listFontSize}" fill="${textHighlight}">${key}</text>`;
        valX += (key.length * 18); // Rough spacing advance for key
      }

      // Render Value (Simple wrap not fully supported in this simple list logic, simplified for single line or 2 lines)
      const valSvg = `<text x="${valX}" y="${itemY}" font-family="Lato, sans-serif" font-weight="500" font-size="${listFontSize}" fill="${textDefault}">${val}</text>`;

      currentY += 60; // Spacing per item
      return bullet + keySvg + valSvg;
    }).join('');
    bodySvg = listItemsSvg;
  } else if (slide.body) {
    // Format-specific body font size
    const bodyFontSize = isSquare ? 28 : 32;
    const bodyObj = getWrappedTextSpans(slide.body, TEXT_WIDTH, bodyFontSize, CONTENT_X, 1.3);
    bodySvg = `<text x="${CONTENT_X}" y="${currentY}" font-family="Lato, sans-serif" font-weight="300" font-size="${bodyFontSize}" fill="${textDefault}">${bodyObj.spans}</text>`;
  }

  // Footer/Bottom Area with updated swipe components (format-specific)
  const bottomRectY = isSquare ? 845 : 1104;
  const bottomSvg = `
    ${slide.variant === 'hero' ? `
    <!-- Hero: Full swipe with text -->
    <rect x="${isSquare ? 788.35 : 788}" y="${bottomRectY}" width="${isSquare ? 291.65 : 292}" height="${isSquare ? 115 : 125}" fill="${bg2}"/>
    <text x="864" y="${bottomRectY + (isSquare ? 67 : 75)}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${bg}">SWIPE</text>
    <path d="M1018,${bottomRectY + (isSquare ? 45 : 54)} l19,9 l-19,9" stroke="${bg}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M980,${bottomRectY + (isSquare ? 54 : 64)} h47" stroke="${bg}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ` : slide.variant === 'cta' ? `
    <!-- CTA: FOLLOW US button -->
    <rect x="${isSquare ? 788.35 : 700}" y="${isSquare ? bottomRectY + 6 : bottomRectY + 6}" width="${isSquare ? 291.65 : 292}" height="${isSquare ? 115 : 125}" fill="${bg2}"/>
    <text x="${isSquare ? 934 : 846}" y="${isSquare ? bottomRectY + 73 : bottomRectY + 81}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${bg}" text-anchor="middle">FOLLOW US</text>
    ` : `
    <!-- Body/List: Arrow-only narrow swipe -->
    <rect x="${isSquare ? 915.27 : 915}" y="${bottomRectY}" width="${isSquare ? 164.73 : 165}" height="${isSquare ? 115 : 125}" fill="${bg2}"/>
    <path d="M1018,${bottomRectY + (isSquare ? 45 : 54)} l19,9 l-19,9" stroke="${bg}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M980,${bottomRectY + (isSquare ? 54 : 64)} h47" stroke="${bg}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    `}
  `;

  // Decorative Lines - variant-specific positions
  const rightLineX = (slide.variant === 'hero' || slide.variant === 'cta') ? 788 : 930;
  const linesSvg = `
    <line x1="150" y1="0" x2="150" y2="${HEIGHT}" stroke="${bg2}" stroke-width="1" />
    <line x1="${rightLineX}" y1="0" x2="${rightLineX}" y2="${HEIGHT}" stroke="${bg2}" stroke-width="1" />
  `;

  // Signature Card Generation (Figma-compatible - using SVG clipPath instead of Canvas)
  let signatureSvg = '';
  if (branding && branding.enabled) {
    try {
      // Use simple base64 conversion without Canvas circular clipping
      const imageBase64 = await imageUrlToBase64(branding.imageUrl);

      // Format-specific positions
      const positions = isSquare ? {
        'bottom-left': { x: 150, y: 860 },
        'top-left': { x: 150, y: 85 },
        'top-right': { x: 550, y: 85 }
      } : {
        'bottom-left': { x: 150, y: 1120 },
        'top-left': { x: 150, y: 120 },
        'top-right': { x: 540, y: 120 }
      };

      const pos = positions[branding.position];
      const isRightAligned = branding.position === 'top-right';
      const clipId = `clip-${branding.position}-${Date.now()}`;

      if (isRightAligned) {
        signatureSvg = `
          <defs>
            <clipPath id="${clipId}">
              <circle cx="390" cy="46" r="44"/>
            </clipPath>
          </defs>
          <g transform="translate(${pos.x}, ${pos.y})">
            <circle fill="${textHighlight}" cx="390" cy="46" r="44"/>
            <image x="346" y="2" width="88" height="88" href="${imageBase64}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>
            <text fill="${textHighlight}" font-family="Lato, sans-serif" font-size="28" font-weight="500" text-anchor="end" x="335" y="44">${branding.name}</text>
            <text fill="${textDefault}" font-family="Lato, sans-serif" font-size="24" text-anchor="end" x="335" y="74">${branding.title}</text>
          </g>
        `;
      } else {
        signatureSvg = `
          <defs>
            <clipPath id="${clipId}">
              <circle cx="46" cy="46" r="44"/>
            </clipPath>
          </defs>
          <g transform="translate(${pos.x}, ${pos.y})">
            <circle fill="${textHighlight}" cx="46" cy="46" r="44"/>
            <image x="2" y="2" width="88" height="88" href="${imageBase64}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>
            <text fill="${textHighlight}" font-family="Lato, sans-serif" font-size="28" font-weight="500" x="106" y="44">${branding.name}</text>
            <text fill="${textDefault}" font-family="Lato, sans-serif" font-size="24" x="106" y="74">${branding.title}</text>
          </g>
        `;
      }
    } catch (error) {
      console.error('Failed to generate signature card for Figma:', error);
      // Skip signature card if image creation fails
      signatureSvg = '';
    }
  }

  // Get pattern from store or use default
  const selectedPatternId = patternId || 1;

  // Generate Figma-compatible pattern as PNG base64
  const patternBase64 = generatePatternPNG(selectedPatternId, WIDTH, HEIGHT, patternColor, patternOpacity);

  // Split bottom section into rect and button for proper z-index
  const bottomRectSvg = `<rect x="0" y="${bottomRectY}" width="${WIDTH}" height="${isSquare ? 235 : 275}" fill="${bg2}" opacity="0.2"/>`;

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
      <image x="0" y="0" width="${WIDTH}" height="${HEIGHT}" href="${patternBase64}" preserveAspectRatio="none"/>
      ${linesSvg}
      ${iconCircleSvg}
      ${preHeaderSvg}
      ${hlSvg}
      ${bodySvg}
      ${bottomRectSvg}
      ${bottomSvg}
      ${signatureSvg}
    </svg>
  `;
};