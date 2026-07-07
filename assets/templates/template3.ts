// Template 3: "The Sketch" - Portrait (1080x1380)
// "Layered Poster" system: an organic color blob + a full-blend doodle image
// (multiply blend knocks out the doodle's white background) with a floating
// pill badge overlapping the image edge for real depth, and a bold poster
// headline. All variants keep the same content foreignObject anchor
// (x="80" y="160") so branding-position shifting in svgInjector.ts keeps working.

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Fredericka+the+Great&family=Lato:wght@300;500;700&family=Oswald:wght@700&display=swap');
      {{THEME_CSS}}
    </style>
    <symbol id="t3Blob" viewBox="0 0 600 600">
      <path d="M300,10 C440,10 580,120 585,280 C590,440 480,580 320,590 C160,600 20,500 10,340 C0,180 90,50 240,20 C260,15 280,10 300,10 Z"/>
    </symbol>
  </defs>
`;

// Variant 1: Hero
export const T3_HERO_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>

  <!-- Depth blob, top-right, bleeding off-canvas -->
  <use href="#t3Blob" width="600" height="600" transform="translate(680,-140) scale(1.25)" fill="var(--background-2)" opacity="0.85"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Doodle image, blended onto the blob/background -->
      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; top: -10px; right: -50px; width: 380px; height: 560px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(-5deg); filter: drop-shadow(0 22px 34px rgba(0,0,0,0.18));" />

      <!-- Floating preheader pill, overlapping the image's bottom-left edge -->
      <div style="position: absolute; top: 470px; left: 190px; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 28px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 22px;">&#10022;</span>
        {{PREHEADER}}
      </div>

      <!-- Headline + body, safely below the image (never overlaps it) -->
      <div style="position: absolute; top: 575px; left: 0; width: 680px; display: flex; flex-direction: column; gap: 24px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 64px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.05;">
          {{HEADLINE}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 300; width: 620px; font-size: 30px; color: var(--text-default); line-height: 1.35;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Diagonal ground slice -->
  <polygon points="0,1380 1080,1380 1080,1190 0,1300" fill="var(--background-2)" opacity="0.14"/>

  <!-- Circle Swipe Component -->
  <g transform="translate(974, 1290)">
     <circle r="52" fill="var(--text-highlight)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body (mirrored — image left, text right-aligned)
export const T3_BODY_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>

  <!-- Depth blob, bottom-left, bleeding off-canvas -->
  <use href="#t3Blob" width="600" height="600" transform="translate(-160,820) scale(1.2)" fill="var(--background-2)" opacity="0.85"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Doodle image, blended onto the blob/background -->
      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; top: -10px; left: -50px; width: 380px; height: 560px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(5deg); filter: drop-shadow(0 22px 34px rgba(0,0,0,0.18));" />

      <!-- Floating preheader pill, overlapping the image's right edge -->
      <div style="position: absolute; top: 470px; left: 200px; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 28px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        {{PREHEADER}}
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 22px;">&#10022;</span>
      </div>

      <!-- Headline + body, right-aligned, safely below the image -->
      <div style="position: absolute; top: 575px; right: 0; width: 680px; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 24px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 64px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.05;">
          {{HEADLINE}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 300; width: 620px; font-size: 30px; color: var(--text-default); line-height: 1.35;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Diagonal ground slice -->
  <polygon points="0,1380 1080,1380 1080,1190 0,1300" fill="var(--background-2)" opacity="0.14"/>

  <!-- Circle Swipe Component -->
  <g transform="translate(974, 1290)">
     <circle r="52" fill="var(--text-highlight)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List
export const T3_LIST_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>

  <!-- Depth blob, top-left, bleeding off-canvas -->
  <use href="#t3Blob" width="600" height="600" transform="translate(-180,-160) scale(1.1)" fill="var(--background-2)" opacity="0.8"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Doodle image, smaller corner accent, blended onto background -->
      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; top: -10px; right: -40px; width: 300px; height: 300px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(6deg); filter: drop-shadow(0 18px 26px rgba(0,0,0,0.16));" />

      <!-- Floating preheader pill -->
      <div style="position: absolute; top: 0; left: 0; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 28px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 22px;">&#10022;</span>
        {{PREHEADER}}
      </div>

      <!-- Headline + list items (width capped so wrapped lines stay clear of the image) -->
      <div style="position: absolute; top: 100px; left: 0; width: 560px; display: flex; flex-direction: column; gap: 24px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 56px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.1;">
          {{HEADLINE}}
        </div>
        <div style="display: flex; flex-direction: column; gap: 26px; width: 560px;">
          {{LIST_ITEMS}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Diagonal ground slice -->
  <polygon points="0,1380 1080,1380 1080,1190 0,1300" fill="var(--background-2)" opacity="0.14"/>

  <!-- Circle Swipe Component -->
  <g transform="translate(974, 1290)">
     <circle r="52" fill="var(--text-highlight)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing
export const T3_CTA_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>

  <!-- Depth blob, bottom-right, bleeding off-canvas -->
  <use href="#t3Blob" width="600" height="600" transform="translate(560,820) scale(1.2)" fill="var(--background-2)" opacity="0.85"/>

  <foreignObject x="80" y="160" width="920" height="900">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Doodle image, bottom-right, blended onto the blob -->
      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; bottom: -40px; right: -50px; width: 380px; height: 480px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(-6deg); filter: drop-shadow(0 22px 34px rgba(0,0,0,0.18));" />

      <!-- Floating preheader pill -->
      <div style="position: absolute; top: 0; left: 0; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 28px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 22px;">&#10022;</span>
        {{PREHEADER}}
      </div>

      <!-- Headline + body -->
      <div style="position: absolute; top: 100px; left: 0; width: 620px; display: flex; flex-direction: column; gap: 24px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 64px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.05;">
          {{HEADLINE}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 500; width: 600px; font-size: 30px; color: var(--text-default); line-height: 1.4;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Diagonal ground slice -->
  <polygon points="0,1380 1080,1380 1080,1190 0,1300" fill="var(--background-2)" opacity="0.14"/>

  <!-- Follow Us button, overlapping the diagonal slice for depth -->
  <foreignObject x="600" y="1075" width="400" height="140">
    <div xmlns="http://www.w3.org/1999/xhtml" style="transform: rotate(-3deg); display: inline-flex; align-items: center; justify-content: center; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 30px; text-transform: uppercase; letter-spacing: 0.05em; padding: 24px 44px; border-radius: 14px; box-shadow: 0 16px 30px rgba(0,0,0,0.22); white-space: nowrap;">
      FOLLOW US
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
