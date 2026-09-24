/**
 * Canvas design tokens: font pairings, type scale, spacing, radii, direction
 * presets and color-role resolution (with contrast guarantees).
 */

import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';
import a11yPlugin from 'colord/plugins/a11y';
import type { CarouselTheme } from '../../../types';
import type { ColorRole, DesignStyle, Direction, FontPairId, MarkStyle, TextRole } from './types';

extend([mixPlugin, a11yPlugin]);

// ── Fonts ──────────────────────────────────────────────────────────────────

export interface FontFace {
    family: string;
    stack: string;
    /** Google Fonts axis spec for the css2 API (e.g. "wght@400;700"). */
    axes: string;
    /** Average character width in em at the weight we use (for layout estimates). */
    cw: number;
}

const F = (family: string, fallback: string, axes: string, cw: number): FontFace => ({
    family,
    stack: `'${family}', ${fallback}`,
    axes,
    cw,
});

export const FONTS = {
    interTight: F('Inter Tight', 'sans-serif', 'wght@500;600;700;800;900', 0.54),
    inter: F('Inter', 'sans-serif', 'wght@400;500;600;700', 0.5),
    fraunces: F('Fraunces', 'serif', 'ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600', 0.5),
    lato: F('Lato', 'sans-serif', 'wght@400;700', 0.47),
    playfair: F('Playfair Display', 'serif', 'ital,wght@0,600;0,700;0,800;1,600', 0.5),
    sourceSans: F('Source Sans 3', 'sans-serif', 'wght@400;600;700', 0.46),
    dmSerif: F('DM Serif Display', 'serif', 'ital@0;1', 0.47),
    dmSans: F('DM Sans', 'sans-serif', 'wght@400;500;700', 0.5),
    archivoBlack: F('Archivo Black', 'sans-serif', 'wght@400', 0.62),
    archivo: F('Archivo', 'sans-serif', 'wght@400;500;700', 0.5),
    bebas: F('Bebas Neue', 'sans-serif', 'wght@400', 0.4),
    montserrat: F('Montserrat', 'sans-serif', 'wght@400;500;600;700', 0.55),
    spaceGrotesk: F('Space Grotesk', 'sans-serif', 'wght@400;500;700', 0.55),
    jetbrains: F('JetBrains Mono', 'monospace', 'wght@500;700', 0.6),
    spaceMono: F('Space Mono', 'monospace', 'wght@400;700', 0.61),
    bricolage: F('Bricolage Grotesque', 'sans-serif', 'wght@500;700;800', 0.53),
    nunito: F('Nunito', 'sans-serif', 'wght@400;600;700;800', 0.5),
    sora: F('Sora', 'sans-serif', 'wght@400;600;700;800', 0.58),
    manrope: F('Manrope', 'sans-serif', 'wght@400;500;600;700;800', 0.52),
    instrumentSerif: F('Instrument Serif', 'serif', 'ital@0;1', 0.42),
    syne: F('Syne', 'sans-serif', 'wght@600;700;800', 0.62),
} as const;

export interface FontPair {
    id: FontPairId;
    label: string;
    display: FontFace;
    displayWeight: number;
    /** Some display faces only exist in capitals or look best upper-cased. */
    displayUpper?: boolean;
    /** Tighter leading for display text (condensed / heavy faces). */
    displayLeading: number;
    body: FontFace;
    mono: FontFace;
    /** Italic serif used by the "serif" accent mark. */
    accentSerif: FontFace;
}

export const FONT_PAIRS: Record<FontPairId, FontPair> = {
    modern: { id: 'modern', label: 'Modern sans', display: FONTS.interTight, displayWeight: 800, displayLeading: 1.02, body: FONTS.inter, mono: FONTS.jetbrains, accentSerif: FONTS.fraunces },
    editorial: { id: 'editorial', label: 'Editorial serif', display: FONTS.fraunces, displayWeight: 600, displayLeading: 1.06, body: FONTS.lato, mono: FONTS.jetbrains, accentSerif: FONTS.fraunces },
    classic: { id: 'classic', label: 'Classic magazine', display: FONTS.playfair, displayWeight: 700, displayLeading: 1.06, body: FONTS.sourceSans, mono: FONTS.jetbrains, accentSerif: FONTS.playfair },
    warm: { id: 'warm', label: 'Warm serif', display: FONTS.dmSerif, displayWeight: 400, displayLeading: 1.04, body: FONTS.dmSans, mono: FONTS.jetbrains, accentSerif: FONTS.dmSerif },
    poster: { id: 'poster', label: 'Poster', display: FONTS.archivoBlack, displayWeight: 400, displayLeading: 0.98, body: FONTS.archivo, mono: FONTS.spaceMono, accentSerif: FONTS.fraunces },
    condensed: { id: 'condensed', label: 'Condensed impact', display: FONTS.bebas, displayWeight: 400, displayUpper: true, displayLeading: 0.94, body: FONTS.montserrat, mono: FONTS.jetbrains, accentSerif: FONTS.playfair },
    tech: { id: 'tech', label: 'Tech grotesk', display: FONTS.spaceGrotesk, displayWeight: 700, displayLeading: 1.02, body: FONTS.inter, mono: FONTS.jetbrains, accentSerif: FONTS.instrumentSerif },
    friendly: { id: 'friendly', label: 'Friendly', display: FONTS.bricolage, displayWeight: 800, displayLeading: 1.0, body: FONTS.nunito, mono: FONTS.jetbrains, accentSerif: FONTS.fraunces },
    geometric: { id: 'geometric', label: 'Geometric', display: FONTS.sora, displayWeight: 700, displayLeading: 1.04, body: FONTS.manrope, mono: FONTS.jetbrains, accentSerif: FONTS.instrumentSerif },
    elegant: { id: 'elegant', label: 'Elegant', display: FONTS.instrumentSerif, displayWeight: 400, displayLeading: 1.0, body: FONTS.inter, mono: FONTS.jetbrains, accentSerif: FONTS.instrumentSerif },
    agency: { id: 'agency', label: 'Agency', display: FONTS.syne, displayWeight: 800, displayLeading: 1.0, body: FONTS.manrope, mono: FONTS.spaceMono, accentSerif: FONTS.instrumentSerif },
    brutal: { id: 'brutal', label: 'Brutalist', display: FONTS.spaceGrotesk, displayWeight: 700, displayLeading: 0.98, body: FONTS.spaceMono, mono: FONTS.spaceMono, accentSerif: FONTS.playfair },
};

export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as FontPairId[];

/** One Google Fonts import covering every face a pair uses. */
export const fontImportUrl = (pair: FontPair): string => {
    const faces = Array.from(new Map([pair.display, pair.body, pair.mono, pair.accentSerif].map((f) => [f.family, f])).values());
    const families = faces.map((f) => `family=${f.family.replace(/ /g, '+')}:${f.axes}`).join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
};

// ── Type scale ─────────────────────────────────────────────────────────────

export interface RoleSpec {
    px: number;          // portrait base size
    leading: number;
    font: 'display' | 'body' | 'mono';
    weight: number;
    tracking: number;    // em
    upper?: boolean;
}

export const ROLE_SPECS: Record<TextRole, RoleSpec> = {
    kicker: { px: 26, leading: 1.2, font: 'mono', weight: 600, tracking: 0.16, upper: true },
    display: { px: 120, leading: 1.0, font: 'display', weight: 800, tracking: -0.028 },
    title: { px: 86, leading: 1.04, font: 'display', weight: 800, tracking: -0.022 },
    subtitle: { px: 52, leading: 1.14, font: 'display', weight: 700, tracking: -0.012 },
    body: { px: 39, leading: 1.42, font: 'body', weight: 400, tracking: -0.005 },
    small: { px: 31, leading: 1.42, font: 'body', weight: 400, tracking: 0 },
    label: { px: 26, leading: 1.25, font: 'body', weight: 700, tracking: 0.08, upper: true },
    quote: { px: 74, leading: 1.14, font: 'display', weight: 600, tracking: -0.015 },
    number: { px: 290, leading: 0.92, font: 'display', weight: 800, tracking: -0.045 },
    caption: { px: 24, leading: 1.35, font: 'body', weight: 500, tracking: 0.02 },
};

export const sizeStep = (step = 0) => Math.pow(1.15, Math.max(-3, Math.min(3, Math.round(step))));

export const densityFactor = (d: DesignStyle['density']) => (d === 'airy' ? 1.25 : d === 'dense' ? 0.8 : 1);

export const RADII: Record<string, number> = { none: 0, sm: 10, md: 22, lg: 36, pill: 999 };

// ── Canvas geometry ────────────────────────────────────────────────────────

export const CANVAS = {
    portrait: { w: 1080, h: 1350, pad: 96 },
    square: { w: 1080, h: 1080, pad: 84 },
} as const;

// ── Directions ─────────────────────────────────────────────────────────────

export interface DirectionPreset {
    id: Direction;
    label: string;
    blurb: string;
    fonts: FontPairId[];
    radius: DesignStyle['radius'];
    headingCase: DesignStyle['headingCase'];
    density: DesignStyle['density'];
    mark: MarkStyle;
    /** Decorations this direction tends to use. */
    decor: string[];
}

export const DIRECTION_PRESETS: Record<Direction, DirectionPreset> = {
    editorial: { id: 'editorial', label: 'Editorial', blurb: 'Serif headlines, generous margins, thin rules, italic accents.', fonts: ['editorial', 'classic', 'warm'], radius: 'none', headingCase: 'none', density: 'airy', mark: 'serif', decor: ['rules', 'quote-marks', 'frame', 'big-number'] },
    bold: { id: 'bold', label: 'Bold', blurb: 'Huge type, full-bleed color bands, strong contrast.', fonts: ['poster', 'modern', 'condensed'], radius: 'sm', headingCase: 'none', density: 'normal', mark: 'box', decor: ['bands', 'big-number', 'circles'] },
    minimal: { id: 'minimal', label: 'Minimal', blurb: 'Lots of space, restrained type, one accent.', fonts: ['modern', 'elegant', 'geometric'], radius: 'sm', headingCase: 'none', density: 'airy', mark: 'color', decor: ['hairlines', 'small-dot'] },
    playful: { id: 'playful', label: 'Playful', blurb: 'Rounded shapes, blobs, stickers, bright highlights.', fonts: ['friendly', 'geometric', 'agency'], radius: 'lg', headingCase: 'none', density: 'normal', mark: 'highlight', decor: ['blobs', 'sparks', 'stickers', 'waves'] },
    tech: { id: 'tech', label: 'Tech', blurb: 'Grotesk + mono, grids, dots, outlined panels.', fonts: ['tech', 'modern', 'geometric'], radius: 'sm', headingCase: 'none', density: 'normal', mark: 'color', decor: ['dot-grid', 'grid', 'brackets', 'rings'] },
    corporate: { id: 'corporate', label: 'Corporate', blurb: 'Clean cards, icons, calm hierarchy.', fonts: ['modern', 'geometric', 'classic'], radius: 'md', headingCase: 'none', density: 'normal', mark: 'color', decor: ['soft-circles', 'cards', 'icons'] },
    magazine: { id: 'magazine', label: 'Magazine', blurb: 'Giant numbers, columns, serif + sans contrast.', fonts: ['classic', 'condensed', 'editorial'], radius: 'none', headingCase: 'none', density: 'normal', mark: 'serif', decor: ['big-number', 'rules', 'columns'] },
    brutalist: { id: 'brutalist', label: 'Brutalist', blurb: 'Thick borders, hard shadows, raw mono type.', fonts: ['brutal', 'poster', 'tech'], radius: 'none', headingCase: 'upper', density: 'dense', mark: 'box', decor: ['thick-frames', 'hard-shadows', 'crosses'] },
};

export const defaultStyle = (direction: Direction = 'bold', fonts?: FontPairId): DesignStyle => {
    const p = DIRECTION_PRESETS[direction] || DIRECTION_PRESETS.bold;
    return { direction: p.id, fonts: fonts && FONT_PAIRS[fonts] ? fonts : p.fonts[0], radius: p.radius, headingCase: p.headingCase, density: p.density, mark: p.mark };
};

// ── Color roles ────────────────────────────────────────────────────────────

export type Palette = Record<ColorRole, string>;

const hex = (c: string, fallback: string) => {
    const v = colord(c || '');
    return v.isValid() ? v.toHex() : fallback;
};

export const mix = (a: string, b: string, t: number) => colord(a).mix(b, t).toHex();

export const contrast = (a: string, b: string) => colord(a).contrast(b);

/** The candidate with the best contrast against `bg`. */
export const bestOn = (bg: string, candidates: string[]) =>
    candidates.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best), candidates[0]);

/** Nudge `fg` lighter/darker until it reaches `min` contrast on `bg` (or give up at black/white). */
export const ensureContrast = (fg: string, bg: string, min: number): string => {
    if (contrast(fg, bg) >= min) return fg;
    const bgLight = colord(bg).brightness() >= 0.5;
    let c = colord(fg);
    for (let i = 0; i < 20 && c.contrast(bg) < min; i++) c = bgLight ? c.darken(0.05) : c.lighten(0.05);
    if (c.contrast(bg) >= min) return c.toHex();
    return bgLight ? '#111111' : '#FFFFFF';
};

/**
 * Theme → color roles. Canvas themes follow the preset semantics produced by
 * resolveTheme(…, 'template-5'): textDefault = text, textHighlight = primary,
 * background2 = secondary. Any theme works: roles are derived and repaired so
 * text is always readable.
 */
export const resolvePalette = (theme?: CarouselTheme | null): Palette => {
    const bg = hex(theme?.background || '', '#0F1115');
    const dark = colord(bg).brightness() < 0.5;
    let ink = hex(theme?.textDefault || '', dark ? '#F4F4F5' : '#111827');
    ink = ensureContrast(ink, bg, 7);
    let accent = hex(theme?.textHighlight || '', dark ? '#8B5CF6' : '#6D28D9');
    if (contrast(accent, bg) < 1.6) accent = dark ? colord(accent).lighten(0.25).toHex() : colord(accent).darken(0.25).toHex();
    let accent2 = hex(theme?.background2 || '', mix(accent, ink, 0.35));
    if (contrast(accent2, bg) < 1.4) accent2 = mix(accent2, ink, 0.4);
    const inkSoft = ensureContrast(mix(ink, bg, 0.28), bg, 4.5);
    const surface = mix(bg, ink, dark ? 0.08 : 0.05);
    const surface2 = mix(bg, accent, dark ? 0.2 : 0.12);
    const accentSoft = mix(bg, accent, dark ? 0.32 : 0.26);
    const onAccent = bestOn(accent, [bg, ink, '#FFFFFF', '#0B0B0F']);
    const line = mix(bg, ink, dark ? 0.2 : 0.16);
    return { bg, surface, surface2, ink, inkSoft, accent, accent2, accentSoft, onAccent, line };
};

/** Roles that read as "filled" panels (text on them needs its own contrast check). */
export const isStrongFill = (role?: ColorRole) => role === 'accent' || role === 'accent2' || role === 'ink';
