// Template 1: "The Truth" - Updated Clean Design (Square 1080x1080)

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;500;700&family=Oswald:wght@700&display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
  </defs>
`;

// Variant 1: Hero (Square)
export const T1_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="788.35" y1="0" x2="788.35" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="180" width="800" height="660">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 40px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 72px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.15;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; font-size: 24px; color: var(--text-default); line-height: 1.35;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="845" width="1080" height="235" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Swipe Component -->
  <rect x="788.35" y="845" width="291.65" height="115" fill="var(--background-2)"/>
  <text x="864.8" y="912" style="font-family: 'Lato', sans-serif; font-weight:700; font-size:32px; fill:var(--background);" transform="scale(1.01,1)">SWIPE</text>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,893 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,902.18 h46.54"/>
  </g>

  <!-- Signature Card (Rendered Last for Proper Z-Index) -->
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body (Square)
export const T1_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="929.69" y1="0" x2="929.69" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="180" width="800" height="660">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 50px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 72px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.15;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 500; font-size: 24px; color: var(--text-default); line-height: 1.35;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="845" width="1080" height="235" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Swipe Component (Arrow Only) -->
  <rect x="915.27" y="845" width="164.73" height="115" fill="var(--background-2)"/>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,893 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,902.18 h46.54"/>
  </g>

  <!-- Signature Card (Rendered Last for Proper Z-Index) -->
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List (Square)
export const T1_LIST_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="929.69" y1="0" x2="929.69" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="180" width="800" height="660">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 40px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 72px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.15;">
        {{HEADLINE}}
      </div>
      
      <!-- List Items -->
      <div style="display: flex; flex-direction: column; gap: 25px; width: 100%;">
        {{LIST_ITEMS}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="845" width="1080" height="235" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Swipe Component (Arrow Only) -->
  <rect x="915.27" y="845" width="164.73" height="115" fill="var(--background-2)"/>
  <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M1018.01,893 l19.31,9.18 l-19.31,9.18"/>
    <path d="M980.78,902.18 h46.54"/>
  </g>

  <!-- Signature Card (Rendered Last for Proper Z-Index) -->
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing (Square)
export const T1_CTA_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>
  
  <!-- Decorative Lines -->
  <line x1="150" x2="150" y1="0" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  <line x1="788.35" y1="0" x2="788.35" y2="1080" stroke="var(--background-2)" stroke-miterlimit="10"/>
  
  <foreignObject x="150" y="180" width="800" height="620">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 40px;">
      
      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; color: var(--text-highlight); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 72px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.15;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; font-size: 24px; color: var(--text-default); line-height: 1.35;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section -->
  <rect x="0" y="845" width="1080" height="235" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Follow Us Button (CTA) -->
  <g transform="translate(788.35, 850)">
    <rect width="291.65" height="115" fill="var(--background-2)"/>
    <text x="145.82" y="70" style="font-family: 'Lato', sans-serif; font-weight:700; font-size:32px; fill:var(--background); text-anchor: middle;" transform="scale(1.01,1)">FOLLOW US</text>
  </g>

  <!-- Signature Card (Rendered Last for Proper Z-Index) -->
  {{SIGNATURE_CARD}}
</svg>
`;
