// Template 3: "The Sketch" - Square (1080x1080)
// Mirrors the 2026 editorial system in template3.ts (warm paper, Fraunces
// serif + marker-highlighted accent phrase, flat mono-ink illustration over a
// themed wash), retuned for the square aspect ratio. Content foreignObject
// anchors (x="80" y="100" for hero/cta, x="80" y="200" for body/list) are
// kept identical to the previous design so branding-position shifting in
// svgInjector.ts keeps working unchanged.

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&amp;family=Lato:wght@300;400;700&amp;display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
    <symbol id="t3Wash" viewBox="0 0 600 600">
      <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z"/>
    </symbol>
    <symbol id="t3Spark" viewBox="0 0 60 60">
      <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z"/>
    </symbol>
  </defs>
`;

const SWIPE_HINT_SQUARE = `
  <g transform="translate(990, 1000)">
    <circle r="38" fill="none" stroke="var(--text-highlight)" stroke-width="3"/>
    <g fill="none" stroke="var(--text-highlight)" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">
      <path d="M-14 0 H 14"/>
      <path d="M 5 -9 L 14 0 L 5 9"/>
    </g>
  </g>
`;

// Variant 1: Hero — text top-left, illustration bottom-right on a wash
export const T3_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <!-- Wash behind the illustration zone (bottom-right), bleeding off-canvas -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(620,560) scale(0.92)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(585,510)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="100" width="920" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader: small caps -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline + body flow together so the gap stays tight regardless of headline length -->
      <div style="position: absolute; top: 64px; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-start; gap: 26px;">
        <div style="font-family: 'Fraunces', serif; font-weight: 500; font-size: 62px; color: var(--text-default); line-height: 1.14;">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 460px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: 27px; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, flat on the page -->
  <image href="{{DOODLE_IMAGE_URL}}" x="600" y="550" width="440" height="460" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  ${SWIPE_HINT_SQUARE}

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body — mirrored: illustration bottom-left, text right
export const T3_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <!-- Wash behind the illustration zone (bottom-left), bleeding off-canvas -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(-120,580) scale(0.92)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(430,545)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="200" width="920" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline + body flow together, right-aligned column -->
      <div style="position: absolute; top: 64px; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-end; gap: 26px;">
        <div style="width: 880px; font-family: 'Fraunces', serif; font-weight: 500; font-size: 54px; color: var(--text-default); line-height: 1.16;">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 440px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: 27px; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
          {{BODY}}
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, bottom-left, flat -->
  <image href="{{DOODLE_IMAGE_URL}}" x="40" y="560" width="410" height="450" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  ${SWIPE_HINT_SQUARE}

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List — headline + checklist left, smaller illustration top-right
export const T3_LIST_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <!-- Small wash behind the corner illustration -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(720,180) scale(0.52)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(685,485)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="200" width="920" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline, width capped so it stays clear of the illustration -->
      <div style="position: absolute; top: 64px; left: 0; width: 540px; font-family: 'Fraunces', serif; font-weight: 500; font-size: 50px; color: var(--text-default); line-height: 1.16;">
        {{HEADLINE_HTML}}
      </div>

      <!-- Checklist -->
      <div style="position: absolute; top: 320px; left: 0; width: 620px; display: flex; flex-direction: column; gap: 28px;">
        {{LIST_ITEMS}}
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, top-right corner, flat -->
  <image href="{{DOODLE_IMAGE_URL}}" x="730" y="210" width="290" height="310" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  ${SWIPE_HINT_SQUARE}

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing — headline + body + flat accent button, illustration bottom-right
export const T3_CTA_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}

  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <!-- Wash behind the illustration zone (bottom-right), bleeding off-canvas -->
  <path d="M310,40 C450,25 570,130 580,270 C590,415 500,545 350,570 C200,595 60,510 35,370 C10,230 95,90 230,55 C255,48 285,43 310,40 Z" transform="translate(650,600) scale(0.85)" fill="var(--background-2)" opacity="0.3"/>
  <path d="M30,4 C32,16 34,24 30,30 C36,26 44,28 56,30 C44,32 36,34 30,30 C34,36 32,44 30,56 C28,44 26,36 30,30 C24,34 16,32 4,30 C16,28 24,26 30,30 C26,24 28,16 30,4 Z" transform="translate(615,555)" fill="var(--text-highlight)"/>

  <foreignObject x="80" y="100" width="920" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">

      <!-- Preheader -->
      <div style="position: absolute; top: 0; left: 0; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">{{PREHEADER}}</div>

      <!-- Headline + body + button flow together so gaps stay tight -->
      <div style="position: absolute; top: 64px; left: 0; width: 860px; display: flex; flex-direction: column; align-items: flex-start; gap: 26px;">
        <div style="font-family: 'Fraunces', serif; font-weight: 500; font-size: 56px; color: var(--text-default); line-height: 1.14;">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 460px; font-family: 'Lato', sans-serif; font-weight: 400; font-size: 27px; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
          {{BODY}}
        </div>
        <div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 12px; background: var(--text-highlight); color: var(--background); font-family: 'Lato', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 0.08em; text-transform: uppercase; padding: 20px 42px; border-radius: 12px;">
          FOLLOW US
          <span style="font-size: 28px;">&#8594;</span>
        </div>
      </div>

    </div>
  </foreignObject>

  <!-- Illustration, bottom-right, flat -->
  <image href="{{DOODLE_IMAGE_URL}}" x="610" y="560" width="410" height="440" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode: multiply;"/>

  {{SIGNATURE_CARD}}
</svg>
`;
