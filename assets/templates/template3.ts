// Template 3: "The Sketch" - Portrait (1080x1380)
// 2026 editorial system: warm paper background, Fraunces serif sentence-case
// headline with a marker-highlighted accent phrase ({{HEADLINE_HTML}}), and a
// mono black-ink spot illustration laid flat on the page (multiply blend
// knocks out its white background — no rotation, no drop shadow, no frame).
// All color comes from themed SVG accents (wash blobs, sparks, button) so one
// cached illustration works with every theme. All variants keep the same
// content foreignObject anchor (x="80" y="160") so branding-position shifting
// in svgInjector.ts keeps working.

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&amp;family=Lato:wght@300;400;700&amp;display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
    <!-- Soft organic wash, sits behind the illustration's ink -->
    <symbol id="t3Wash" viewBox="0 0 600 600">
      <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z"/>
    </symbol>
    <!-- Loose brush arc, a hand-drawn swash accent -->
    <symbol id="t3Swash" viewBox="0 0 400 200">
      <path d="M20,150 C90,40 280,10 380,80 C300,40 140,70 60,170 C45,175 25,165 20,150 Z"/>
    </symbol>
    <!-- Hand-drawn four-point spark -->
    <symbol id="t3Spark" viewBox="0 0 60 60">
      <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z"/>
    </symbol>
  </defs>
`;

// Minimal swipe affordance: thin outlined circle + arrow, bottom-right
const SWIPE_HINT = `
  <g transform="translate(980, 1296)">
    <circle r="44" fill="none" stroke="var(--text-highlight)" stroke-width="3"/>
    <g fill="none" stroke="var(--text-highlight)" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">
      <path d="M-16 0 H 16"/>
      <path d="M 6 -10 L 16 0 L 6 10"/>
    </g>
  </g>
`;

// Variant 1: Hero — text column top-left, large illustration bottom-right on a wash
export const T3_HERO_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <!-- Wash behind the illustration zone (bottom-right), bleeding off-canvas -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(590,760) scale(1.05)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(560,700)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline + body flow together so the gap stays tight regardless of headline length -->
      <div style="position: absolute; top: 76px; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-start; gap: 32px;">
        <div style="font-family: 'Fraunces', serif; font-weight: 500; font-size: 78px; color: var(--text-default); line-height: 1.14;">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 520px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: 30px; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, flat on the page, ink blended onto wash + paper -->
  <image href="{{DOODLE_IMAGE_URL}}" x="540" y="660" width="520" height="580" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  ${SWIPE_HINT}

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body — mirrored: illustration left on a wash, text right
export const T3_BODY_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <!-- Wash behind the illustration zone (bottom-left), bleeding off-canvas -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(-130,780) scale(1.05)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(470,740)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline + body flow together, right-aligned column -->
      <div style="position: absolute; top: 76px; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-end; gap: 32px;">
        <div style="width: 880px; font-family: 'Fraunces', serif; font-weight: 500; font-size: 68px; color: var(--text-default); line-height: 1.16;">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 500px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: 30px; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, bottom-left, flat -->
  <image href="{{DOODLE_IMAGE_URL}}" x="40" y="660" width="480" height="560" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  ${SWIPE_HINT}

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List — headline + checklist left, smaller illustration top-right
export const T3_LIST_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <!-- Small wash behind the corner illustration -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(700,190) scale(0.62)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(660,560)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline, width capped so it stays clear of the illustration -->
      <div style="position: absolute; top: 76px; left: 0; width: 540px; font-family: 'Fraunces', serif; font-weight: 500; font-size: 60px; color: var(--text-default); line-height: 1.16;">
        {{HEADLINE_HTML}}
      </div>

      <!-- Checklist -->
      <div style="position: absolute; top: 440px; left: 0; width: 640px; display: flex; flex-direction: column; gap: 34px;">
        {{LIST_ITEMS}}
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, top-right corner, flat -->
  <image href="{{DOODLE_IMAGE_URL}}" x="690" y="190" width="340" height="360" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  ${SWIPE_HINT}

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing — headline + body + flat accent button, illustration bottom-right
export const T3_CTA_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <!-- Wash behind the illustration zone (bottom-right), bleeding off-canvas -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(620,800) scale(0.95)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(575,750)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="160" width="920" height="1000">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 24px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline + body + button flow together so gaps stay tight -->
      <div style="position: absolute; top: 76px; left: 0; width: 860px; display: flex; flex-direction: column; align-items: flex-start; gap: 32px;">
        <div style="font-family: 'Fraunces', serif; font-weight: 500; font-size: 70px; color: var(--text-default); line-height: 1.14;">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 520px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: 30px; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
          {{BODY}}
        </div>
        <div style="margin-top: 12px; display: inline-flex; align-items: center; gap: 14px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 28px; letter-spacing: 0.08em; text-transform: uppercase; padding: 24px 48px; border-radius: 12px;">
          FOLLOW US
          <span style="font-size: 30px;">&#8594;</span>
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, bottom-right, flat -->
  <image href="{{DOODLE_IMAGE_URL}}" x="580" y="680" width="460" height="520" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  {{SIGNATURE_CARD}}
</svg>
`;
