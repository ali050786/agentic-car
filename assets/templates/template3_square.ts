// Template 3: "The Sketch" - Square (1080x1080)
// Mirrors the "Layered Poster" system in template3.ts, retuned for the square
// aspect ratio. Content foreignObject anchors (x="80" y="100" for hero/cta,
// x="80" y="200" for body/list) are kept identical to the previous design so
// branding-position shifting in svgInjector.ts keeps working unchanged.

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
export const T3_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>

  <!-- Depth blob, top-right, bleeding off-canvas -->
  <use href="#t3Blob" width="600" height="600" transform="translate(680,-150) scale(1.05)" fill="var(--background-2)" opacity="0.85"/>

  <foreignObject x="80" y="100" width="920" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; top: -10px; right: -50px; width: 320px; height: 460px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(-5deg); filter: drop-shadow(0 20px 30px rgba(0,0,0,0.18));" />

      <div style="position: absolute; top: 370px; left: 170px; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 20px;">&#10022;</span>
        {{PREHEADER}}
      </div>

      <div style="position: absolute; top: 470px; left: 0; width: 680px; display: flex; flex-direction: column; gap: 20px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 52px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.08;">
          {{HEADLINE}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 300; width: 620px; font-size: 26px; color: var(--text-default); line-height: 1.3;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <polygon points="0,1080 1080,1080 1080,900 0,980" fill="var(--background-2)" opacity="0.14"/>

  <g transform="translate(974, 980)">
     <circle r="50" fill="var(--text-highlight)"/>
     <g fill="none" stroke="var(--background)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
        <path d="M-20 0 H 20"/>
        <path d="M 8 -12 L 20 0 L 8 12"/>
     </g>
  </g>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body (mirrored — image left, text right-aligned)
export const T3_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>

  <use href="#t3Blob" width="600" height="600" transform="translate(-160,560) scale(1.05)" fill="var(--background-2)" opacity="0.85"/>

  <foreignObject x="80" y="200" width="920" height="600">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; top: -10px; left: -50px; width: 320px; height: 460px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(5deg); filter: drop-shadow(0 20px 30px rgba(0,0,0,0.18));" />

      <div style="position: absolute; top: 370px; left: 170px; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        {{PREHEADER}}
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 20px;">&#10022;</span>
      </div>

      <div style="position: absolute; top: 470px; right: 0; width: 680px; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 20px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 52px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.08;">
          {{HEADLINE}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 300; width: 620px; font-size: 26px; color: var(--text-default); line-height: 1.3;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <polygon points="0,1080 1080,1080 1080,900 0,980" fill="var(--background-2)" opacity="0.14"/>

  <g transform="translate(974, 980)">
     <circle r="50" fill="var(--text-highlight)"/>
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

  <use href="#t3Blob" width="600" height="600" transform="translate(-180,-160) scale(0.95)" fill="var(--background-2)" opacity="0.8"/>

  <foreignObject x="80" y="200" width="920" height="600">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; top: -10px; right: -40px; width: 260px; height: 260px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(6deg); filter: drop-shadow(0 16px 24px rgba(0,0,0,0.16));" />

      <div style="position: absolute; top: 0; left: 0; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 20px;">&#10022;</span>
        {{PREHEADER}}
      </div>

      <div style="position: absolute; top: 90px; left: 0; width: 540px; display: flex; flex-direction: column; gap: 20px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 46px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.12;">
          {{HEADLINE}}
        </div>
        <div style="display: flex; flex-direction: column; gap: 20px; width: 540px;">
          {{LIST_ITEMS}}
        </div>
      </div>

    </div>
  </foreignObject>

  <polygon points="0,1080 1080,1080 1080,900 0,980" fill="var(--background-2)" opacity="0.14"/>

  <g transform="translate(974, 980)">
     <circle r="50" fill="var(--text-highlight)"/>
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

  <use href="#t3Blob" width="600" height="600" transform="translate(560,560) scale(1.05)" fill="var(--background-2)" opacity="0.85"/>

  <foreignObject x="80" y="100" width="920" height="650">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <img src="{{DOODLE_IMAGE_URL}}" style="position: absolute; bottom: -30px; right: -50px; width: 320px; height: 400px; object-fit: contain; mix-blend-mode: multiply; transform: rotate(-6deg); filter: drop-shadow(0 20px 30px rgba(0,0,0,0.18));" />

      <div style="position: absolute; top: 0; left: 0; display: inline-flex; align-items: center; gap: 8px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border-radius: 999px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); white-space: nowrap;">
        <span style="font-family: 'Fredericka the Great', cursive; font-size: 20px;">&#10022;</span>
        {{PREHEADER}}
      </div>

      <div style="position: absolute; top: 90px; left: 0; width: 600px; display: flex; flex-direction: column; gap: 20px;">
        <div style="font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 52px; color: var(--text-highlight); text-transform: uppercase; line-height: 1.08;">
          {{HEADLINE}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 500; width: 580px; font-size: 26px; color: var(--text-default); line-height: 1.4;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <polygon points="0,1080 1080,1080 1080,900 0,980" fill="var(--background-2)" opacity="0.14"/>

  <!-- Follow Us button, overlapping the diagonal slice for depth -->
  <foreignObject x="560" y="820" width="380" height="140">
    <div xmlns="http://www.w3.org/1999/xhtml" style="transform: rotate(-3deg); display: inline-flex; align-items: center; justify-content: center; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; text-transform: uppercase; letter-spacing: 0.05em; padding: 20px 38px; border-radius: 14px; box-shadow: 0 16px 30px rgba(0,0,0,0.22); white-space: nowrap;">
      FOLLOW US
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
