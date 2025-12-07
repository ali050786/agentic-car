import { BrandingConfig, SignaturePosition, CarouselFormat } from '../types';

/**
 * Generate signature card SVG based on position, font family, and format
 */
export const generateSignatureCard = (
  data: BrandingConfig,
  fontFamily: 'Lato' | 'Roboto',
  format: CarouselFormat = 'portrait'
): string => {
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
    return `
      <g id="signatureCard-${data.position}" transform="translate(${pos.x}, ${pos.y})" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <clipPath id="clippath-${data.position}">
            <circle style="fill: #fff;" cx="390" cy="46" r="40"/>
          </clipPath>
        </defs>
        <circle style="fill: #fff;" cx="390" cy="46" r="44"/>
        <circle style="fill: #fff;" cx="390" cy="46" r="40"/>
        <g style="clip-path: url(#clippath-${data.position});">
          <image x="345" y="2" width="90" href="${data.imageUrl}"/>
        </g>
        <text style="fill: var(--text-highlight); font-family: ${fontFamily}, sans-serif; font-size: 28px; font-weight: 500; text-anchor: end;" transform="translate(335 44)">
          ${data.name}
        </text>
        <text style="fill: var(--text-default); font-family: ${fontFamily}, sans-serif; font-size: 24px; text-anchor: end;" transform="translate(335 74)">
          ${data.title}
        </text>
      </g>
    `;
  }

  // Left-aligned signature cards (bottom-left and top-left)
  return `
    <g id="signatureCard-${data.position}" transform="translate(${pos.x}, ${pos.y})" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <clipPath id="clippath-${data.position}">
          <circle style="fill: #fff;" cx="46" cy="46" r="40"/>
        </clipPath>
      </defs>
      <circle style="fill: #fff;" cx="46" cy="46" r="44"/>
      <circle style="fill: #fff;" cx="46" cy="46" r="40"/>
      <g style="clip-path: url(#clippath-${data.position});">
        <image x="-1" y="-1" width="90" href="${data.imageUrl}"/>
      </g>
      <text style="fill: var(--text-highlight); font-family: ${fontFamily}, sans-serif; font-size: 28px; font-weight: 500;" transform="translate(106 44)">
        ${data.name}
      </text>
      <text style="fill: var(--text-default); font-family: ${fontFamily}, sans-serif; font-size: 24px;" transform="translate(106 74)">
        ${data.title}
      </text>
    </g>
  `;
};
