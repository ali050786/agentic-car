/**
 * Canvas renderer: SlideDesign + content → the pieces of an export-safe SVG slide.
 *
 * Layout is plain HTML (flex/grid) inside one full-slide <foreignObject>, so
 * the browser does the layout and every existing consumer keeps working
 * (stage, thumbnails, JPG/PDF via html2canvas, Figma copy, HTML export).
 * Decorations are native SVG behind the content. Colors are baked in as
 * literal values from the palette, so each render is self-contained; font
 * sizes use `calc(px * var(--fit))` so text can be shrunk to fit in the browser.
 *
 * Only features html2canvas can paint are used: solid/linear-gradient fills,
 * borders, radii, shadows, rotation, opacity, inline SVG. No clip-path, blend
 * modes, conic gradients or background-clip text.
 */

import type { CarouselTheme, SignaturePosition } from '../../../types';
import type {
    CanvasContent, ColorRole, Decor, DesignStyle, FieldRef, GridNode, ListNode, SceneNode,
    SlideBackground, SlideDesign, StackNode, TextNode, TextRole, Width,
} from './types';
import {
    CANVAS, FONT_PAIRS, FontPair, Palette, RADII, ROLE_SPECS, bestOn, contrast, densityFactor,
    ensureContrast, fontImportUrl, isStrongFill, mix, resolvePalette, sizeStep,
} from './tokens';
import { generateIconSVG } from '../../../utils/iconGenerator';
import { signatureRect } from '../../../utils/signatureCardGenerator';

export interface CanvasRenderOptions {
    format?: 'portrait' | 'square';
    theme?: CarouselTheme | null;
    slideNumber?: number;
    totalSlides?: number;
    /** Where the signature card sits (space is reserved there). Omit when no card. */
    signature?: SignaturePosition | null;
    editable?: boolean;
    /** Unique suffix for SVG ids (several slides on one page). */
    scopeId?: string;
}

export interface CanvasRender {
    width: number;
    height: number;
    palette: Palette;
    fontImport: string;
    /** SVG defs (gradients) */
    defs: string;
    /** Background fill (native SVG). */
    background: string;
    /** Decorations drawn over the background, under the content (native SVG). */
    decor: string;
    /** Body font family (for the signature card). */
    bodyFamily: string;
    /** Readable colors for the signature card on whatever sits under it. */
    signatureColors: { name: string; title: string };
    /** The full-slide HTML (goes inside a <foreignObject>). */
    html: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

const esc = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Size attributes + inline style for nested <svg> elements. Inline style wins
 * over page CSS such as `.stage svg { width: 100% }`, which would otherwise
 * blow icons and arrows up to the size of their container.
 */
const svgBox = (w: number, h: number = w, extra = '') =>
    `width="${num(w)}" height="${num(h)}" style="width:${num(w)}px;height:${num(h)}px;min-width:${num(w)}px;max-width:none;max-height:none;flex-shrink:0;display:block;overflow:visible;${extra}"`;

/** Pins the size of an SVG string produced elsewhere (e.g. lucide icons). */
const pinSvg = (svg: string, px: number) =>
    svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
        const cleaned = attrs.replace(/\s(width|height|style)="[^"]*"/g, '');
        return `<svg${cleaned} ${svgBox(px)}>`;
    });

const WIDTH_PCT: Record<string, number> = { full: 100, '1/4': 25, '1/3': 33.333, '2/5': 40, '1/2': 50, '3/5': 60, '2/3': 66.667, '3/4': 75 };

const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JUSTIFY: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' };

/** Split "Key: value" at the first colon (only when the key is short). */
export const splitKey = (text: string): { key: string; value: string } => {
    const t = (text || '').trim();
    const i = t.indexOf(':');
    if (i > 0 && i <= 48 && i < t.length - 1) return { key: t.slice(0, i).trim(), value: t.slice(i + 1).trim() };
    return { key: '', value: t };
};

/** First number in a string (e.g. "73%" → 73, "$4.2B" → 4.2). */
export const firstNumber = (text: string): number | null => {
    const m = (text || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
};

export const readField = (content: CanvasContent, field: FieldRef): string => {
    if (!field) return '';
    if (field.startsWith('x.')) return (content.extras?.[field.slice(2)] || '').trim();
    return String((content as any)[field] || '').trim();
};

interface Ctx {
    pal: Palette;
    pair: FontPair;
    style: DesignStyle;
    W: number;
    H: number;
    scale: number;
    dens: number;
    pad: { t: number; r: number; b: number; l: number };
    content: CanvasContent;
    editable: boolean;
    slideNumber: number;
    totalSlides: number;
    /** Background color under the node being rendered. */
    under: string;
    underRole: ColorRole;
    parentDir: 'col' | 'row' | 'grid';
    depth: number;
}

const color = (ctx: Ctx, role?: ColorRole) => (role && ctx.pal[role]) || ctx.pal.ink;

const space = (ctx: Ctx, v?: number) => Math.round((v ?? 0) * ctx.dens * ctx.scale);

const radius = (ctx: Ctx, r?: string) => {
    const key = r === 'theme' || !r ? ctx.style.radius : r;
    return RADII[key] ?? 0;
};

const fontStack = (ctx: Ctx, which: 'display' | 'body' | 'mono') =>
    which === 'display' ? ctx.pair.display.stack : which === 'mono' ? ctx.pair.mono.stack : ctx.pair.body.stack;

const editAttrs = (ctx: Ctx, field: string, extra: Record<string, string | number> = {}) => {
    const parts = [`data-edit-field="${esc(field)}"`];
    for (const [k, v] of Object.entries(extra)) parts.push(`data-edit-${k}="${esc(String(v))}"`);
    if (ctx.editable) parts.push('contenteditable="true" spellcheck="false"');
    return parts.join(' ');
};

/** Pick a readable text color: the requested role if it passes, else the best role for this surface. */
const readable = (ctx: Ctx, requested: ColorRole | undefined, fallback: ColorRole, min: number): string => {
    const want = color(ctx, requested || fallback);
    if (contrast(want, ctx.under) >= min) return want;
    const pal = ctx.pal;
    const candidates = [pal.ink, pal.onAccent, pal.bg, pal.accent, '#FFFFFF', '#0B0B0F'];
    const best = bestOn(ctx.under, candidates);
    return contrast(best, ctx.under) >= min ? best : ensureContrast(best, ctx.under, min);
};

const defaultTextRole = (role: TextRole, onStrong: boolean): ColorRole => {
    if (onStrong) return 'onAccent';
    if (role === 'kicker' || role === 'label') return 'accent';
    if (role === 'body' || role === 'small' || role === 'caption') return 'inkSoft';
    if (role === 'number') return 'accent';
    return 'ink';
};

// ── text ───────────────────────────────────────────────────────────────────

const markHtml = (ctx: Ctx, text: string, phrase: string | undefined, mark: string, textColor: string): string => {
    const raw = text;
    if (!phrase || mark === 'none') return esc(raw);
    const i = raw.toLowerCase().indexOf(phrase.toLowerCase());
    if (i < 0) return esc(raw);
    const before = esc(raw.slice(0, i));
    const hit = esc(raw.slice(i, i + phrase.length));
    const after = esc(raw.slice(i + phrase.length));
    // On an accent-colored surface the accent can't mark anything: switch to
    // treatments drawn in the text color instead.
    const onAccentSurface = contrast(ctx.pal.accent, ctx.under) < 2.2;
    let m = mark;
    if (onAccentSurface && (m === 'color' || m === 'highlight')) m = 'underline';
    const accent = onAccentSurface ? textColor : ensureContrast(ctx.pal.accent, ctx.under, 3);
    const clone = '-webkit-box-decoration-break:clone;box-decoration-break:clone;';
    let span = hit;
    switch (m) {
        case 'color':
            span = `<span style="color:${accent};">${hit}</span>`;
            break;
        case 'highlight': {
            const band = ctx.pal.accentSoft;
            span = `<span style="background:linear-gradient(180deg, transparent 56%, ${band} 56%, ${band} 94%, transparent 94%);${clone}">${hit}</span>`;
            break;
        }
        case 'underline':
            span = `<span style="background:linear-gradient(180deg, transparent 88%, ${accent} 88%, ${accent} 97%, transparent 97%);${clone}">${hit}</span>`;
            break;
        case 'serif':
            span = `<em style="font-family:${ctx.pair.accentSerif.stack};font-style:italic;font-weight:500;letter-spacing:-0.01em;color:${accent};">${hit}</em>`;
            break;
        case 'box': {
            const fill = onAccentSurface ? textColor : ctx.pal.accent;
            const fg = onAccentSurface ? ctx.under : bestOn(ctx.pal.accent, [ctx.pal.onAccent, '#FFFFFF', '#0B0B0F']);
            span = `<span style="background:${fill};color:${fg};padding:0 0.12em;${clone}">${hit}</span>`;
            break;
        }
        default:
            span = hit;
    }
    return `${before}${span}${after}`;
};

const textStyle = (ctx: Ctx, role: TextRole, opts: { size?: number; weight?: number; italic?: boolean; upper?: boolean; font?: 'display' | 'body' | 'mono'; tracking?: string; align?: string; colorHex: string; maxWidth?: Width }) => {
    const spec = ROLE_SPECS[role] || ROLE_SPECS.body;
    const px = spec.px * sizeStep(opts.size ?? 0) * ctx.scale;
    const font = opts.font || spec.font;
    const isDisplayRole = role === 'display' || role === 'title' || role === 'number' || role === 'quote';
    const weight = opts.weight ?? (font === 'display' ? ctx.pair.displayWeight : spec.weight);
    const upper = opts.upper ?? (spec.upper || (isDisplayRole && role !== 'quote' && (ctx.style.headingCase === 'upper' || !!ctx.pair.displayUpper)));
    let tracking = spec.tracking;
    if (opts.tracking === 'tight') tracking -= 0.02;
    if (opts.tracking === 'wide') tracking += 0.08;
    if (upper && isDisplayRole) tracking = Math.max(tracking, ctx.pair.displayUpper ? 0.01 : -0.01);
    const leading = isDisplayRole && font === 'display' ? Math.max(spec.leading, ctx.pair.displayLeading) - (role === 'number' ? 0.08 : 0) : spec.leading;
    const parts = [
        `font-family:${fontStack(ctx, font)}`,
        `font-size:calc(${num(px)}px * var(--fit))`,
        `line-height:${leading}`,
        `font-weight:${weight}`,
        `letter-spacing:${num(tracking)}em`,
        `color:${opts.colorHex}`,
        'margin:0',
        'overflow-wrap:break-word',
    ];
    if (opts.italic) parts.push('font-style:italic');
    if (upper) parts.push('text-transform:uppercase');
    if (opts.align) parts.push(`text-align:${opts.align}`);
    if (opts.maxWidth && opts.maxWidth !== 'auto' && WIDTH_PCT[opts.maxWidth]) parts.push(`max-width:${WIDTH_PCT[opts.maxWidth]}%`);
    return parts.join(';');
};

const renderText = (node: TextNode, ctx: Ctx): string => {
    const full = readField(ctx.content, node.field);
    if (!full) return '';
    let text = full;
    let partAttr: Record<string, string> = {};
    if (node.part) {
        const { key, value } = splitKey(full);
        if (node.part === 'key') {
            if (!key) return '';
            text = key;
        } else {
            text = value;
        }
        if (key) partAttr = { part: node.part };
    }
    const spec = ROLE_SPECS[node.role] || ROLE_SPECS.body;
    const large = spec.px * sizeStep(node.size ?? 0) >= 44;
    const onStrong = isStrongFill(ctx.underRole);
    const colorHex = readable(ctx, node.color, defaultTextRole(node.role, onStrong), large ? 3 : 4.5);
    const style = textStyle(ctx, node.role, { size: node.size, weight: node.weight, italic: node.italic, upper: node.upper, font: node.font, tracking: node.tracking, align: node.align, colorHex, maxWidth: node.maxWidth });
    const isHeadline = node.field === 'headline';
    const mark = node.mark ?? (isHeadline ? ctx.style.mark : 'none');
    const inner = isHeadline && !node.part ? markHtml(ctx, text, ctx.content.accentPhrase, mark, colorHex) : esc(text);
    const field = node.field;
    return `<div data-fit style="${style}"><span ${editAttrs(ctx, field, partAttr)}>${inner}</span></div>`;
};

// ── number, quote mark, badge, rule, meta, icon, image, chart ─────────────

const renderNumber = (node: SceneNode & { type: 'number' }, ctx: Ctx): string => {
    const text = readField(ctx.content, node.field);
    if (!text) return '';
    const spec = ROLE_SPECS.number;
    const px = spec.px * sizeStep(node.size ?? 0) * ctx.scale;
    const hexColor = readable(ctx, node.color, isStrongFill(ctx.underRole) ? 'onAccent' : 'accent', 3);
    const serif = / serif$/.test(ctx.pair.display.stack);
    const parts = [
        `font-family:${ctx.pair.display.stack}`,
        `font-size:calc(${num(px)}px * var(--fit))`,
        `line-height:${serif ? 1.02 : Math.max(0.9, ctx.pair.displayLeading - 0.08)}`,
        `font-weight:${ctx.pair.displayWeight}`,
        `letter-spacing:${serif ? '-0.02em' : '-0.045em'}`,
        'font-variant-numeric:lining-nums',
        'margin:0',
        'white-space:nowrap',
    ];
    if (node.align) parts.push(`text-align:${node.align}`);
    // Outlined numerals only work with heavy sans faces.
    const heavy = ctx.pair.displayWeight >= 700 || ctx.pair.id === 'poster' || ctx.pair.id === 'condensed';
    if (node.outline && !serif && heavy) parts.push(`color:transparent;-webkit-text-stroke:${num(Math.max(2, px / 70))}px ${hexColor}`);
    else parts.push(`color:${hexColor}`);
    return `<div data-fit style="${parts.join(';')}"><span ${editAttrs(ctx, node.field)}>${esc(text)}</span></div>`;
};

const renderQuoteMark = (node: SceneNode & { type: 'quotemark' }, ctx: Ctx): string => {
    const px = ({ s: 120, m: 190, l: 280 } as const)[node.size || 'm'] * ctx.scale;
    const c = readable(ctx, node.color, 'accent', 1.5);
    return `<div aria-hidden="true" style="font-family:${ctx.pair.accentSerif.stack};font-size:calc(${num(px)}px * var(--fit));line-height:0.8;height:calc(${num(px * 0.5)}px * var(--fit));color:${c};font-weight:700;">&#8220;</div>`;
};

const ARROW_RIGHT = (c: string, px: number) =>
    `<svg ${svgBox(px)} viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>`;

const renderBadge = (node: SceneNode & { type: 'badge' }, ctx: Ctx): string => {
    const text = readField(ctx.content, node.field);
    if (!text) return '';
    const fillRole = node.fill || 'accent';
    const fill = color(ctx, fillRole);
    const fg = node.outline ? readable(ctx, node.color, 'accent', 3) : bestOn(fill, [color(ctx, node.color || 'onAccent'), ctx.pal.onAccent, '#FFFFFF', '#0B0B0F']);
    const button = node.size === 'button';
    const px = (button ? 34 : ROLE_SPECS.label.px) * ctx.scale;
    const bg = node.outline ? 'transparent' : fill;
    const border = node.outline ? `border:${num(3 * ctx.scale)}px solid ${fg};` : '';
    const self = node.align === 'center' ? 'center' : node.align === 'end' ? 'flex-end' : 'flex-start';
    const padY = (button ? 26 : 10) * ctx.scale;
    const padX = (button ? 52 : 22) * ctx.scale;
    const shadow = button && ctx.style.direction === 'brutalist' ? `box-shadow:${num(8 * ctx.scale)}px ${num(8 * ctx.scale)}px 0 ${ctx.pal.ink};` : '';
    const arrow = button ? ARROW_RIGHT(fg, 38 * ctx.scale) : '';
    return `<div style="display:inline-flex;align-self:${self};align-items:center;gap:${num(16 * ctx.scale)}px;padding:${num(padY)}px ${num(padX)}px;border-radius:${ctx.style.radius === 'none' && button ? 0 : 999}px;background:${bg};${border}${shadow}"><span data-fit style="font-family:${button ? ctx.pair.display.stack : ctx.pair.body.stack};font-weight:${button ? Math.min(800, Math.max(600, ctx.pair.displayWeight)) : 700};font-size:calc(${num(px)}px * var(--fit));letter-spacing:${button ? '0' : '0.08em'};${button ? '' : 'text-transform:uppercase;'}color:${fg};line-height:1.2;${button ? 'white-space:nowrap;' : ''}"><span ${editAttrs(ctx, node.field)}>${esc(text)}</span></span>${arrow}</div>`;
};

const renderRule = (node: SceneNode & { type: 'rule' }, ctx: Ctx): string => {
    const c = color(ctx, node.color || 'accent');
    const h = (node.thick ?? 4) * ctx.scale;
    if (node.vertical) return `<div style="width:${num(h)}px;align-self:stretch;background:${c};flex-shrink:0;border-radius:${num(h)}px;"></div>`;
    const w = node.width === 'short' || !node.width ? `${num(96 * ctx.scale)}px` : node.width === 'auto' ? `${num(96 * ctx.scale)}px` : `${WIDTH_PCT[node.width] ?? 100}%`;
    return `<div style="width:${w};height:${num(h)}px;background:${c};flex-shrink:0;border-radius:${num(h)}px;"></div>`;
};

const pad2 = (n: number) => String(Math.max(0, Math.round(n))).padStart(2, '0');


const renderMeta = (node: SceneNode & { type: 'meta' }, ctx: Ctx): string => {
    const c = readable(ctx, node.color, 'inkSoft', 3);
    const px = 24 * ctx.scale;
    const base = `font-family:${ctx.pair.mono.stack};font-size:calc(${num(px)}px * var(--fit));font-weight:600;letter-spacing:0.12em;color:${c};line-height:1.2;${node.align ? `text-align:${node.align};` : ''}`;
    switch (node.kind) {
        case 'page':
            if (!ctx.slideNumber) return '';
            return `<div style="${base}">${pad2(ctx.slideNumber)}</div>`;
        case 'pageOfTotal':
            if (!ctx.slideNumber) return '';
            return `<div style="${base}">${pad2(ctx.slideNumber)}${ctx.totalSlides ? ` / ${pad2(ctx.totalSlides)}` : ''}</div>`;
        case 'swipe': {
            const ac = readable(ctx, node.color, 'accent', 3);
            return `<div style="display:flex;align-items:center;gap:${num(12 * ctx.scale)}px;${node.align === 'right' ? 'justify-content:flex-end;' : node.align === 'center' ? 'justify-content:center;' : ''}"><span style="${base}color:${ac};text-transform:uppercase;">Swipe</span>${ARROW_RIGHT(ac, 34 * ctx.scale)}</div>`;
        }
        case 'progress': {
            const total = Math.max(ctx.totalSlides || 0, ctx.slideNumber || 0);
            if (!total || !ctx.slideNumber) return '';
            const on = readable(ctx, node.color, 'accent', 2);
            const off = ctx.pal.line;
            const bars = Array.from({ length: Math.min(total, 20) }, (_, i) =>
                `<span style="flex:1;height:${num(6 * ctx.scale)}px;border-radius:6px;background:${i < ctx.slideNumber ? on : off};"></span>`).join('');
            return `<div style="display:flex;gap:${num(8 * ctx.scale)}px;width:100%;">${bars}</div>`;
        }
        default:
            return '';
    }
};

const ICON_PX = { s: 44, m: 64, l: 96, xl: 140 } as const;

const renderIcon = (node: SceneNode & { type: 'icon' }, ctx: Ctx): string => {
    const name = node.name || ctx.content.icon || '';
    if (!name) return '';
    const px = ICON_PX[node.size || 'm'] * ctx.scale;
    const tileRole = node.tile;
    const shape = node.shape || (tileRole ? 'circle' : 'none');
    const under = tileRole ? color(ctx, tileRole) : ctx.under;
    const stroke = tileRole
        ? bestOn(under, [color(ctx, node.color || (isStrongFill(tileRole) ? 'onAccent' : 'accent')), ctx.pal.ink, ctx.pal.onAccent, '#FFFFFF', '#0B0B0F'])
        : readable(ctx, node.color, 'accent', 3);
    const raw = generateIconSVG(name, px / 0.6, stroke);
    if (!raw) return '';
    const svg = pinSvg(raw, px);
    if (shape === 'none' || !tileRole) return `<div style="display:flex;flex-shrink:0;line-height:0;">${svg}</div>`;
    const box = px * 1.8;
    const r = shape === 'circle' ? '50%' : `${radius(ctx, 'theme') || 14}px`;
    return `<div style="width:${num(box)}px;height:${num(box)}px;border-radius:${r};background:${under};display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:0;">${svg}</div>`;
};

const IMAGE_W = { s: 240, m: 330, l: 440 } as const;

const renderImage = (node: SceneNode & { type: 'image' }, ctx: Ctx): string => {
    const url = ctx.content.doodleUrl;
    if (!url) return '';
    const w = IMAGE_W[node.size || 'm'] * ctx.scale;
    const mask = node.mask || 'rounded';
    const frame = color(ctx, node.frame || 'surface');
    if (mask === 'circle') {
        const d = w;
        return `<div style="width:${num(d)}px;height:${num(d)}px;border-radius:50%;overflow:hidden;background:#FFFFFF;flex-shrink:0;align-self:center;"><img src="${esc(url)}" alt="" style="display:block;width:${num(d)}px;height:${num(d * 1.5)}px;margin-top:-${num(d * 0.22)}px;"/></div>`;
    }
    const h = w * 1.5;
    const rad = mask === 'arch' ? `${num(w / 2)}px ${num(w / 2)}px 14px 14px` : mask === 'none' ? '0' : `${Math.max(14, radius(ctx, 'theme'))}px`;
    return `<div style="padding:${num(14 * ctx.scale)}px;background:${frame};border-radius:${rad};flex-shrink:0;align-self:center;line-height:0;"><div style="border-radius:${rad};overflow:hidden;background:#FFFFFF;line-height:0;"><img src="${esc(url)}" alt="" style="display:block;width:${num(w)}px;height:${num(h)}px;"/></div></div>`;
};

const renderChart = (node: SceneNode & { type: 'chart' }, ctx: Ctx): string => {
    const c = readable(ctx, node.color, isStrongFill(ctx.underRole) ? 'onAccent' : 'accent', 2);
    const track = node.track ? color(ctx, node.track) : (isStrongFill(ctx.underRole) ? 'rgba(255,255,255,0.25)' : ctx.pal.line);
    if (node.kind === 'ring' || node.kind === 'progress') {
        const raw = ctx.content.statNumber || '';
        const n = firstNumber(raw);
        if (n === null || !/%/.test(raw) || n < 0 || n > 100) return '';
        if (node.kind === 'progress') {
            const h = 26 * ctx.scale;
            return `<div style="width:100%;height:${num(h)}px;border-radius:${num(h)}px;background:${track};overflow:hidden;flex-shrink:0;"><div style="width:${num(n)}%;height:100%;border-radius:${num(h)}px;background:${c};"></div></div>`;
        }
        const d = ({ s: 300, m: 420, l: 540 } as const)[node.size || 'm'] * ctx.scale;
        const circ = 2 * Math.PI * 42;
        const numberHtml = renderNumber({ type: 'number', field: 'statNumber', size: node.size === 'l' ? -2 : node.size === 's' ? -4 : -3, color: node.color }, ctx);
        return `<div style="position:relative;width:${num(d)}px;height:${num(d)}px;flex-shrink:0;align-self:center;display:flex;align-items:center;justify-content:center;">`
            + `<svg ${svgBox(d, d, 'position:absolute;left:0;top:0;')} viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="${track}" stroke-width="9"/><circle cx="50" cy="50" r="42" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${num((circ * n) / 100)} ${num(circ)}" transform="rotate(-90 50 50)"/></svg>`
            + `<div style="position:relative;">${numberHtml}</div></div>`;
    }
    // bars: one per list item with a number in it
    const items = (ctx.content.listItems || []).map((it, i) => ({ i, ...splitKey(it), n: firstNumber(it) })).filter((x) => x.n !== null && x.n! >= 0);
    if (items.length < 2) return '';
    const max = Math.max(...items.map((x) => x.n as number)) || 1;
    const h = 30 * ctx.scale;
    const labelPx = ROLE_SPECS.small.px * ctx.scale;
    const inkSoft = readable(ctx, undefined, isStrongFill(ctx.underRole) ? 'onAccent' : 'inkSoft', 4.5);
    const rows = items.map((x) => `<div style="display:flex;flex-direction:column;gap:${num(10 * ctx.scale)}px;">`
        + `<div data-fit style="font-family:${ctx.pair.body.stack};font-size:calc(${num(labelPx)}px * var(--fit));line-height:1.3;color:${inkSoft};display:flex;justify-content:space-between;gap:16px;">`
        + `<span ${editAttrs(ctx, 'listItem', { index: x.i, part: x.key ? 'key' : 'value' })} style="font-weight:700;">${esc(x.key || x.value)}</span>`
        + (x.key ? `<span ${editAttrs(ctx, 'listItem', { index: x.i, part: 'value' })}>${esc(x.value)}</span>` : '')
        + `</div><div style="height:${num(h)}px;border-radius:${num(h)}px;background:${track};overflow:hidden;"><div style="width:${num(Math.max(4, ((x.n as number) / max) * 100))}%;height:100%;border-radius:${num(h)}px;background:${c};"></div></div></div>`).join('');
    return `<div style="display:flex;flex-direction:column;gap:${num(28 * ctx.scale)}px;width:100%;">${rows}</div>`;
};

// ── list ───────────────────────────────────────────────────────────────────

const renderList = (node: ListNode, ctx: Ctx): string => {
    const items = (ctx.content.listItems || []).map((s) => String(s || '').trim()).filter(Boolean);
    if (!items.length) return '';
    const look = node.look || 'numbers';
    const sz = node.size ?? 0;
    const onStrong = isStrongFill(ctx.underRole);
    const markerHex = readable(ctx, node.marker, onStrong ? 'onAccent' : 'accent', 3);
    const keyHex = readable(ctx, node.color, onStrong ? 'onAccent' : 'ink', 4.5);
    const valHex = readable(ctx, undefined, onStrong ? 'onAccent' : 'inkSoft', 4.5);
    const bodyPx = ROLE_SPECS.body.px * sizeStep(sz) * ctx.scale * (items.length >= 5 ? 0.9 : 1);
    const gap = space(ctx, node.gap ?? (look === 'cards' ? 20 : 28));
    const cols = Math.max(1, Math.min(3, node.cols || 1));
    const bodyFont = `font-family:${ctx.pair.body.stack};font-size:calc(${num(bodyPx)}px * var(--fit));line-height:1.4;`;

    const itemText = (text: string, i: number, layout: 'inline' | 'stacked', kHex = keyHex, vHex = valHex) => {
        const { key, value } = splitKey(text);
        if (!key) return `<div data-fit style="${bodyFont}color:${kHex};"><span ${editAttrs(ctx, 'listItem', { index: i })}>${esc(value)}</span></div>`;
        if (layout === 'inline') {
            return `<div data-fit style="${bodyFont}color:${vHex};"><span ${editAttrs(ctx, 'listItem', { index: i, part: 'key' })} style="color:${kHex};font-weight:700;">${esc(key)}</span><span style="color:${kHex};font-weight:700;">: </span><span ${editAttrs(ctx, 'listItem', { index: i, part: 'value' })}>${esc(value)}</span></div>`;
        }
        const titlePx = ROLE_SPECS.subtitle.px * sizeStep(sz) * ctx.scale * 0.82;
        return `<div style="display:flex;flex-direction:column;gap:${num(8 * ctx.scale)}px;min-width:0;">`
            + `<div data-fit style="font-family:${ctx.pair.display.stack};font-weight:${Math.min(800, ctx.pair.displayWeight)};font-size:calc(${num(titlePx)}px * var(--fit));line-height:1.12;color:${kHex};letter-spacing:-0.01em;${ctx.pair.displayUpper ? 'text-transform:uppercase;' : ''}"><span ${editAttrs(ctx, 'listItem', { index: i, part: 'key' })}>${esc(key)}</span></div>`
            + `<div data-fit style="${bodyFont}color:${vHex};"><span ${editAttrs(ctx, 'listItem', { index: i, part: 'value' })}>${esc(value)}</span></div></div>`;
    };

    const wrap = (inner: string) => cols > 1
        ? `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap}px;width:100%;">${inner}</div>`
        : `<div style="display:flex;flex-direction:column;gap:${gap}px;width:100%;">${inner}</div>`;

    const numPx = (base: number) => num(base * sizeStep(sz) * ctx.scale);

    switch (look) {
        case 'checks': {
            const d = 44 * ctx.scale;
            const tick = bestOn(markerHex, [ctx.pal.onAccent, '#FFFFFF', '#0B0B0F']);
            return wrap(items.map((it, i) => `<div style="display:flex;gap:${num(24 * ctx.scale)}px;align-items:flex-start;">`
                + `<div style="width:${num(d)}px;height:${num(d)}px;border-radius:50%;background:${markerHex};flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:${num(2 * ctx.scale)}px;"><svg ${svgBox(d * 0.55)} viewBox="0 0 24 24" fill="none" stroke="${tick}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`
                + itemText(it, i, 'inline') + '</div>').join(''));
        }
        case 'dots':
            return wrap(items.map((it, i) => `<div style="display:flex;gap:${num(22 * ctx.scale)}px;align-items:flex-start;">`
                + `<div style="width:${num(14 * ctx.scale)}px;height:${num(14 * ctx.scale)}px;border-radius:50%;background:${markerHex};flex-shrink:0;margin-top:calc(${num(bodyPx * 0.5)}px * var(--fit));"></div>`
                + itemText(it, i, 'inline') + '</div>').join(''));
        case 'cards': {
            const fillRole = node.fill || (ctx.underRole === 'surface' ? 'bg' : 'surface');
            const fill = color(ctx, fillRole);
            const cardCtx: Ctx = { ...ctx, under: fill, underRole: fillRole };
            const cKey = readable(cardCtx, node.color, isStrongFill(fillRole) ? 'onAccent' : 'ink', 4.5);
            const cVal = readable(cardCtx, undefined, isStrongFill(fillRole) ? 'onAccent' : 'inkSoft', 4.5);
            const cMark = readable(cardCtx, node.marker, isStrongFill(fillRole) ? 'onAccent' : 'accent', 3);
            const r = Math.max(radius(ctx, 'theme'), 0);
            const border = ctx.style.direction === 'brutalist' ? `border:${num(3 * ctx.scale)}px solid ${ctx.pal.ink};box-shadow:${num(8 * ctx.scale)}px ${num(8 * ctx.scale)}px 0 ${ctx.pal.ink};` : '';
            return wrap(items.map((it, i) => `<div style="background:${fill};border-radius:${r}px;padding:${num(32 * ctx.scale)}px ${num(34 * ctx.scale)}px;display:flex;flex-direction:column;gap:${num(14 * ctx.scale)}px;${border}">`
                + `<div style="font-family:${ctx.pair.mono.stack};font-size:calc(${numPx(22)}px * var(--fit));font-weight:700;letter-spacing:0.12em;color:${cMark};">${pad2(i + 1)}</div>`
                + itemText(it, i, 'stacked', cKey, cVal) + '</div>').join(''));
        }
        case 'steps':
        case 'timeline': {
            const d = (look === 'steps' ? 60 : 26) * ctx.scale;
            const lineC = ctx.pal.line;
            const fg = bestOn(markerHex, [ctx.pal.onAccent, '#FFFFFF', '#0B0B0F']);
            return `<div style="display:flex;flex-direction:column;width:100%;">` + items.map((it, i) => {
                const last = i === items.length - 1;
                const dot = look === 'steps'
                    ? `<div style="width:${num(d)}px;height:${num(d)}px;border-radius:50%;background:${markerHex};color:${fg};display:flex;align-items:center;justify-content:center;font-family:${ctx.pair.display.stack};font-weight:800;font-size:${num(d * 0.46)}px;flex-shrink:0;">${i + 1}</div>`
                    : `<div style="width:${num(d)}px;height:${num(d)}px;border-radius:50%;border:${num(5 * ctx.scale)}px solid ${markerHex};background:${ctx.under};flex-shrink:0;margin-top:${num(6 * ctx.scale)}px;"></div>`;
                const rail = last ? '' : `<div style="flex:1;width:${num(4 * ctx.scale)}px;background:${lineC};margin-top:${num(8 * ctx.scale)}px;border-radius:4px;"></div>`;
                return `<div style="display:flex;gap:${num(28 * ctx.scale)}px;">`
                    + `<div style="display:flex;flex-direction:column;align-items:center;width:${num(d)}px;flex-shrink:0;">${dot}${rail}</div>`
                    + `<div style="flex:1;min-width:0;padding-bottom:${last ? 0 : gap}px;">${itemText(it, i, 'stacked')}</div></div>`;
            }).join('') + '</div>';
        }
        case 'bignum': {
            const px = 120 * sizeStep(sz) * ctx.scale * (items.length >= 5 ? 0.8 : 1);
            return wrap(items.map((it, i) => `<div style="display:flex;gap:${num(30 * ctx.scale)}px;align-items:flex-start;">`
                + `<div data-fit style="font-family:${ctx.pair.display.stack};font-weight:${ctx.pair.displayWeight};font-size:calc(${num(px)}px * var(--fit));line-height:0.85;color:${markerHex};letter-spacing:-0.04em;min-width:${num(px * 0.9)}px;">${i + 1}</div>`
                + `<div style="flex:1;min-width:0;padding-top:${num(8 * ctx.scale)}px;">${itemText(it, i, 'stacked')}</div></div>`).join(''));
        }
        case 'chips': {
            const fill = ctx.pal.accentSoft;
            const chipCtx: Ctx = { ...ctx, under: fill, underRole: 'accentSoft' };
            const fg = readable(chipCtx, 'ink', 'ink', 4.5);
            return `<div style="display:flex;flex-wrap:wrap;gap:${num(16 * ctx.scale)}px;">` + items.map((it, i) =>
                `<div data-fit style="${bodyFont}color:${fg};background:${fill};border-radius:999px;padding:${num(14 * ctx.scale)}px ${num(28 * ctx.scale)}px;"><span ${editAttrs(ctx, 'listItem', { index: i })}>${esc(it)}</span></div>`).join('') + '</div>';
        }
        case 'numbers':
        default: {
            const idxPx = 28 * sizeStep(sz) * ctx.scale;
            return `<div style="display:flex;flex-direction:column;width:100%;">` + items.map((it, i) => `${i > 0 ? `<div style="height:${num(2 * ctx.scale)}px;background:${ctx.pal.line};"></div>` : ''}`
                + `<div style="display:flex;gap:${num(28 * ctx.scale)}px;align-items:flex-start;padding:${num(gap * 0.8)}px 0;">`
                + `<div style="font-family:${ctx.pair.mono.stack};font-weight:700;font-size:calc(${num(idxPx)}px * var(--fit));color:${markerHex};min-width:${num(idxPx * 2)}px;padding-top:${num(4 * ctx.scale)}px;">${pad2(i + 1)}</div>`
                + `<div style="flex:1;min-width:0;">${itemText(it, i, 'inline')}</div></div>`).join('') + '</div>';
        }
    }
};

// ── containers ─────────────────────────────────────────────────────────────

const stackStyle = (node: StackNode, ctx: Ctx, isRoot: boolean): { style: string; under: string; underRole: ColorRole } => {
    const dir = node.dir === 'row' ? 'row' : 'column';
    const s: string[] = ['display:flex', `flex-direction:${dir}`, 'box-sizing:border-box'];
    if (!isRoot) s.push('position:relative');
    if (node.gap !== undefined) s.push(`gap:calc(${space(ctx, node.gap)}px * (0.45 + 0.55 * var(--fit)))`);
    if (node.align) s.push(`align-items:${ALIGN[node.align] || 'stretch'}`);
    if (node.justify) s.push(`justify-content:${JUSTIFY[node.justify] || 'flex-start'}`);
    if (node.wrap) s.push('flex-wrap:wrap');

    let under = ctx.under;
    let underRole = ctx.underRole;
    if (isRoot) {
        // The root's fill is painted by the SVG background layer (so decorations stay visible).
    } else if (node.gradient && node.gradient.length === 2) {
        const a = color(ctx, node.gradient[0]);
        const b = color(ctx, node.gradient[1]);
        s.push(`background:linear-gradient(135deg, ${a}, ${b})`);
        under = a;
        underRole = node.gradient[0];
    } else if (node.fill) {
        const f = color(ctx, node.fill);
        s.push(`background:${f}`);
        under = f;
        underRole = node.fill;
    }

    // Padding (root padding comes from the canvas + signature safe area).
    let pt = 0, pr = 0, pb = 0, pl = 0;
    if (!isRoot) {
        const p = space(ctx, node.pad ?? (node.fill || node.gradient || node.border ? 40 : 0));
        const px = node.padX !== undefined ? space(ctx, node.padX) : p;
        const py = node.padY !== undefined ? space(ctx, node.padY) : p;
        pt = pb = py;
        pl = pr = px;
    }
    // Bleed: extend to the slide edges through the root padding.
    if (!isRoot && node.bleed && ctx.depth === 1) {
        const P = ctx.pad;
        const m = { t: 0, r: 0, b: 0, l: 0 };
        if (node.bleed === 'top' || node.bleed === 'all') m.t = P.t;
        if (node.bleed === 'bottom' || node.bleed === 'all') m.b = P.b;
        m.l = P.l; m.r = P.r;
        s.push(`margin:${-m.t}px ${-m.r}px ${-m.b}px ${-m.l}px`);
        pt += m.t; pr += m.r; pb += m.b; pl += m.l;
    }
    if (pt || pr || pb || pl) s.push(`padding:${pt}px ${pr}px ${pb}px ${pl}px`);

    if (!isRoot) {
        const r = node.radius ? radius(ctx, node.radius) : (node.fill || node.gradient) && !node.bleed ? radius(ctx, 'theme') : 0;
        if (r) s.push(`border-radius:${r}px`);
        if (node.border) s.push(`border:${num((node.borderW ?? 2) * ctx.scale)}px solid ${color(ctx, node.border)}`);
        if (node.shadow === 'soft') s.push('box-shadow:0 30px 60px -30px rgba(0,0,0,0.45)');
        if (node.shadow === 'hard') s.push(`box-shadow:${num(10 * ctx.scale)}px ${num(10 * ctx.scale)}px 0 ${ctx.pal.ink}`);
        if (node.rotate) s.push(`transform:rotate(${Math.max(-10, Math.min(10, node.rotate))}deg)`);

        // Sizing inside the parent.
        if (typeof node.basis === 'number' && node.basis > 0) {
            const b = Math.max(0.1, Math.min(0.9, node.basis)) * 100;
            s.push(`flex:0 0 ${num(b)}%`);
        } else if (node.grow) {
            s.push('flex:1 1 0');
            s.push(ctx.parentDir === 'row' ? 'min-width:0' : '');
        } else if (node.width && node.width !== 'auto') {
            const pct = WIDTH_PCT[node.width];
            if (ctx.parentDir === 'row') s.push(`flex:0 0 ${num(pct)}%`, 'min-width:0');
            else s.push(`width:${num(pct)}%`);
        }
        if (ctx.parentDir === 'row' && !node.basis && !node.grow && (!node.width || node.width === 'auto')) s.push('min-width:0');
    }
    return { style: s.filter(Boolean).join(';'), under, underRole };
};

const renderChildren = (kids: SceneNode[] | undefined, ctx: Ctx): string =>
    (kids || []).map((k) => renderNode(k, ctx)).join('');

const renderStack = (node: StackNode, ctx: Ctx, isRoot = false): string => {
    const { style, under, underRole } = stackStyle(node, ctx, isRoot);
    const childCtx: Ctx = { ...ctx, under, underRole, parentDir: node.dir === 'row' ? 'row' : 'col', depth: ctx.depth + 1 };
    return `<div style="${style}">${renderChildren(node.children, childCtx)}</div>`;
};

const renderGrid = (node: GridNode, ctx: Ctx): string => {
    const cols = node.cols === 3 ? 3 : 2;
    const childCtx: Ctx = { ...ctx, parentDir: 'grid', depth: ctx.depth + 1 };
    return `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${space(ctx, node.gap ?? 24)}px;width:100%;">${renderChildren(node.children, childCtx)}</div>`;
};

export const renderNode = (node: SceneNode, ctx: Ctx): string => {
    if (!node || typeof node !== 'object') return '';
    switch (node.type) {
        case 'stack': return renderStack(node, ctx);
        case 'grid': return renderGrid(node, ctx);
        case 'text': return renderText(node, ctx);
        case 'list': return renderList(node, ctx);
        case 'number': return renderNumber(node, ctx);
        case 'chart': return renderChart(node, ctx);
        case 'icon': return renderIcon(node, ctx);
        case 'image': return renderImage(node, ctx);
        case 'rule': return renderRule(node, ctx);
        case 'badge': return renderBadge(node, ctx);
        case 'meta': return renderMeta(node, ctx);
        case 'quotemark': return renderQuoteMark(node, ctx);
        case 'spacer':
            return node.grow
                ? '<div style="flex:1 1 0;min-height:0;"></div>'
                : `<div style="flex-shrink:0;width:${space(ctx, node.size ?? 24)}px;height:calc(${space(ctx, node.size ?? 24)}px * var(--fit));"></div>`;
        default:
            return '';
    }
};

// ── background + decorations (SVG) ─────────────────────────────────────────

const BLOBS = [
    'M0.52,0.03 C0.76,0.02 0.97,0.2 0.98,0.45 C0.99,0.71 0.83,0.93 0.57,0.97 C0.31,1.01 0.07,0.86 0.02,0.61 C-0.03,0.36 0.12,0.09 0.38,0.05 C0.43,0.04 0.47,0.03 0.52,0.03 Z',
    'M0.47,0.02 C0.7,0.0 0.9,0.13 0.97,0.36 C1.04,0.6 0.91,0.86 0.68,0.95 C0.45,1.04 0.18,0.95 0.07,0.73 C-0.04,0.51 0.03,0.27 0.2,0.13 C0.28,0.06 0.37,0.03 0.47,0.02 Z',
    'M0.55,0.06 C0.8,0.08 1.0,0.32 0.96,0.57 C0.92,0.82 0.7,1.0 0.45,0.97 C0.2,0.94 0.02,0.74 0.03,0.49 C0.04,0.24 0.3,0.04 0.55,0.06 Z',
];

const SPARK = 'M0.5,0 C0.53,0.3 0.7,0.47 1,0.5 C0.7,0.53 0.53,0.7 0.5,1 C0.47,0.7 0.3,0.53 0,0.5 C0.3,0.47 0.47,0.3 0.5,0 Z';

const scalePath = (d: string, x: number, y: number, w: number, h: number) =>
    d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_m, a, b) => `${num(x + Number(a) * w)},${num(y + Number(b) * h)}`);

const renderDecor = (d: Decor, ctx: Ctx, idx: number): string => {
    const W = ctx.W;
    const H = ctx.H;
    const cx = (Math.max(-20, Math.min(120, d.x)) / 100) * W;
    const cy = (Math.max(-20, Math.min(120, d.y)) / 100) * H;
    const w = (Math.max(1, Math.min(160, d.w)) / 100) * W;
    const h = (Math.max(1, Math.min(160, d.h ?? d.w)) / 100) * W;
    const x = cx - w / 2;
    const y = cy - h / 2;
    let c = color(ctx, d.color);
    // A decoration in the slide's own background color would vanish (e.g. an
    // accent shape on an accent slide): draw it in the best contrasting role.
    if (contrast(c, ctx.under) < 1.25) c = bestOn(ctx.under, [ctx.pal.ink, ctx.pal.bg, ctx.pal.onAccent, ctx.pal.accent]);
    const big = w > W * 0.25;
    const op = Math.max(0.03, Math.min(1, d.opacity ?? (big ? 0.18 : 0.9)));
    const rot = d.rotate ? ` transform="rotate(${num(d.rotate)} ${num(cx)} ${num(cy)})"` : '';
    const sw = Math.max(2, Math.min(10, w * 0.02));
    const paint = (outline?: boolean) => (outline ? `fill="none" stroke="${c}" stroke-width="${num(sw)}"` : `fill="${c}"`);
    switch (d.shape) {
        case 'circle':
            return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(w / 2)}" ${paint(d.outline)} opacity="${op}"/>`;
        case 'ring':
            return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(w / 2)}" fill="none" stroke="${c}" stroke-width="${num(Math.max(2, w * 0.035))}" opacity="${op}"/>`;
        case 'blob':
            return `<path d="${scalePath(BLOBS[idx % BLOBS.length], x, y, w, h)}" ${paint(d.outline)} opacity="${op}"${rot}/>`;
        case 'rect':
            return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${radius(ctx, 'theme')}" ${paint(d.outline)} opacity="${op}"${rot}/>`;
        case 'pill':
            return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(Math.min(w, h) / 2)}" ${paint(d.outline)} opacity="${op}"${rot}/>`;
        case 'arc':
            return `<path d="M ${num(x)} ${num(cy)} A ${num(w / 2)} ${num(h / 2)} 0 0 1 ${num(x + w)} ${num(cy)}" fill="none" stroke="${c}" stroke-width="${num(Math.max(3, w * 0.03))}" stroke-linecap="round" opacity="${op}"${rot}/>`;
        case 'dots': {
            const step = 30 * ctx.scale;
            const r = 3.6 * ctx.scale;
            const out: string[] = [];
            for (let yy = y; yy <= y + h; yy += step) for (let xx = x; xx <= x + w; xx += step) out.push(`<circle cx="${num(xx)}" cy="${num(yy)}" r="${num(r)}"/>`);
            return `<g fill="${c}" opacity="${Math.min(op, 0.6)}"${rot}>${out.slice(0, 900).join('')}</g>`;
        }
        case 'halftone': {
            const step = 30 * ctx.scale;
            const out: string[] = [];
            for (let yy = y; yy <= y + h; yy += step) for (let xx = x; xx <= x + w; xx += step) {
                const t = (xx - x) / Math.max(1, w);
                out.push(`<circle cx="${num(xx)}" cy="${num(yy)}" r="${num((1 - t) * 9 * ctx.scale + 1)}"/>`);
            }
            return `<g fill="${c}" opacity="${Math.min(op, 0.5)}"${rot}>${out.slice(0, 900).join('')}</g>`;
        }
        case 'grid': {
            const step = 64 * ctx.scale;
            const out: string[] = [];
            for (let xx = x; xx <= x + w + 0.1; xx += step) out.push(`<line x1="${num(xx)}" y1="${num(y)}" x2="${num(xx)}" y2="${num(y + h)}"/>`);
            for (let yy = y; yy <= y + h + 0.1; yy += step) out.push(`<line x1="${num(x)}" y1="${num(yy)}" x2="${num(x + w)}" y2="${num(yy)}"/>`);
            return `<g stroke="${c}" stroke-width="1.5" opacity="${Math.min(op, 0.35)}"${rot}>${out.join('')}</g>`;
        }
        case 'lines': {
            const step = 26 * ctx.scale;
            const out: string[] = [];
            // 45° stripes clipped analytically to the box.
            for (let k = -h; k <= w; k += step) {
                const x1 = x + Math.max(0, k);
                const y1 = y + Math.max(0, -k);
                const len = Math.min(w - Math.max(0, k), h - Math.max(0, -k));
                if (len <= 0) continue;
                out.push(`<line x1="${num(x1)}" y1="${num(y1 + len)}" x2="${num(x1 + len)}" y2="${num(y1)}"/>`);
            }
            return `<g stroke="${c}" stroke-width="${num(3 * ctx.scale)}" opacity="${Math.min(op, 0.5)}"${rot}>${out.join('')}</g>`;
        }
        case 'wave': {
            const amp = h / 2;
            const periods = 3;
            let p = `M ${num(x)} ${num(cy)}`;
            for (let i = 0; i < periods * 2; i++) {
                const sx = x + (w / (periods * 2)) * i;
                const ex = x + (w / (periods * 2)) * (i + 1);
                p += ` Q ${num((sx + ex) / 2)} ${num(cy + (i % 2 === 0 ? -amp : amp))} ${num(ex)} ${num(cy)}`;
            }
            return `<path d="${p}" fill="none" stroke="${c}" stroke-width="${num(Math.max(4, 7 * ctx.scale))}" stroke-linecap="round" opacity="${op}"${rot}/>`;
        }
        case 'spark':
            return `<path d="${scalePath(SPARK, x, y, w, h)}" fill="${c}" opacity="${op}"${rot}/>`;
        case 'star': {
            const pts: string[] = [];
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                const r = i % 2 === 0 ? w / 2 : w / 5;
                pts.push(`${num(cx + r * Math.cos(a))},${num(cy + r * Math.sin(a))}`);
            }
            return `<polygon points="${pts.join(' ')}" ${paint(d.outline)} opacity="${op}"${rot}/>`;
        }
        case 'triangle':
            return `<polygon points="${num(cx)},${num(y)} ${num(x + w)},${num(y + h)} ${num(x)},${num(y + h)}" ${paint(d.outline)} opacity="${op}"${rot}/>`;
        case 'cross': {
            const t = Math.max(3, w * 0.12);
            return `<g stroke="${c}" stroke-width="${num(t)}" stroke-linecap="round" opacity="${op}"${rot}><line x1="${num(cx)}" y1="${num(y)}" x2="${num(cx)}" y2="${num(y + h)}"/><line x1="${num(x)}" y1="${num(cy)}" x2="${num(x + w)}" y2="${num(cy)}"/></g>`;
        }
        case 'arrow': {
            const p = `M ${num(x)} ${num(y + h * 0.8)} C ${num(x + w * 0.35)} ${num(y + h * 0.1)}, ${num(x + w * 0.7)} ${num(y + h * 0.1)}, ${num(x + w * 0.95)} ${num(y + h * 0.45)}`;
            const head = `M ${num(x + w * 0.78)} ${num(y + h * 0.42)} L ${num(x + w * 0.96)} ${num(y + h * 0.47)} L ${num(x + w * 0.9)} ${num(y + h * 0.26)}`;
            return `<g fill="none" stroke="${c}" stroke-width="${num(Math.max(4, w * 0.035))}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"${rot}><path d="${p}"/><path d="${head}"/></g>`;
        }
        case 'bignum': {
            if (!ctx.slideNumber) return '';
            const size = h;
            return `<text x="${num(cx)}" y="${num(cy + size * 0.35)}" text-anchor="middle" font-family="${esc(ctx.pair.display.stack)}" font-weight="${ctx.pair.displayWeight}" font-size="${num(size)}" letter-spacing="-0.04em" fill="${c}" opacity="${Math.min(op, 0.22)}"${rot}>${pad2(ctx.slideNumber)}</text>`;
        }
        default:
            return '';
    }
};

const renderBackground = (bg: SlideBackground | undefined, ctx: Ctx, uid: string): { defs: string; svg: string; base: string } => {
    const kind = bg?.kind || 'solid';
    const base = color(ctx, bg?.color || 'bg');
    const W = ctx.W, H = ctx.H;
    if (kind === 'gradient') {
        const c2 = color(ctx, bg?.color2 || 'surface2');
        const a = ((bg?.angle ?? 160) * Math.PI) / 180;
        const x2 = 50 + Math.cos(a) * 50, y2 = 50 + Math.sin(a) * 50;
        const defs = `<linearGradient id="cvGrad-${uid}" x1="${num(100 - x2)}%" y1="${num(100 - y2)}%" x2="${num(x2)}%" y2="${num(y2)}%"><stop offset="0%" stop-color="${base}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
        return { defs, svg: `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#cvGrad-${uid})"/>`, base };
    }
    if (kind === 'spot') {
        const c2 = color(ctx, bg?.color2 || 'accent');
        const a = ((bg?.angle ?? 315) * Math.PI) / 180;
        const cx = 50 + Math.cos(a) * 45, cy = 50 + Math.sin(a) * 45;
        const defs = `<radialGradient id="cvSpot-${uid}" cx="${num(cx)}%" cy="${num(cy)}%" r="70%"><stop offset="0%" stop-color="${c2}" stop-opacity="0.38"/><stop offset="100%" stop-color="${c2}" stop-opacity="0"/></radialGradient>`;
        return { defs, svg: `<rect x="0" y="0" width="${W}" height="${H}" fill="${base}"/><rect x="0" y="0" width="${W}" height="${H}" fill="url(#cvSpot-${uid})"/>`, base };
    }
    if (kind === 'frame') {
        const inset = 34 * ctx.scale;
        const c2 = color(ctx, bg?.color2 || 'line');
        return { defs: '', svg: `<rect x="0" y="0" width="${W}" height="${H}" fill="${base}"/><rect x="${num(inset)}" y="${num(inset)}" width="${num(W - inset * 2)}" height="${num(H - inset * 2)}" fill="none" stroke="${c2}" stroke-width="${num(3 * ctx.scale)}" rx="${radius(ctx, 'theme')}"/>`, base };
    }
    return { defs: '', svg: `<rect x="0" y="0" width="${W}" height="${H}" fill="${base}"/>`, base };
};

// ── entry point ────────────────────────────────────────────────────────────

/** A decoration's box in canvas units (same math as renderDecor). */
const decorBox = (d: Decor, W: number, H: number) => {
    const cx = (Math.max(-20, Math.min(120, d.x)) / 100) * W;
    const cy = (Math.max(-20, Math.min(120, d.y)) / 100) * H;
    const w = (Math.max(1, Math.min(160, d.w)) / 100) * W;
    const h = (Math.max(1, Math.min(160, d.h ?? d.w)) / 100) * W;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
};

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, margin = 0) =>
    a.x < b.x + b.w + margin && a.x + a.w > b.x - margin && a.y < b.y + b.h + margin && a.y + a.h > b.y - margin;

/** Signature card footprint (see utils/signatureCardGenerator.ts). */
const SIGNATURE_RESERVE = { portrait: { top: 236, bottom: 250 }, square: { top: 196, bottom: 236 } } as const;

export const renderCanvas = (design: SlideDesign, content: CanvasContent, opts: CanvasRenderOptions = {}): CanvasRender => {
    const fmt = opts.format === 'square' ? 'square' : 'portrait';
    const geo = CANVAS[fmt];
    const pal = resolvePalette(opts.theme);
    const style = design.style;
    const pair = FONT_PAIRS[style.fonts] || FONT_PAIRS.modern;
    const scale = fmt === 'square' ? 0.9 : 1;
    const dens = densityFactor(style.density);
    const basePad = Math.round(geo.pad * (style.density === 'airy' ? 1.1 : style.density === 'dense' ? 0.85 : 1));
    const pad = { t: basePad, r: basePad, b: basePad, l: basePad };
    const reserve = SIGNATURE_RESERVE[fmt];
    if (opts.signature === 'top-left' || opts.signature === 'top-right') pad.t = Math.max(pad.t, reserve.top);
    if (opts.signature === 'bottom-left') pad.b = Math.max(pad.b, reserve.bottom);
    const uid = (opts.scopeId || 'cv').replace(/[^\w-]/g, '');

    const ctx: Ctx = {
        pal, pair, style, W: geo.w, H: geo.h, scale, dens, pad, content,
        editable: opts.editable !== false,
        slideNumber: opts.slideNumber || 0,
        totalSlides: opts.totalSlides || 0,
        under: pal.bg,
        underRole: 'bg',
        parentDir: 'col',
        depth: 0,
    };

    const rootNode = design.root && design.root.type === 'stack' ? design.root : undefined;
    const bgSpec: SlideBackground = { ...(design.bg || { kind: 'solid' }) };
    if (rootNode?.fill && !design.bg?.color) bgSpec.color = rootNode.fill;
    const bg = renderBackground(bgSpec, ctx, uid);
    ctx.under = bg.base;
    ctx.underRole = bgSpec.color || 'bg';

    // Keep the signature card readable: small decorations under it are dropped,
    // large ones fade to a whisper.
    const sigRect = opts.signature ? signatureRect(opts.signature, fmt, 'template-5') : null;
    const decor = (design.decor || []).slice(0, 8).flatMap((d) => {
        if (!sigRect || !overlaps(decorBox(d, geo.w, geo.h), sigRect, 12)) return [d];
        if (d.w <= 22 && d.shape !== 'bignum') return [];
        return [{ ...d, opacity: Math.min(d.opacity ?? 0.18, 0.1) }];
    });
    const back = decor.filter((d) => !d.front).map((d, i) => renderDecor(d, ctx, i)).join('');
    const front = decor.filter((d) => d.front).map((d, i) => renderDecor(d, ctx, i + 3)).join('');

    const root: StackNode = rootNode || { type: 'stack', children: [] };
    const rs = stackStyle(root, ctx, true);
    const rootCtx: Ctx = { ...ctx, under: rs.under, underRole: rs.underRole, parentDir: root.dir === 'row' ? 'row' : 'col', depth: 1 };
    const body = renderChildren(root.children, rootCtx);

    // What the signature card sits on: a full-bleed band at that edge, or the background.
    let sigUnder = bg.base;
    if (opts.signature) {
        const atTop = opts.signature.startsWith('top');
        const band = (root.children || []).find((k): k is StackNode =>
            !!k && k.type === 'stack' && !!k.bleed && (k.bleed === 'all' || k.bleed === (atTop ? 'top' : 'bottom')) && !!(k.fill || k.gradient));
        if (band) sigUnder = color(ctx, band.fill || band.gradient![atTop ? 0 : 1]);
    }
    const sigName = ensureContrast(bestOn(sigUnder, [pal.ink, pal.onAccent, pal.bg, '#FFFFFF', '#0B0B0F']), sigUnder, 4.5);
    const sigTitle = ensureContrast(mix(sigName, sigUnder, 0.3), sigUnder, 4.5);

    const html = `<div xmlns="http://www.w3.org/1999/xhtml" data-canvas-frame="true" style="position:relative;width:${geo.w}px;height:${geo.h}px;overflow:hidden;font-family:${pair.body.stack};">`
        + `<div data-canvas-root="true" style="position:absolute;left:0;top:0;width:${geo.w}px;height:${geo.h}px;box-sizing:border-box;padding:${pad.t}px ${pad.r}px ${pad.b}px ${pad.l}px;overflow:hidden;--fit:1;${rs.style}">${body}</div>`
        + (front ? `<svg aria-hidden="true" ${svgBox(geo.w, geo.h, 'position:absolute;left:0;top:0;pointer-events:none;')} viewBox="0 0 ${geo.w} ${geo.h}">${front}</svg>` : '')
        + `</div>`;

    return {
        width: geo.w,
        height: geo.h,
        palette: pal,
        fontImport: fontImportUrl(pair),
        defs: bg.defs,
        background: bg.svg,
        decor: back,
        bodyFamily: pair.body.family,
        signatureColors: { name: sigName, title: sigTitle },
        html,
    };
};
