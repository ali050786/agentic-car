// Template 1: "The Truth" - Exact Implementation from PDF Docs

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;500;700&family=Oswald:wght@700&display=swap');
      {{THEME_CSS}}
    </style>
    <radialGradient id="t1-grad-1" cx="244.5" cy="1229.56" fx="-12.4" fy="1239.02" r="475.25" gradientTransform="translate(0 114.96) scale(.81 .92)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000" stop-opacity=".1"/>
      <stop offset=".99" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="t1-grad-2" cx="733.49" cy="1229.56" fx="476.59" fy="1239.02" r="475.25" gradientTransform="translate(0 114.96) scale(.81 .92)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".1"/>
      <stop offset=".99" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
`;

// Variant 1: Hero (Slide-1 from PDF)
export const T1_HERO_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="788.35" y1="0" x2="788.35" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="0" width="780" height="1104">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 96px; color: var(--text-default); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
        <span style="color: var(--text-highlight);">{{HEADLINE_HIGHLIGHT}}</span>
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; font-size: 32px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)"/>
  
  <!-- Swipe Component -->
  <rect x="788.35" y="1104.56" width="292" height="125" fill="var(--text-highlight)"/>
  <text x="864.8" y="1179.43" style="font-family: 'Lato', sans-serif; font-weight:700; font-size:32px; fill:var(--background);" transform="scale(1.01,1)">SWIPE</text>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,1158.95 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,1168.13 h46.54"/>
  </g>
</svg>
`;

// Variant 2: Body (Slide-2 from PDF)
export const T1_BODY_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="929.69" y1="0" x2="929.69" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="0" width="780" height="1104">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 60px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 80px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        <span style="opacity: 0.6;">{{HEADLINE}}</span><br/>
        <span>{{HEADLINE_HIGHLIGHT}}</span>
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 500; font-size: 32px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)"/>
  
  <!-- Left Block -->
  <rect x="1.35" y="1104.56" width="150" height="125" fill="var(--text-default)"/>
  
  <!-- Swipe Component -->
  <rect x="915.62" y="1104.56" width="164.73" height="125" fill="var(--text-highlight)"/>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,1158.95 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,1168.13 h46.54"/>
  </g>
</svg>
`;

// Variant 3: List (Slide-3 from PDF)
export const T1_LIST_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="929.69" y1="0" x2="929.69" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="0" width="780" height="1104">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 80px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        <span style="opacity: 0.6;">{{HEADLINE}}</span><br/>
        <span>{{HEADLINE_HIGHLIGHT}}</span>
      </div>
      
      <!-- List Items Injection -->
      <div style="display: flex; flex-direction: column; gap: 30px; width: 100%;">
        {{LIST_ITEMS}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)"/>
  <rect x="1.35" y="1104.56" width="150" height="125" fill="var(--text-default)"/>
  
  <!-- Swipe Component -->
  <rect x="915.62" y="1104.56" width="164.73" height="125" fill="var(--text-highlight)"/>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,1158.95 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,1168.13 h46.54"/>
  </g>
</svg>
`;

// Variant 4: Closing (Slide-6/Variant-4-Closing-Flex-Final from PDF)
export const T1_CTA_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="788.35" y1="0" x2="788.35" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="0" width="600" height="900">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 96px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        <span style="opacity: 0.6;">{{HEADLINE}}</span><br/>
        <span>{{HEADLINE_HIGHLIGHT}}</span>
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; font-size: 32px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Follow Us Component -->
  <g transform="translate(150, 930)">
    <rect width="292" height="125" fill="var(--text-highlight)"/>
    <text x="146" y="75" style="font-family: 'Lato', sans-serif; font-weight:700; font-size:32px; fill:var(--background); text-anchor: middle;" transform="scale(1.01,1)">FOLLOW US</text>
  </g>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)"/>
</svg>
`;