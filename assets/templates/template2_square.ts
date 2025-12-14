/**
 * Template 2 - Square Format (1080x1080)
 * 
 * "The Clarity" template - Updated from template-2.md specification
 * Uses {{SIGNATURE_CARD}} placeholder for dynamic injection
 */

const COMMON_DEFS_SQUARE = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
    <radialGradient id="radial-gradient-hero" cx="845.36" cy="241.41" fx="1157.19" fy="-34.3" r="416.24" gradientTransform="translate(-517.29 -50.02) scale(1.48 1.68)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="var(--bg-grad-start)"/>
      <stop offset=".59" stop-color="var(--bg-grad-end)"/>
    </radialGradient>
  </defs>
`;


const BACKGROUND_ELEMENTS_SQUARE = `
  <rect id="Background" width="1080" height="1080" fill="var(--background)"/>
  
  <g transform="translate(2, -5)">
    <path id="Gradiant_Design_element" fill="url(#radial-gradient-hero)" d="M386.97,5.06c0,2.31,0,4.61.02,6.92,3.77,382.43,312.55,690.44,693,695.27V5.06H386.97Z"/>
  </g>
  
  <rect width="1080" height="1080" fill="url(#bgPattern)"/>
  
  <path id="Bottom_archDesign" fill="var(--background-2)" opacity="0.2" d="M839.49,1032.66c23.07-116.89,125.7-197.83,240.51-197.7v-112.29c-197.43,0-357.47,160.04-357.47,357.47h112.29c.02-15.66,1.52-31.54,4.67-47.48Z"/>
`;

// ============================================================================
// HERO VARIANT - Square Format
// ============================================================================

export const T2_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS_SQUARE}
  ${BACKGROUND_ELEMENTS_SQUARE}
  
  <foreignObject x="150" y="220" width="800" height="600">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 40px;">
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 86px; color: var(--text-default); line-height: 1.1;">
          {{HEADLINE}}
        </div>
      </div>
    </body>
  </foreignObject>

  <g id="swipeComponent" transform="translate(520, 850)">
    <rect id="swipeRectangle" x="150" y="0" width="292" height="125" fill="var(--button-color)"/>
    <g id="innerComponent">
      <text id="swipeText" x="227.13" y="74.87" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background);">
        SWIPE
      </text>
      <g id="arrow" transform="translate(150, 0)">
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M230.34,54.39 l9.31,9.18 l-9.31,9.18"/>
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M193.11,63.57 h46.54"/>
      </g>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// ============================================================================
// BODY VARIANT - Square Format
// ============================================================================

export const T2_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS_SQUARE}
  ${BACKGROUND_ELEMENTS_SQUARE}
  
  <foreignObject x="150" y="200" width="800" height="600">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 45px;">
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 66px; color: var(--text-default); line-height: 1.1; text-transform: uppercase;">
          {{HEADLINE}}
        </div>
        <div id="content" style="font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 28px; color: var(--text-default); line-height: 1.4;">
          {{BODY}}
        </div>
      </div>
    </body>
  </foreignObject>

  <g id="swipeComponent" transform="translate(520, 850)">
    <rect id="swipeRectangle" x="150" y="0" width="292" height="125" fill="var(--button-color)"/>
    <g id="innerComponent">
      <text id="swipeText" x="227.13" y="74.87" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background);">
        SWIPE
      </text>
      <g id="arrow" transform="translate(150, 0)">
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M230.34,54.39 l9.31,9.18 l-9.31,9.18"/>
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M193.11,63.57 h46.54"/>
      </g>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// ============================================================================
// LIST VARIANT - Square Format
// ============================================================================

export const T2_LIST_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS_SQUARE}
  ${BACKGROUND_ELEMENTS_SQUARE}
  
  <foreignObject x="150" y="200" width="800" height="650">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 40px;">
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 68px; color: var(--text-default); line-height: 1.1; text-transform: uppercase;">
          {{HEADLINE}}
        </div>
        <div id="content" style="display: flex; flex-direction: column; gap: 25px; width: 100%;">
          {{LIST_ITEMS}}
        </div>
      </div>
    </body>
  </foreignObject>

  <g id="swipeComponent" transform="translate(520, 850)">
    <rect id="swipeRectangle" x="150" y="0" width="292" height="125" fill="var(--button-color)"/>
    <g id="innerComponent">
      <text id="swipeText" x="227.13" y="74.87" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background);">
        SWIPE
      </text>
      <g id="arrow" transform="translate(150, 0)">
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M230.34,54.39 l9.31,9.18 l-9.31,9.18"/>
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M193.11,63.57 h46.54"/>
      </g>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// ============================================================================
// CTA VARIANT - Square Format
// ============================================================================

export const T2_CTA_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS_SQUARE}
  ${BACKGROUND_ELEMENTS_SQUARE}
  
  <foreignObject x="150" y="200" width="800" height="650">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 45px;">
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 86px; color: var(--text-default); line-height: 1.1; text-transform: uppercase;">
          {{HEADLINE}}
        </div>
        <div id="content" style="font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 30px; color: var(--text-default); line-height: 1.4;">
          {{BODY}}
        </div>
      </div>
    </body>
  </foreignObject>

  <g id="followComponent" transform="translate(520, 860)">
    <rect id="followRectangle" x="150" y="0" width="292" height="125" fill="var(--button-color)"/>
    <g id="innerComponent">
      <text id="followText" x="296" y="74.87" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background); text-anchor: middle;">
        FOLLOW US
      </text>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;
