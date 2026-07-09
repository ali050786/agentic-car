// Template 4: "The Statement" - HTML-based typographic template (Portrait 1080x1380)
// Layout lives in HTML (foreignObject flexbox); decoration is inline SVG geometry:
// dot grids, outline rings, and an oversized translucent slide numeral.

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
  </defs>
`;

// Generates an evenly spaced dot grid as SVG circles
export const dotGrid = (x: number, y: number, cols: number, rows: number, spacing: number, r: number, opacity: number): string => {
  let dots = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      dots += `<circle cx="${x + col * spacing}" cy="${y + row * spacing}" r="${r}" fill="var(--text-default)" opacity="${opacity}"/>`;
    }
  }
  return `<g>${dots}</g>`;
};


// Variant 1: Hero
export const T4_HERO_SVG = `
<svg viewBox="0 0 1080 1380" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <circle cx="10" cy="10" r="270" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.3"/>
  <circle cx="10" cy="10" r="195" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.2"/>
  {{T4_TOP_DOT_GRID}}


  <text x="1055" y="1345" text-anchor="end" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="360" fill="var(--background-2)" opacity="0.12" letter-spacing="-15">{{SLIDE_NUM}}</text>

  <foreignObject x="100" y="260" width="880" height="840">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: flex-end; height: 100%; gap: 38px;">
      <div style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 28px; letter-spacing: 6px; text-transform: uppercase; color: var(--background-2);">
        {{PREHEADER}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 96px; line-height: 1.06; letter-spacing: -3px; color: var(--text-highlight);">
        {{HEADLINE_HTML}}
      </div>
      <div style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 36px; line-height: 1.5; color: var(--text-default); max-width: 760px;">
        {{BODY}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body
export const T4_BODY_SVG = `
<svg viewBox="0 0 1080 1380" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <text x="100" y="200" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="54" fill="var(--background-2)">{{SLIDE_NUM}}</text>
  <line x1="100" y1="240" x2="980" y2="240" stroke="var(--text-default)" stroke-width="1" opacity="0.25"/>

  <circle cx="1080" cy="1380" r="320" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.2"/>
  <circle cx="1080" cy="1380" r="230" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.14"/>

  <foreignObject x="100" y="320" width="880" height="840">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 44px;">
      <div style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 26px; letter-spacing: 5px; text-transform: uppercase; color: var(--background-2);">
        {{PREHEADER}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 74px; line-height: 1.12; letter-spacing: -2px; color: var(--text-highlight);">
        {{HEADLINE_HTML}}
      </div>
      <div style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 38px; line-height: 1.55; color: var(--text-default);">
        {{BODY}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List
export const T4_LIST_SVG = `
<svg viewBox="0 0 1080 1380" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <text x="100" y="200" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="54" fill="var(--background-2)">{{SLIDE_NUM}}</text>
  <line x1="100" y1="240" x2="980" y2="240" stroke="var(--text-default)" stroke-width="1" opacity="0.25"/>

  ${dotGrid(830, 1180, 5, 5, 30, 3.5, 0.4)}

  <foreignObject x="100" y="310" width="880" height="920">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; height: 100%;">
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 64px; line-height: 1.12; letter-spacing: -2px; color: var(--text-highlight); margin-bottom: 56px;">
        {{HEADLINE_HTML}}
      </div>
      <div style="display: flex; flex-direction: column;">
        {{LIST_ITEMS}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 4: CTA / Closing
export const T4_CTA_SVG = `
<svg viewBox="0 0 1080 1380" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1380" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1380" fill="url(#bgPattern)"/>

  <circle cx="540" cy="620" r="340" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.18"/>
  <circle cx="540" cy="620" r="250" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.12"/>
  {{T4_TOP_DOT_GRID}}


  <foreignObject x="100" y="240" width="880" height="900">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; gap: 42px;">
      <div style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 26px; letter-spacing: 5px; text-transform: uppercase; color: var(--background-2);">
        {{PREHEADER}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 86px; line-height: 1.08; letter-spacing: -2.5px; color: var(--text-highlight);">
        {{HEADLINE_HTML}}
      </div>
      <div style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 36px; line-height: 1.5; color: var(--text-default); max-width: 700px;">
        {{BODY}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 30px; color: var(--text-highlight); border: 2px solid var(--background-2); border-radius: 999px; padding: 22px 54px; margin-top: 12px;">
        {{FOOTER}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
