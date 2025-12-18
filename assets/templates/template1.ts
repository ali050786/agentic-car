// Template 1: "The Truth" - Updated Clean Design (Portrait 1080x1380)

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;500;700&family=Oswald:wght@700&display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
  </defs>
`;

// Variant 1: Hero (Slide-1)
export const T1_HERO_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="788.35" y1="0" x2="788.35" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="220" width="780" height="800">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- Icon Circle (Hero - 150px) -->
      <div style="width: 150px; height: 150px; border-radius: 50%; background: var(--background-2); display: flex; align-items: center; justify-content: center;">
        {{ICON_SVG}}
      </div>
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 80px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; font-size: 32px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Swipe Component -->
  <rect x="788.35" y="1104.56" width="292" height="125" fill="var(--background-2)"/>
  <text x="864.8" y="1179.43" style="font-family: 'Lato', sans-serif; font-weight:700; font-size:32px; fill:var(--background);" transform="scale(1.01,1)">SWIPE</text>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,1158.95 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,1168.13 h46.54"/>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body (Slide-2)
export const T1_BODY_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="929.69" y1="0" x2="929.69" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="220" width="780" height="800">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 60px;">
      
      <!-- Icon Circle (Body - 80px) -->
      <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--background-2); display: flex; align-items: center; justify-content: center;">
        {{ICON_SVG}}
      </div>
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 80px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 500; font-size: 32px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Swipe Component (Arrow Only) -->
  <rect x="915.62" y="1104.56" width="164.73" height="125" fill="var(--background-2)"/>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,1158.95 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,1168.13 h46.54"/>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List (Slide-3)
export const T1_LIST_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="929.69" y1="0" x2="929.69" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="220" width="780" height="880">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- Icon Circle (List - 80px) -->
      <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--background-2); display: flex; align-items: center; justify-content: center;">
        {{ICON_SVG}}
      </div>
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 80px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- List Items -->
      <div style="display: flex; flex-direction: column; gap: 30px; width: 100%;">
        {{LIST_ITEMS}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Swipe Component (Arrow Only) -->
  <rect x="915.62" y="1104.56" width="164.73" height="125" fill="var(--background-2)"/>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,1158.95 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,1168.13 h46.54"/>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing (Slide-6)
export const T1_CTA_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="788.35" y1="0" x2="788.35" y2="1380" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="220" width="780" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- Icon Circle (Closing - 80px) -->
      <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--background-2); display: flex; align-items: center; justify-content: center;">
        {{ICON_SVG}}
      </div>
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 32px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 96px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; font-size: 32px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="1104.56" width="1080" height="275" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Follow Us Button (CTA) -->
  <g transform="translate(700, 1110)">
    <rect width="292" height="125" fill="var(--background-2)"/>
    <text x="146" y="75" style="font-family: 'Lato', sans-serif; font-weight:700; font-size:32px; fill:var(--background); text-anchor: middle;" transform="scale(1.01,1)">FOLLOW US</text>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;