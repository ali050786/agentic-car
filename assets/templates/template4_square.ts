// Template 4: "The Statement" - HTML-based typographic template (Square 1080x1080)

const COMMON_DEFS = `
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&display=swap');
      {{THEME_CSS}}
    </style>
    {{PATTERN_DEFINITION}}
  </defs>
`;

const dotGrid = (x: number, y: number, cols: number, rows: number, spacing: number, r: number, opacity: number): string => {
  let dots = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      dots += `<circle cx="${x + col * spacing}" cy="${y + row * spacing}" r="${r}" fill="var(--text-default)" opacity="${opacity}"/>`;
    }
  }
  return `<g>${dots}</g>`;
};

// Variant 1: Hero
export const T4_HERO_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <circle cx="10" cy="10" r="230" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.3"/>
  <circle cx="10" cy="10" r="165" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.2"/>
  {{T4_TOP_DOT_GRID}}


  <text x="1055" y="1050" text-anchor="end" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="280" fill="var(--background-2)" opacity="0.12" letter-spacing="-12">{{SLIDE_NUM}}</text>

  <foreignObject x="90" y="200" width="900" height="660">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: flex-end; height: 100%; gap: 30px;">
      <div style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 24px; letter-spacing: 5px; text-transform: uppercase; color: var(--background-2);">
        {{PREHEADER}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 78px; line-height: 1.06; letter-spacing: -2.5px; color: var(--text-highlight);">
        {{HEADLINE_HTML}}
      </div>
      <div style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 30px; line-height: 1.5; color: var(--text-default); max-width: 720px;">
        {{BODY}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 2: Body
export const T4_BODY_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <text x="90" y="160" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="46" fill="var(--background-2)">{{SLIDE_NUM}}</text>
  <line x1="90" y1="196" x2="990" y2="196" stroke="var(--text-default)" stroke-width="1" opacity="0.25"/>

  <circle cx="1080" cy="1080" r="270" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.2"/>
  <circle cx="1080" cy="1080" r="195" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.14"/>

  <foreignObject x="90" y="250" width="900" height="680">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 34px;">
      <div style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 22px; letter-spacing: 4px; text-transform: uppercase; color: var(--background-2);">
        {{PREHEADER}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 62px; line-height: 1.12; letter-spacing: -1.5px; color: var(--text-highlight);">
        {{HEADLINE_HTML}}
      </div>
      <div style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 32px; line-height: 1.5; color: var(--text-default);">
        {{BODY}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;

// Variant 3: List
export const T4_LIST_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <text x="90" y="160" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="46" fill="var(--background-2)">{{SLIDE_NUM}}</text>
  <line x1="90" y1="196" x2="990" y2="196" stroke="var(--text-default)" stroke-width="1" opacity="0.25"/>

  ${dotGrid(850, 900, 4, 4, 28, 3.5, 0.4)}

  <foreignObject x="90" y="250" width="900" height="720">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; height: 100%;">
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 54px; line-height: 1.12; letter-spacing: -1.5px; color: var(--text-highlight); margin-bottom: 40px;">
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
export const T4_CTA_SVG_SQUARE = `
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${COMMON_DEFS}
  <rect x="0" y="0" width="1080" height="1080" fill="var(--background)"/>
  <rect x="0" y="0" width="1080" height="1080" fill="url(#bgPattern)"/>

  <circle cx="540" cy="480" r="290" fill="none" stroke="var(--background-2)" stroke-width="2" opacity="0.18"/>
  <circle cx="540" cy="480" r="210" fill="none" stroke="var(--background-2)" stroke-width="1.5" opacity="0.12"/>
  {{T4_TOP_DOT_GRID}}


  <foreignObject x="90" y="180" width="900" height="720">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; gap: 32px;">
      <div style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 22px; letter-spacing: 4px; text-transform: uppercase; color: var(--background-2);">
        {{PREHEADER}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 70px; line-height: 1.08; letter-spacing: -2px; color: var(--text-highlight);">
        {{HEADLINE_HTML}}
      </div>
      <div style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 30px; line-height: 1.5; color: var(--text-default); max-width: 680px;">
        {{BODY}}
      </div>
      <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 26px; color: var(--text-highlight); border: 2px solid var(--background-2); border-radius: 999px; padding: 18px 46px; margin-top: 8px;">
        {{FOOTER}}
      </div>
    </div>
  </foreignObject>

  {{SIGNATURE_CARD}}
</svg>
`;
