/**
 * Design System Tokens
 *
 * Centralizes values used across carousel slide templates (typography, spacing,
 * dimension scales, font stacks, and CSS custom property color roles).
 */

export const FONTS = {
  interTight: "'Inter Tight', sans-serif",
  fraunces: "'Fraunces', serif",
  mono: "'JetBrains Mono', monospace",
  lato: "'Lato', sans-serif",
  spaceGrotesk: "'Space Grotesk', sans-serif",
  inter: "'Inter', sans-serif",
  roboto: "'Roboto', sans-serif",
} as const;

export const CSS_VARS = {
  textDefault: '--text-default',
  textHighlight: '--text-highlight',
  background: '--background',
  background2: '--background-2',
  patternColor: '--pattern-color',
  patternOpacity: '--pattern-opacity',
  highlightSoft: '--highlight-soft',
} as const;

export const CANVAS_DIMENSIONS = {
  portrait: { width: 1080, height: 1380, viewBox: '0 0 1080.35 1383.91' },
  square: { width: 1080, height: 1080, viewBox: '0 0 1080 1080' },
} as const;

export interface DesignTokens {
  fonts: typeof FONTS;
  cssVars: typeof CSS_VARS;
  canvas: typeof CANVAS_DIMENSIONS;
}

export const DESIGN_TOKENS: DesignTokens = {
  fonts: FONTS,
  cssVars: CSS_VARS,
  canvas: CANVAS_DIMENSIONS,
};
