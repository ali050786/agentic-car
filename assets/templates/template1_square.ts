// Template 1: "The Truth" - Square (1080x1080)
// Mirrors the 2026 cinematic-landing system in template1.ts (accent glow,
// mono kicker + slide counter, tight grotesk headline with italic-serif
// accent phrase, ghost numeral, HTML swipe/CTA), retuned for the square
// aspect ratio. Branding-shift anchor: foreignObject x="80" y="150".

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;800;900&amp;family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,600&amp;family=JetBrains+Mono:wght@500;700&amp;family=Lato:wght@400;700&amp;display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
    <radialGradient id="t1Glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--background-2)" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="var(--background-2)" stop-opacity="0"/>
    </radialGradient>
  </defs>
`;

const CANVAS = `
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>
  <!-- Accent glow, anchored to the carousel's top-right corner -->
  <circle cx="1080" cy="0" r="600" fill="url(#t1Glow)"/>
`;

const KICKER = `
  <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 23px; line-height: 30px; color: var(--text-default); overflow: visible;">
    <div style="min-width: 0; overflow: visible; height: 30px;">
      <span style="display: inline-block; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap; overflow: visible; line-height: 30px; height: 30px;">{{PREHEADER}}</span>
    </div>
    <div style="opacity: 0.55; flex-shrink: 0; line-height: 30px; height: 30px;">/{{SLIDE_NUM}}</div>
  </div>
`;

const SWIPE_ROW = `
  <div style="display: flex; align-items: center; gap: 18px; width: 100%;">
    <div style="flex: 1; height: 1px; background: var(--text-default); opacity: 0.25;"></div>
    <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 22px; letter-spacing: 0.22em; color: var(--text-highlight);">SWIPE&#160;&#8594;</div>
  </div>
`;

// Variant 1: Hero
export const T1_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="80" y="150" width="920" height="800">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      <div style="position: absolute; top: 20px; right: -16px; font-family: 'Inter Tight', sans-serif; font-weight: 900; font-size: 230px; line-height: 1; color: var(--text-highlight); opacity: 0.05; pointer-events: none;">{{SLIDE_NUM}}</div>

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 36px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 82px; line-height: 1.04; letter-spacing: -0.025em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 64px; height: 5px; background: var(--background-2);"></div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: 29px; line-height: 1.5; color: var(--text-default); max-width: 640px;">
          {{BODY}}
        </div>
      </div>

      ${SWIPE_ROW}
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body
export const T1_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="80" y="150" width="920" height="800">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 34px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 66px; line-height: 1.08; letter-spacing: -0.02em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 64px; height: 5px; background: var(--background-2);"></div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: 30px; line-height: 1.5; color: var(--text-default); max-width: 700px;">
          {{BODY}}
        </div>
      </div>

      ${SWIPE_ROW}
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List
export const T1_LIST_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="80" y="150" width="920" height="800">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 40px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 60px; line-height: 1.08; letter-spacing: -0.02em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="display: flex; flex-direction: column;">
          {{LIST_ITEMS}}
        </div>
      </div>

      ${SWIPE_ROW}
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA/Closing
export const T1_CTA_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="80" y="150" width="920" height="800">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 36px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 74px; line-height: 1.05; letter-spacing: -0.025em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: 30px; line-height: 1.5; color: var(--text-default); max-width: 660px;">
          {{BODY}}
        </div>
        <div style="margin-top: 12px; display: inline-flex; align-self: flex-start; align-items: center; gap: 14px; background: var(--background-2); color: var(--background); font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 27px; letter-spacing: 0.02em; padding: 22px 46px; border-radius: 999px;">
          FOLLOW
          <span style="font-size: 29px;">&#8594;</span>
        </div>
      </div>

    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
