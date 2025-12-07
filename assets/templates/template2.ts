// Template 2: "The Clarity" - Updated Design from template-2.md

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      {{THEME_CSS}}
    </style>
    <!-- Radial Gradient using System Variables -->
    <radialGradient id="radial-gradient-hero" cx="845.36" cy="241.41" fx="1157.19" fy="-34.3" r="416.24" gradientTransform="translate(-517.29 -50.02) scale(1.48 1.68)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="var(--bg-grad-start)"/>
      <stop offset=".59" stop-color="var(--bg-grad-end)"/>
    </radialGradient>
  </defs>
`;

// Shared Background Elements
const BACKGROUND_ELEMENTS = `
  <!-- 1. Background -->
  <rect id="Background" width="1080" height="1374.14" fill="var(--background)"/>
  
  <!-- 2. Complex Design Elements -->
  <g transform="translate(2, -5)">
    <path id="Gradiant_Design_element" fill="url(#radial-gradient-hero)" d="M386.97,5.06c0,2.31,0,4.61.02,6.92,3.77,382.43,312.55,690.44,693,695.27V5.06H386.97Z"/>
  </g>
  <path id="Bottom_archDesign" fill="var(--background-2)" d="M839.49,1326.66c23.07-116.89,125.7-197.83,240.51-197.7v-112.29c-197.43,0-357.47,160.04-357.47,357.47h112.29c.02-15.66,1.52-31.54,4.67-47.48Z"/>
`;

// Variant 1: Hero
export const T2_HERO_SVG = `
<svg viewBox="0 0 1080 1374.14" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${BACKGROUND_ELEMENTS}
  
  <!-- 3. CONTENT CONTAINER -->
  <foreignObject x="150" y="240" width="800" height="800">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
        <!-- PreHeader -->
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <!-- Headline -->
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 92px; color: var(--text-default); line-height: 1.1;">
          {{HEADLINE}}
        </div>
      </div>
    </body>
  </foreignObject>

  <!-- 4. Swipe Component -->
  <g id="swipeComponent" transform="translate(508, 150)">
    <rect id="swipeRectangle" x="150" y="903.03" width="292" height="125" fill="var(--text-highlight)"/>
    <g id="innerComponent">
      <text id="swipeText" x="227.13" y="977.9" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background);">
        SWIPE
      </text>
      <g id="arrow" transform="translate(150, 903.03)">
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M230.34,54.39 l9.31,9.18 l-9.31,9.18"/>
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M193.11,63.57 h46.54"/>
      </g>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body
export const T2_BODY_SVG = `
<svg viewBox="0 0 1080 1374.14" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${BACKGROUND_ELEMENTS}
  
  <!-- 3. CONTENT CONTAINER -->
  <foreignObject x="150" y="240" width="800" height="800">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 60px;">
        <!-- PreHeader -->
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <!-- Headline (Body Variant Size: 80px) -->
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 80px; color: var(--text-default); line-height: 1.1; text-transform: uppercase;">
          {{HEADLINE}}
        </div>
        <!-- Body Text -->
        <div id="content" style="font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 32px; color: var(--text-default); line-height: 1.4;">
          {{BODY}}
        </div>
      </div>
    </body>
  </foreignObject>

  <!-- 4. Swipe Component -->
  <g id="swipeComponent" transform="translate(508, 150)">
    <rect id="swipeRectangle" x="150" y="903.03" width="292" height="125" fill="var(--text-highlight)"/>
    <g id="innerComponent">
      <text id="swipeText" x="227.13" y="977.9" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background);">
        SWIPE
      </text>
      <g id="arrow" transform="translate(150, 903.03)">
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M230.34,54.39 l9.31,9.18 l-9.31,9.18"/>
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M193.11,63.57 h46.54"/>
      </g>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List
export const T2_LIST_SVG = `
<svg viewBox="0 0 1080 1374.14" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${BACKGROUND_ELEMENTS}
  
  <!-- 3. CONTENT CONTAINER -->
  <foreignObject x="150" y="240" width="800" height="800">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 60px;">
        <!-- PreHeader -->
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <!-- Headline (80px) -->
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 80px; color: var(--text-default); line-height: 1.1; text-transform: uppercase;">
          {{HEADLINE}}
        </div>
        <!-- List Content -->
        <div id="content" style="display: flex; flex-direction: column; gap: 30px; width: 100%;">
          {{LIST_ITEMS}}
        </div>
      </div>
    </body>
  </foreignObject>
  
  <!-- 4. Swipe Component -->
  <g id="swipeComponent" transform="translate(508, 150)">
    <rect id="swipeRectangle" x="150" y="903.03" width="292" height="125" fill="var(--text-highlight)"/>
    <g id="innerComponent">
      <text id="swipeText" x="227.13" y="977.9" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background);">
        SWIPE
      </text>
      <g id="arrow" transform="translate(150, 903.03)">
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M230.34,54.39 l9.31,9.18 l-9.31,9.18"/>
        <path style="fill: none; stroke: var(--background); stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px;" d="M193.11,63.57 h46.54"/>
      </g>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: Closing
export const T2_CTA_SVG = `
<svg viewBox="0 0 1080 1374.14" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${BACKGROUND_ELEMENTS}
  
  <!-- 3. CONTENT CONTAINER -->
  <foreignObject x="150" y="240" width="800" height="800">
    <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0; padding:0; background:transparent;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 60px;">
        <!-- PreHeader -->
        <div id="preHeader" style="font-family: 'Roboto', sans-serif; font-weight: 400; font-size: 32px; color: var(--text-highlight); line-height: 1;">
          {{PREHEADER}}
        </div>
        <!-- Headline (104px for Closing Impact) -->
        <div id="header" style="font-family: 'Roboto', sans-serif; font-weight: 900; font-size: 104px; color: var(--text-default); line-height: 1.1; text-transform: uppercase;">
          {{HEADLINE}}
        </div>
        <!-- Body Text -->
        <div id="content" style="font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 32px; color: var(--text-default); line-height: 1.4;">
          {{BODY}}
        </div>
      </div>
    </body>
  </foreignObject>

  <!-- 4. Follow Us Component -->
  <g id="followComponent" transform="translate(508, 150)">
    <rect id="followRectangle" x="150" y="903.03" width="292" height="125" fill="var(--text-highlight)"/>
    <g id="innerComponent">
      <text id="followText" x="296" y="977.9" style="font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 32px; letter-spacing: 0.05em; fill: var(--background); text-anchor: middle;">
        FOLLOW US
      </text>
    </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;