import { BrandingConfig, SignaturePosition, CarouselFormat } from '../types';

/**
 * Generate signature card SVG based on position, font family, and format
 */
export const generateSignatureCard = (
  data: BrandingConfig,
  fontFamily: 'Lato' | 'Roboto',
  format: CarouselFormat = 'portrait',
  uniqueId: string = ''
): string => {
  // Helper to escape XML special characters
  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
      return c;
    });
  };

  const escapedImageUrl = escapeXml(data.imageUrl);

  // Position coordinates - format-specific
  const positions = format === 'square' ? {
    'bottom-left': { x: 150, y: 860 },
    'top-left': { x: 150, y: 85 },
    'top-right': { x: 550, y: 85 }
  } : {
    'bottom-left': { x: 150, y: 1120 },
    'top-left': { x: 150, y: 120 },
    'top-right': { x: 540, y: 120 }
  };

  const pos = positions[data.position];
  const isRightAligned = data.position === 'top-right';

  // For right-aligned, we need different layout
  if (isRightAligned) {
    const clipPathId = `clippath-${data.position}-${uniqueId}`;
    return `
      <g id="signatureCard-${data.position}-${uniqueId}" transform="translate(${pos.x}, ${pos.y})" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <clipPath id="${clipPathId}">
            <circle style="fill: #fff;" cx="390" cy="46" r="40"/>
          </clipPath>
        </defs>
        <circle style="fill: #fff;" cx="390" cy="46" r="44"/>
        <circle style="fill: #fff;" cx="390" cy="46" r="40"/>
        <g style="clip-path: url(#${clipPathId});">
          <image x="345" y="2" width="90" height="90" preserveAspectRatio="xMidYMid slice" href="${escapedImageUrl}" xlink:href="${escapedImageUrl}"/>
        </g>
        <text style="fill: var(--text-highlight); font-family: ${fontFamily}, sans-serif; font-size: 28px; font-weight: 500; text-anchor: end;" transform="translate(335 44)">
          ${escapeXml(data.name)}
        </text>
        <text style="fill: var(--text-default); font-family: ${fontFamily}, sans-serif; font-size: 24px; text-anchor: end;" transform="translate(335 74)">
          ${escapeXml(data.title)}
        </text>
      </g>
    `;
  }

  // Left-aligned signature cards (bottom-left and top-left)
  const clipPathId = `clippath-${data.position}-${uniqueId}`;
  return `
    <g id="signatureCard-${data.position}-${uniqueId}" transform="translate(${pos.x}, ${pos.y})" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <clipPath id="${clipPathId}">
          <circle style="fill: #fff;" cx="46" cy="46" r="40"/>
        </clipPath>
      </defs>
      <circle style="fill: #fff;" cx="46" cy="46" r="44"/>
      <circle style="fill: #fff;" cx="46" cy="46" r="40"/>
      <g style="clip-path: url(#${clipPathId});">
        <image x="-1" y="-1" width="90" height="90" preserveAspectRatio="xMidYMid slice" href="${escapedImageUrl}" xlink:href="${escapedImageUrl}"/>
      </g>
      <text style="fill: var(--text-highlight); font-family: ${fontFamily}, sans-serif; font-size: 28px; font-weight: 500;" transform="translate(106 44)">
        ${escapeXml(data.name)}
      </text>
      <text style="fill: var(--text-default); font-family: ${fontFamily}, sans-serif; font-size: 24px;" transform="translate(106 74)">
        ${escapeXml(data.title)}
      </text>
    </g>
  `;
};
