// Template 3: "The Sketch" - Square (1080x1080)

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Fredericka+the+Great&family=Lato:wght@300;500;700&family=Oswald:wght@700&display=swap');
      {{THEME_CSS}}
    </style>
  </defs>
`;

// Variant 1: Hero
export const T3_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  
  <!-- Rocket doodle in the bottom right -->
  <image href="{{DOODLE_IMAGE_URL}}"
         x="580" y="260" width="550" height="900"
         opacity="0.6" />

  <foreignObject x="80" y="100" width="780" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 35px;">
      

      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; color: var(--text-default); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Fredericka the Great', cursive; font-weight: 200; font-size: 66px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; width: 450px; font-size: 28px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section Decor -->
  <rect x="0" y="860" width="1080" height="220" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Circle Swipe Component -->
  <g transform="translate(974, 980)">
     <circle r="50" fill="var(--background-2)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body
export const T3_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  
  <!-- Rocket doodle -->
  <image href="{{DOODLE_IMAGE_URL}}"
         x="580" y="310" width="550" height="850"
         opacity="0.6" />

  <foreignObject x="80" y="200" width="700" height="650">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 40px;">
      

      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; color: var(--text-default); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Fredericka the Great', cursive; font-weight: 200; font-size: 66px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 300; width: 380px; font-size: 28px; color: var(--text-default); line-height: 1.2;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section Decor -->
  <rect x="0" y="860" width="1080" height="220" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Circle Swipe Component -->
  <g transform="translate(974, 980)">
     <circle r="50" fill="var(--background-2)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List
export const T3_LIST_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  
  <image href="{{DOODLE_IMAGE_URL}}"
         x="580" y="260" width="550" height="900"
         opacity="0.6" />

  <foreignObject x="80" y="200" width="700" height="650">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 35px;">
      

      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; color: var(--text-default); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Fredericka the Great', cursive; font-weight: 200; font-size: 66px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- List Items -->
      <div style="display: flex; flex-direction: column; gap: 25px; width: 400px;">
        {{LIST_ITEMS}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Bottom Section Decor -->
  <rect x="0" y="860" width="1080" height="220" fill="var(--background-2)" opacity="0.2"/>
  
  <!-- Circle Swipe Component -->
  <g transform="translate(974, 980)">
     <circle r="50" fill="var(--background-2)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>
  
  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing
export const T3_CTA_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  
  <image href="{{DOODLE_IMAGE_URL}}"
         x="600" y="300" width="500" height="800"
         opacity="0.6" />

  <foreignObject x="80" y="100" width="700" height="600">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; gap: 30px;">
      

      <!-- PreHeader -->
      <div style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; color: var(--text-default); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1;">
        {{PREHEADER}}
      </div>
      
      <!-- Headline -->
      <div style="font-family: 'Fredericka the Great', cursive; font-weight: 200; font-size: 66px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.2;">
        {{HEADLINE}}
      </div>
      
      <!-- Body Copy -->
      <div style="font-family: 'Lato', sans-serif; width:400px; font-weight: 500; font-size: 28px; color: var(--text-default); line-height: 1.4;">
        {{BODY}}
      </div>
      
    </div>
  </foreignObject>

  <!-- Follow Button -->
  <g id="followComponent" transform="translate(80, 700)">
    <rect id="followRectangle" width="260" height="110" fill="var(--text-highlight)"/>
    <text id="followText" x="130" y="68" style="font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; letter-spacing: 0.05em; fill: var(--background); text-anchor: middle;">
      FOLLOW US
    </text>
  </g>

  <!-- Bottom Section Decor -->
  <rect x="0" y="830" width="1080" height="250" fill="var(--background-2)" opacity="0.2"/>
  
  {{SIGNATURE_CARD}}
</svg>
`;
