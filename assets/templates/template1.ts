// Template 1: "The Truth" - Portrait (1080x1380)
// 2026 cinematic-landing system, fully HTML (foreignObject flex layout — the
// only SVG left is the canvas, the theme-pattern fill and the signature card):
// near-black canvas with a soft accent glow, mono kicker + slide counter, a
// massive tight-tracked grotesk headline in sentence case whose accent phrase
// ({{HEADLINE_HTML}}) is set in italic serif + accent color, ghost numeral,
// hairline dividers and a minimal SWIPE affordance (solid accent button on
// the CTA). Branding-shift anchor: foreignObject x="90" y="190" (portrait).

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

// Shared canvas paint: background + user-selected pattern.
const CANVAS = `
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>
  <!-- Accent glow, anchored to the carousel's top-right corner -->
  <circle cx="1080" cy="0" r="720" fill="url(#t1Glow)"/>
`;

// Mono kicker row: accent tick + preheader, slide counter on the right.
const KICKER = `
  <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 26px; line-height: 34px; color: var(--text-default); overflow: visible;">
    <div style="min-width: 0; overflow: visible; height: 34px;">
      <span style="display: inline-block; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap; overflow: visible; line-height: 34px; height: 34px;">{{PREHEADER}}</span>
    </div>
    <div style="opacity: 0.55; flex-shrink: 0; line-height: 34px; height: 34px;">/{{SLIDE_NUM}}</div>
  </div>
`;

// Minimal swipe affordance for non-CTA slides.
const SWIPE_ROW = `
  <div style="display: flex; align-items: center; gap: 20px; width: 100%;">
    <div style="flex: 1; height: 1px; background: var(--text-default); opacity: 0.25;"></div>
    <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 24px; letter-spacing: 0.22em; color: var(--text-highlight);">SWIPE&#160;&#8594;</div>
  </div>
`;

// Variant 1: Hero
export const T1_HERO_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="90" y="190" width="900" height="1010">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      <!-- Ghost numeral -->
      <div style="position: absolute; top: 40px; right: -20px; font-family: 'Inter Tight', sans-serif; font-weight: 900; font-size: 300px; line-height: 1; color: var(--text-highlight); opacity: 0.05; pointer-events: none;">{{SLIDE_NUM}}</div>

      ${KICKER}

      <!-- Headline + body, pushed toward the vertical center -->
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 46px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 104px; line-height: 1.04; letter-spacing: -0.025em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 74px; height: 6px; background: var(--background-2);"></div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: 32px; line-height: 1.5; color: var(--text-default); max-width: 660px;">
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
export const T1_BODY_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="90" y="190" width="900" height="1010">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 44px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 84px; line-height: 1.08; letter-spacing: -0.02em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="width: 74px; height: 6px; background: var(--background-2);"></div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: 34px; line-height: 1.55; color: var(--text-default); max-width: 720px;">
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
export const T1_LIST_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="90" y="190" width="900" height="1010">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 54px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 76px; line-height: 1.08; letter-spacing: -0.02em; color: var(--text-highlight);">
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
export const T1_CTA_SVG = `
<svg viewBox="0 0 1080.35 1383.91" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  ${CANVAS}

  <foreignObject x="90" y="190" width="900" height="1010">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">

      ${KICKER}

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 46px;">
        <div style="font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 96px; line-height: 1.05; letter-spacing: -0.025em; color: var(--text-highlight);">
          {{HEADLINE_HTML}}
        </div>
        <div style="font-family: 'Lato', sans-serif; font-weight: 400; font-size: 34px; line-height: 1.5; color: var(--text-default); max-width: 680px;">
          {{BODY}}
        </div>
        <div style="margin-top: 16px; display: inline-flex; align-self: flex-start; align-items: center; gap: 16px; background: var(--background-2); color: var(--background); font-family: 'Inter Tight', sans-serif; font-weight: 800; font-size: 30px; letter-spacing: 0.02em; padding: 26px 54px; border-radius: 999px;">
          FOLLOW
          <span style="font-size: 32px;">&#8594;</span>
        </div>
      </div>

    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
