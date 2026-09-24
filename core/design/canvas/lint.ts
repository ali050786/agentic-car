/**
 * Canvas lint: makes any slide design safe to render.
 *
 * Designs come from three places: the layout library (always valid), the AI
 * composer (usually valid, sometimes creative in the wrong ways) and storage
 * (valid when saved, but the slide's words may have changed since). This file
 *
 *   - sanitizeDesign(): coerces every node and prop to the Canvas language,
 *     drops what can't render (a chart without a percentage, an image without
 *     a doodle, unknown icons), removes duplicate fields and caps tree size;
 *   - ensureCoverage(): guarantees every piece of the slide's text is shown
 *     exactly once, inserting sensible nodes for anything the design misses;
 *   - estimateFill(): a text-metrics estimate of how much of the slide the
 *     design needs at full size (> 1 means the browser fitter will shrink it),
 *     so layouts that would need heavy shrinking are rejected up front.
 */

import * as lucide from 'lucide-static';
import type {
    Align, CanvasContent, ColorRole, Decor, DesignStyle, FieldRef, GridNode, Justify, ListNode, SceneNode,
    SlideBackground, SlideDesign, Space, StackNode, TextNode,
} from './types';
import { COLOR_ROLES, CONTENT_FIELDS, DECOR_SHAPES, DIRECTIONS, LIST_LOOKS, MARK_STYLES, SPACES, TEXT_ROLES, WIDTHS } from './types';
import { firstNumber, readField, splitKey } from './render';
import { CANVAS, FONT_PAIRS, FONT_PAIR_IDS, ROLE_SPECS, densityFactor, sizeStep, defaultStyle } from './tokens';

// ── small coercers ─────────────────────────────────────────────────────────

const oneOf = <T,>(v: unknown, allowed: readonly T[]): T | undefined =>
    (allowed as readonly unknown[]).includes(v) ? (v as T) : undefined;

const num = (v: unknown): number | undefined => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : undefined;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const snap = <T extends number>(v: unknown, allowed: readonly T[]): T | undefined => {
    const n = num(v);
    if (n === undefined) return undefined;
    return allowed.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), allowed[0]);
};

const space = (v: unknown): Space | undefined => snap(v, SPACES);
const stepOf = (v: unknown): number | undefined => {
    const n = num(v);
    return n === undefined ? undefined : clamp(Math.round(n), -3, 3);
};
const role = (v: unknown): ColorRole | undefined => oneOf(v, COLOR_ROLES);
const flag = (v: unknown): true | undefined => (v === true || v === 'true' ? true : undefined);

const ALIGNS: Align[] = ['start', 'center', 'end', 'stretch'];
const JUSTIFIES: Justify[] = ['start', 'center', 'end', 'between', 'around'];
const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
const RADII = ['none', 'sm', 'md', 'lg', 'pill', 'theme'] as const;
const WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

const isIcon = (name: unknown): name is string =>
    typeof name === 'string' && /^[A-Z][A-Za-z0-9]{1,40}$/.test(name) && typeof (lucide as any)[name] === 'string';

const EXTRA_KEY = /^[a-z][a-zA-Z0-9]{0,15}$/;

/** Clean extras: short single-line labels under simple keys. */
export const sanitizeExtras = (raw: unknown, maxLen = 28, max = 3): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (Object.keys(out).length >= max) break;
        if (!EXTRA_KEY.test(k) || typeof v !== 'string') continue;
        const t = v.replace(/\s+/g, ' ').replace(/[<>]/g, '').trim();
        if (!t || t.length > maxLen) continue;
        out[k] = t;
    }
    return out;
};

// ── sanitize ───────────────────────────────────────────────────────────────

const MAX_NODES = 48;
const MAX_DEPTH = 7;

interface LintState {
    content: CanvasContent;
    problems: string[];
    nodes: number;
    used: Set<string>;
    counts: Record<string, number>;
}

const fieldRef = (v: unknown, st: LintState): FieldRef | undefined => {
    if (typeof v !== 'string') return undefined;
    if ((CONTENT_FIELDS as string[]).includes(v)) return v as FieldRef;
    if (v.startsWith('x.') && EXTRA_KEY.test(v.slice(2)) && st.content.extras?.[v.slice(2)]) return v as FieldRef;
    return undefined;
};

/** Registers a field display; false when it's already shown (the duplicate is dropped). */
const claim = (st: LintState, key: string): boolean => {
    if (st.used.has(key)) {
        st.problems.push(`duplicate ${key}`);
        return false;
    }
    st.used.add(key);
    return true;
};

const bump = (st: LintState, kind: string, max: number): boolean => {
    st.counts[kind] = (st.counts[kind] || 0) + 1;
    if (st.counts[kind] > max) {
        st.problems.push(`too many ${kind}`);
        return false;
    }
    return true;
};

const isPercentStat = (c: CanvasContent) => {
    const raw = c.statNumber || '';
    const n = firstNumber(raw);
    return n !== null && /%/.test(raw) && n >= 0 && n <= 100;
};

const numericItems = (c: CanvasContent) => (c.listItems || []).filter((it) => firstNumber(it) !== null).length;

const sanitizeNode = (raw: any, depth: number, st: LintState): SceneNode | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (st.nodes >= MAX_NODES) {
        st.problems.push('node budget');
        return null;
    }
    const c = st.content;
    switch (raw.type) {
        case 'stack': {
            if (depth >= MAX_DEPTH) {
                st.problems.push('too deep');
                return null;
            }
            st.nodes++;
            const node: StackNode = { type: 'stack', children: [] };
            const dir = raw.dir === 'row' ? 'row' : raw.dir === 'col' || raw.dir === 'column' ? 'col' : undefined;
            if (dir) node.dir = dir;
            for (const k of ['gap', 'pad', 'padX', 'padY'] as const) { const v = space(raw[k]); if (v !== undefined) node[k] = v; }
            const align = oneOf(raw.align, ALIGNS); if (align) node.align = align;
            const justify = oneOf(raw.justify, JUSTIFIES); if (justify) node.justify = justify;
            const fill = role(raw.fill); if (fill) node.fill = fill;
            if (Array.isArray(raw.gradient) && raw.gradient.length === 2 && role(raw.gradient[0]) && role(raw.gradient[1])) node.gradient = [raw.gradient[0], raw.gradient[1]];
            const radius = oneOf(raw.radius, RADII); if (radius) node.radius = radius;
            const border = role(raw.border); if (border) node.border = border;
            const bw = snap(raw.borderW, [1, 2, 3, 4, 6] as const); if (bw && node.border) node.borderW = bw;
            const width = oneOf(raw.width, WIDTHS); if (width) node.width = width;
            const basis = num(raw.basis); if (basis !== undefined && basis > 0) node.basis = clamp(basis, 0.15, 0.85);
            if (flag(raw.grow)) node.grow = true;
            const bleed = oneOf(raw.bleed, ['top', 'bottom', 'x', 'all'] as const);
            if (bleed && depth === 1) node.bleed = bleed;
            const shadow = oneOf(raw.shadow, ['none', 'soft', 'hard'] as const); if (shadow && shadow !== 'none') node.shadow = shadow;
            const rot = num(raw.rotate); if (rot) node.rotate = clamp(Math.round(rot), -8, 8);
            if (flag(raw.wrap)) node.wrap = true;
            const kids = Array.isArray(raw.children) ? raw.children : [];
            node.children = kids.map((k: any) => sanitizeNode(k, depth + 1, st)).filter(Boolean) as SceneNode[];
            const hasContent = node.children.some((k) => k.type !== 'spacer');
            if (!hasContent && depth > 0 && !node.fill && !node.gradient && !node.border) return null;
            return node;
        }
        case 'grid': {
            if (depth >= MAX_DEPTH) return null;
            st.nodes++;
            const node: GridNode = { type: 'grid', cols: snap(raw.cols, [2, 3] as const) || 2, children: [] };
            const gap = space(raw.gap); if (gap !== undefined) node.gap = gap;
            node.children = (Array.isArray(raw.children) ? raw.children : []).map((k: any) => sanitizeNode(k, depth + 1, st)).filter(Boolean) as SceneNode[];
            return node.children.length ? node : null;
        }
        case 'text': {
            const field = fieldRef(raw.field, st);
            if (!field) return null;
            const text = readField(c, field);
            if (!text) return null;
            let part = oneOf(raw.part, ['key', 'value'] as const);
            if (part && !splitKey(text).key) {
                if (part === 'key') return null; // nothing to show
                part = undefined; // "value" of an unkeyed text is the whole text
            }
            if (!claim(st, `${field}:${part || ''}`)) return null;
            if (!part && (st.used.has(`${field}:key`) || st.used.has(`${field}:value`))) {
                st.problems.push(`duplicate ${field}`);
                return null;
            }
            st.nodes++;
            const node: TextNode = { type: 'text', field, role: oneOf(raw.role, TEXT_ROLES) || (field === 'headline' ? 'title' : 'body') };
            const size = stepOf(raw.size); if (size) node.size = size;
            const color = role(raw.color); if (color) node.color = color;
            const align = oneOf(raw.align, TEXT_ALIGNS); if (align) node.align = align;
            const weight = snap(raw.weight, WEIGHTS); if (raw.weight !== undefined && weight) node.weight = weight;
            if (flag(raw.italic)) node.italic = true;
            if (raw.upper === true || raw.upper === false) node.upper = raw.upper;
            const font = oneOf(raw.font, ['display', 'body', 'mono'] as const); if (font) node.font = font;
            if (part) node.part = part;
            const mark = oneOf(raw.mark, MARK_STYLES); if (mark && field === 'headline') node.mark = mark;
            const maxWidth = oneOf(raw.maxWidth, WIDTHS); if (maxWidth) node.maxWidth = maxWidth;
            const tracking = oneOf(raw.tracking, ['tight', 'normal', 'wide'] as const); if (tracking && tracking !== 'normal') node.tracking = tracking;
            return node;
        }
        case 'number': {
            const field = fieldRef(raw.field ?? 'statNumber', st);
            if (!field || !readField(c, field)) return null;
            if (!claim(st, `${field}:`)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'number', field };
            const size = stepOf(raw.size); if (size) node.size = size;
            const color = role(raw.color); if (color) node.color = color;
            if (flag(raw.outline)) node.outline = true;
            const align = oneOf(raw.align, TEXT_ALIGNS); if (align) node.align = align;
            return node;
        }
        case 'list': {
            if (!(c.listItems || []).length) return null;
            if (!claim(st, 'listItems')) return null;
            st.nodes++;
            const node: ListNode = { type: 'list', look: oneOf(raw.look, LIST_LOOKS) || 'numbers' };
            const cols = snap(raw.cols, [1, 2, 3] as const); if (cols && cols > 1) node.cols = cols;
            const gap = space(raw.gap); if (gap !== undefined) node.gap = gap;
            const size = stepOf(raw.size); if (size) node.size = size;
            for (const k of ['marker', 'fill', 'color'] as const) { const v = role(raw[k]); if (v) node[k] = v; }
            return node;
        }
        case 'chart': {
            let kind = oneOf(raw.kind, ['ring', 'progress', 'bars'] as const);
            if (!kind) return null;
            if (!bump(st, 'chart', 1)) return null;
            if (kind === 'bars') {
                if (numericItems(c) < 2 || !claim(st, 'listItems')) return null;
            } else {
                if (!isPercentStat(c)) return null;
                // A ring shows the number inside it; if the number is already shown, draw a bar instead.
                if (kind === 'ring' && !claim(st, 'statNumber:')) kind = 'progress';
            }
            st.nodes++;
            const node: SceneNode = { type: 'chart', kind };
            const color = role(raw.color); if (color) node.color = color;
            const track = role(raw.track); if (track) node.track = track;
            const size = oneOf(raw.size, ['s', 'm', 'l'] as const); if (size) node.size = size;
            return node;
        }
        case 'icon': {
            const name = isIcon(raw.name) ? raw.name : isIcon(c.icon) ? c.icon : undefined;
            if (!name || !bump(st, 'icon', 3)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'icon', name };
            const size = oneOf(raw.size, ['s', 'm', 'l', 'xl'] as const); if (size) node.size = size;
            const color = role(raw.color); if (color) node.color = color;
            const tile = role(raw.tile); if (tile) node.tile = tile;
            const shape = oneOf(raw.shape, ['circle', 'square', 'none'] as const); if (shape) node.shape = shape;
            return node;
        }
        case 'image': {
            if (!c.doodleUrl || !bump(st, 'image', 1)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'image', src: 'doodle' };
            const size = oneOf(raw.size, ['s', 'm', 'l'] as const); if (size) node.size = size;
            const mask = oneOf(raw.mask, ['none', 'circle', 'rounded', 'arch'] as const); if (mask) node.mask = mask;
            const frame = role(raw.frame); if (frame) node.frame = frame;
            return node;
        }
        case 'rule': {
            if (!bump(st, 'rule', 6)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'rule' };
            const color = role(raw.color); if (color) node.color = color;
            const width = raw.width === 'short' ? 'short' : oneOf(raw.width, WIDTHS); if (width) node.width = width;
            const thick = snap(raw.thick, [1, 2, 4, 6, 8, 12] as const); if (raw.thick !== undefined && thick) node.thick = thick;
            if (flag(raw.vertical)) node.vertical = true;
            return node;
        }
        case 'badge': {
            const field = fieldRef(raw.field, st);
            if (!field || !readField(c, field)) return null;
            if (!claim(st, `${field}:`)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'badge', field };
            const fill = role(raw.fill); if (fill) node.fill = fill;
            const color = role(raw.color); if (color) node.color = color;
            if (flag(raw.outline)) node.outline = true;
            const size = oneOf(raw.size, ['s', 'button'] as const); if (size) node.size = size;
            const align = oneOf(raw.align, ['start', 'center', 'end'] as const); if (align) node.align = align;
            return node;
        }
        case 'meta': {
            const kind = oneOf(raw.kind, ['page', 'pageOfTotal', 'swipe', 'progress'] as const);
            if (!kind || !claim(st, `meta:${kind === 'pageOfTotal' ? 'page' : kind}`)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'meta', kind };
            const color = role(raw.color); if (color) node.color = color;
            const align = oneOf(raw.align, TEXT_ALIGNS); if (align) node.align = align;
            return node;
        }
        case 'spacer': {
            if (!bump(st, 'spacer', 12)) return null;
            st.nodes++;
            if (flag(raw.grow)) return { type: 'spacer', grow: true };
            return { type: 'spacer', size: space(raw.size) ?? 24 };
        }
        case 'quotemark': {
            if (!bump(st, 'quotemark', 1)) return null;
            st.nodes++;
            const node: SceneNode = { type: 'quotemark' };
            const color = role(raw.color); if (color) node.color = color;
            const size = oneOf(raw.size, ['s', 'm', 'l'] as const); if (size) node.size = size;
            return node;
        }
        default:
            if (raw.type !== undefined) st.problems.push(`unknown node ${String(raw.type).slice(0, 20)}`);
            return null;
    }
};

const sanitizeBackground = (raw: any): SlideBackground => {
    if (!raw || typeof raw !== 'object') return { kind: 'solid' };
    const bg: SlideBackground = { kind: oneOf(raw.kind, ['solid', 'gradient', 'spot', 'frame'] as const) || 'solid' };
    const c1 = role(raw.color); if (c1) bg.color = c1;
    const c2 = role(raw.color2); if (c2) bg.color2 = c2;
    const angle = num(raw.angle); if (angle !== undefined) bg.angle = ((Math.round(angle) % 360) + 360) % 360;
    return bg;
};

export const sanitizeDecor = (raw: unknown, max = 6): Decor[] => {
    if (!Array.isArray(raw)) return [];
    const out: Decor[] = [];
    for (const d of raw) {
        if (out.length >= max) break;
        if (!d || typeof d !== 'object') continue;
        const shape = oneOf((d as any).shape, DECOR_SHAPES);
        const color = role((d as any).color) || 'accent';
        const x = num((d as any).x), y = num((d as any).y), w = num((d as any).w);
        if (!shape || x === undefined || y === undefined || w === undefined) continue;
        const item: Decor = { shape, x: clamp(x, -20, 120), y: clamp(y, -20, 120), w: clamp(w, 1, 160), color };
        const h = num((d as any).h); if (h !== undefined) item.h = clamp(h, 1, 160);
        const op = num((d as any).opacity); if (op !== undefined) item.opacity = clamp(op, 0.03, 1);
        const rot = num((d as any).rotate); if (rot) item.rotate = clamp(Math.round(rot), -180, 180);
        if (flag((d as any).outline)) item.outline = true;
        if (flag((d as any).front) && item.w <= 12) item.front = true;
        out.push(item);
    }
    return out;
};

export const sanitizeStyle = (raw: any, fallback: DesignStyle = defaultStyle()): DesignStyle => {
    if (!raw || typeof raw !== 'object') return fallback;
    return {
        direction: oneOf(raw.direction, DIRECTIONS) || fallback.direction,
        fonts: oneOf(raw.fonts, FONT_PAIR_IDS) || fallback.fonts,
        radius: oneOf(raw.radius, ['none', 'sm', 'md', 'lg'] as const) || fallback.radius,
        headingCase: oneOf(raw.headingCase, ['none', 'upper'] as const) || fallback.headingCase,
        density: oneOf(raw.density, ['airy', 'normal', 'dense'] as const) || fallback.density,
        mark: oneOf(raw.mark, MARK_STYLES) || fallback.mark,
    };
};

// ── coverage ───────────────────────────────────────────────────────────────

type Path = { parent: StackNode | GridNode; index: number };

const walk = (node: SceneNode, fn: (n: SceneNode, parent: StackNode | GridNode | null, index: number) => void, parent: StackNode | GridNode | null = null, index = 0) => {
    fn(node, parent, index);
    if (node.type === 'stack' || node.type === 'grid') node.children.forEach((k, i) => walk(k, fn, node, i));
};

const findNode = (root: StackNode, pred: (n: SceneNode) => boolean): Path | null => {
    let hit: Path | null = null;
    walk(root, (n, parent, index) => {
        if (!hit && parent && pred(n)) hit = { parent, index };
    });
    return hit;
};

const shows = (n: SceneNode, field: string) =>
    (n.type === 'text' || n.type === 'number' || n.type === 'badge') && n.field === field;

/** Fields the renderer can show that this slide actually has text for. */
const presentFields = (c: CanvasContent) => ({
    preHeader: !!(c.preHeader || '').trim(),
    headline: !!(c.headline || '').trim(),
    body: !!(c.body || '').trim(),
    statNumber: !!(c.statNumber || '').trim(),
    statLabel: !!(c.statLabel || '').trim(),
    quoteAuthor: !!(c.quoteAuthor || '').trim(),
    splitLeft: !!(c.splitLeft || '').trim(),
    splitRight: !!(c.splitRight || '').trim(),
    footer: !!(c.footer || '').trim(),
    listItems: (c.listItems || []).some((s) => (s || '').trim()),
});

const insertAt = (p: Path, node: SceneNode, after: boolean) => p.parent.children.splice(p.index + (after ? 1 : 0), 0, node);

/** Appends near the end of the root, before a trailing meta row / swipe / bottom band. */
const appendToRoot = (root: StackNode, node: SceneNode) => {
    let i = root.children.length;
    while (i > 0) {
        const k = root.children[i - 1];
        const trailing = k.type === 'meta' || k.type === 'spacer' || (k.type === 'stack' && (k.bleed === 'bottom' || k.children.every((x) => x.type === 'meta' || x.type === 'badge')));
        if (!trailing) break;
        i--;
    }
    root.children.splice(i, 0, node);
};

/**
 * Makes sure every field with text is shown exactly once, inserting nodes
 * for anything missing. Returns the names of the fields it had to add.
 * Mutates `root`.
 */
export const ensureCoverage = (root: StackNode, c: CanvasContent, blockType: string): string[] => {
    const added: string[] = [];
    const have = presentFields(c);
    const has = (field: string) => !!findNode(root, (n) => shows(n, field) && !(n.type === 'text' && n.part === 'key'));
    const hasList = () => !!findNode(root, (n) => n.type === 'list' || (n.type === 'chart' && n.kind === 'bars'));
    const hasRing = () => !!findNode(root, (n) => n.type === 'chart' && n.kind === 'ring');
    const headlineAt = () => findNode(root, (n) => shows(n, 'headline'));

    if (have.headline && !has('headline')) {
        const first = root.children[0];
        const node: TextNode = { type: 'text', field: 'headline', role: blockType === 'quote' ? 'quote' : 'title' };
        if (first && first.type === 'stack' && first.bleed === 'top') first.children.push(node);
        else root.children.splice(root.children[0]?.type === 'stack' && root.children[0].dir === 'row' ? 1 : 0, 0, node);
        added.push('headline');
    }
    if (have.preHeader && !has('preHeader')) {
        const h = headlineAt();
        const node: TextNode = { type: 'text', field: 'preHeader', role: 'kicker' };
        if (h) insertAt(h, node, false);
        else root.children.unshift(node);
        added.push('preHeader');
    }
    if (have.statNumber && !has('statNumber') && !hasRing()) {
        const h = headlineAt();
        const node: SceneNode = { type: 'number', field: 'statNumber' };
        if (h) insertAt(h, node, true);
        else appendToRoot(root, node);
        added.push('statNumber');
    }
    if (have.statLabel && !has('statLabel')) {
        const n = findNode(root, (x) => shows(x, 'statNumber') || (x.type === 'chart' && x.kind !== 'bars')) || headlineAt();
        const node: TextNode = { type: 'text', field: 'statLabel', role: 'subtitle', size: -1 };
        if (n) insertAt(n, node, true);
        else appendToRoot(root, node);
        added.push('statLabel');
    }
    if (have.body && !has('body')) {
        const h = headlineAt();
        const node: TextNode = { type: 'text', field: 'body', role: 'body' };
        // Don't drop body copy into a colored band sized for the headline.
        if (h && !(h.parent.type === 'stack' && h.parent.bleed)) insertAt(h, node, true);
        else appendToRoot(root, node);
        added.push('body');
    }
    if (have.quoteAuthor && !has('quoteAuthor')) {
        const h = headlineAt();
        const node: TextNode = { type: 'text', field: 'quoteAuthor', role: 'label', color: 'accent' };
        if (h) insertAt(h, node, true);
        else appendToRoot(root, node);
        added.push('quoteAuthor');
    }
    if (have.listItems && !hasList()) {
        appendToRoot(root, { type: 'list', look: 'numbers' });
        added.push('listItems');
    }
    // Split sides: a missing side gets a panel; a shown value whose key is missing gets its label back.
    const splitPanel = (field: 'splitLeft' | 'splitRight'): StackNode => ({
        type: 'stack', dir: 'col', fill: field === 'splitRight' ? 'accent' : 'surface', pad: 40, gap: 16, grow: true,
        children: [
            { type: 'text', field, role: 'label', part: 'key', color: field === 'splitRight' ? 'onAccent' : 'inkSoft' },
            { type: 'text', field, role: 'subtitle', part: 'value', size: -2, color: field === 'splitRight' ? 'onAccent' : undefined },
        ],
    });
    const missingSides = (['splitLeft', 'splitRight'] as const).filter((f) => have[f] && !has(f));
    if (missingSides.length === 2) {
        appendToRoot(root, { type: 'stack', dir: 'row', gap: 24, align: 'stretch', children: missingSides.map(splitPanel) });
        added.push(...missingSides);
    } else if (missingSides.length === 1) {
        const other = missingSides[0] === 'splitLeft' ? 'splitRight' : 'splitLeft';
        const o = findNode(root, (n) => n.type === 'stack' && n.children.some((k) => shows(k, other)));
        const panel = splitPanel(missingSides[0]);
        if (o) insertAt(o, panel, missingSides[0] === 'splitRight');
        else appendToRoot(root, panel);
        added.push(missingSides[0]);
    }
    for (const f of ['splitLeft', 'splitRight'] as const) {
        if (!have[f] || !splitKey(c[f] || '').key) continue;
        const keyShown = !!findNode(root, (n) => n.type === 'text' && n.field === f && (n.part === 'key' || !n.part));
        const val = findNode(root, (n) => n.type === 'text' && n.field === f && n.part === 'value');
        if (!keyShown && val) {
            insertAt(val, { type: 'text', field: f, role: 'label', part: 'key' }, false);
            added.push(`${f}.key`);
        }
    }
    if (have.footer && !has('footer')) {
        appendToRoot(root, blockType === 'closing' ? { type: 'badge', field: 'footer', size: 'button' } : { type: 'text', field: 'footer', role: 'small' });
        added.push('footer');
    }
    return added;
};

// ── the entry point ────────────────────────────────────────────────────────

export interface LintResult {
    design: SlideDesign;
    /** What had to be repaired or dropped (for traces and tests). */
    problems: string[];
    /** Fields the coverage pass had to insert. */
    added: string[];
    /** The input was unusable (no tree at all). */
    fatal: boolean;
}

/**
 * Validates and repairs a design for the given slide content. `style` is the
 * deck's style (a composed slide never changes it); `archetype`/`seed` are
 * carried over for shuffling.
 */
export const lintDesign = (
    raw: any,
    content: CanvasContent,
    opts: { blockType?: string; style: DesignStyle; archetype?: string; seed?: number; invert?: 'accent' | 'ink' },
): LintResult => {
    const problems: string[] = [];
    const st: LintState = { content, problems, nodes: 0, used: new Set(), counts: {} };
    const blockType = opts.blockType || content.blockType || 'body';
    let rootRaw = raw && typeof raw === 'object' ? raw.root : undefined;
    const fatal = !rootRaw || typeof rootRaw !== 'object';
    if (!fatal && rootRaw.type !== 'stack') rootRaw = { type: 'stack', dir: 'col', children: [rootRaw] };
    const sanitized = !fatal ? (sanitizeNode(rootRaw, 0, st) as StackNode | null) : null;
    const root: StackNode = sanitized && sanitized.type === 'stack' ? sanitized : { type: 'stack', dir: 'col', children: [] };
    // The root is the slide: sizing props mean nothing there.
    delete root.basis; delete root.grow; delete root.width; delete root.bleed; delete root.rotate; delete root.shadow;
    const added = ensureCoverage(root, content, blockType);
    const design: SlideDesign = {
        v: 1,
        style: opts.style,
        bg: opts.invert ? { kind: 'solid', color: opts.invert } : sanitizeBackground(raw?.bg),
        root,
        decor: sanitizeDecor(raw?.decor),
        ...(opts.archetype ? { archetype: opts.archetype } : {}),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        ...(opts.invert ? { invert: opts.invert } : {}),
    };
    return { design, problems, added, fatal };
};

// ── layout estimate ────────────────────────────────────────────────────────

const WIDTH_FRAC: Record<string, number> = { full: 1, '1/4': 0.25, '1/3': 0.3333, '2/5': 0.4, '1/2': 0.5, '3/5': 0.6, '2/3': 0.6667, '3/4': 0.75 };

interface EstCtx {
    c: CanvasContent;
    style: DesignStyle;
    scale: number;
    dens: number;
    availH: number;
    /** Worst local overflow (e.g. a band too small for its text). */
    worst: number;
}

const pairOf = (e: EstCtx) => FONT_PAIRS[e.style.fonts] || FONT_PAIRS.modern;

/** Height of a block of text wrapped at `width`. */
const textHeight = (chars: number, px: number, cw: number, leading: number, width: number, upper = false) => {
    if (chars <= 0) return 0;
    const perLine = Math.max(1, Math.floor(width / (px * cw * (upper ? 1.12 : 1))));
    const lines = Math.ceil((chars / perLine) * 1.07);
    return Math.max(1, lines) * px * leading;
};

const spaceOf = (e: EstCtx, v?: number) => (v ?? 0) * e.dens * e.scale;

const measure = (n: SceneNode, width: number, e: EstCtx, dirOfParent: 'col' | 'row' | 'grid'): number => {
    const pair = pairOf(e);
    switch (n.type) {
        case 'text': {
            const text = readField(e.c, n.field);
            const shown = n.part ? (n.part === 'key' ? splitKey(text).key : splitKey(text).value) : text;
            const spec = ROLE_SPECS[n.role] || ROLE_SPECS.body;
            const px = spec.px * sizeStep(n.size ?? 0) * e.scale;
            const font = n.font || spec.font;
            const face = font === 'display' ? pair.display : font === 'mono' ? pair.mono : pair.body;
            const display = n.role === 'display' || n.role === 'title' || n.role === 'number';
            const upper = n.upper ?? (spec.upper || (display && (e.style.headingCase === 'upper' || !!pair.displayUpper)));
            const leading = display && font === 'display' ? Math.max(spec.leading, pair.displayLeading) : spec.leading;
            const w = n.maxWidth && WIDTH_FRAC[n.maxWidth] ? width * WIDTH_FRAC[n.maxWidth] : width;
            return textHeight(shown.length, px, face.cw, leading, w, upper);
        }
        case 'number': {
            const px = ROLE_SPECS.number.px * sizeStep(n.size ?? 0) * e.scale;
            const text = readField(e.c, n.field);
            // Numbers don't wrap: a too-wide number forces the whole slide down.
            const need = text.length * px * pair.display.cw * 0.95;
            if (need > width) e.worst = Math.max(e.worst, need / width);
            return px * 1.0;
        }
        case 'quotemark':
            return ({ s: 120, m: 190, l: 280 } as const)[n.size || 'm'] * e.scale * 0.5;
        case 'badge': {
            const button = n.size === 'button';
            return ((button ? 34 : ROLE_SPECS.label.px) * 1.2 + (button ? 52 : 20)) * e.scale;
        }
        case 'rule':
            return n.vertical ? 0 : (n.thick ?? 4) * e.scale;
        case 'meta':
            return n.kind === 'progress' ? 6 * e.scale : 30 * e.scale;
        case 'icon': {
            const px = ({ s: 44, m: 64, l: 96, xl: 140 } as const)[n.size || 'm'] * e.scale;
            return n.tile ? px * 1.8 : px;
        }
        case 'image': {
            const w = ({ s: 240, m: 330, l: 440 } as const)[n.size || 'm'] * e.scale;
            return n.mask === 'circle' ? w : w * 1.5 + 28 * e.scale;
        }
        case 'chart': {
            if (n.kind === 'progress') return 26 * e.scale;
            if (n.kind === 'ring') return ({ s: 300, m: 420, l: 540 } as const)[n.size || 'm'] * e.scale;
            const items = (e.c.listItems || []).filter((s) => firstNumber(s) !== null).length;
            return items * (ROLE_SPECS.small.px * 1.3 + 10 + 30) * e.scale + Math.max(0, items - 1) * 28 * e.scale;
        }
        case 'spacer':
            return n.grow ? 0 : spaceOf(e, n.size ?? 24);
        case 'list':
            return measureList(n, width, e);
        case 'grid': {
            const cols = n.cols === 3 ? 3 : 2;
            const gap = spaceOf(e, n.gap ?? 24);
            const cw = (width - gap * (cols - 1)) / cols;
            let h = 0;
            for (let i = 0; i < n.children.length; i += cols) {
                const row = n.children.slice(i, i + cols).map((k) => measure(k, cw, e, 'grid'));
                h += Math.max(0, ...row) + (i > 0 ? gap : 0);
            }
            return h;
        }
        case 'stack':
            return measureStack(n, width, e, dirOfParent);
        default:
            return 0;
    }
};

const measureList = (n: ListNode, width: number, e: EstCtx): number => {
    const pair = pairOf(e);
    const items = (e.c.listItems || []).filter((s) => (s || '').trim());
    if (!items.length) return 0;
    const sz = n.size ?? 0;
    const bodyPx = ROLE_SPECS.body.px * sizeStep(sz) * e.scale * (items.length >= 5 ? 0.9 : 1);
    const gap = spaceOf(e, n.gap ?? (n.look === 'cards' ? 20 : 28));
    const cols = Math.max(1, Math.min(3, n.cols || 1));
    const colW = (width - gap * (cols - 1)) / cols;
    const titlePx = ROLE_SPECS.subtitle.px * sizeStep(sz) * e.scale * 0.82;
    const body = (s: string, w: number) => textHeight(s.length, bodyPx, pair.body.cw, 1.4, w);
    const stacked = (s: string, w: number) => {
        const { key, value } = splitKey(s);
        if (!key) return body(value, w);
        return textHeight(key.length, titlePx, pair.display.cw, 1.12, w, !!pair.displayUpper) + 8 * e.scale + body(value, w);
    };
    const rowsOf = (hs: number[]) => {
        let h = 0;
        for (let i = 0; i < hs.length; i += cols) h += Math.max(...hs.slice(i, i + cols)) + (i > 0 ? gap : 0);
        return h;
    };
    switch (n.look) {
        case 'cards': {
            const pad = 32 * e.scale;
            const inner = colW - 68 * e.scale;
            return rowsOf(items.map((s) => pad * 2 + 22 * 1.3 * e.scale + 14 * e.scale + stacked(s, inner)));
        }
        case 'steps':
        case 'timeline': {
            const d = (n.look === 'steps' ? 60 : 26) * e.scale;
            const inner = width - d - 28 * e.scale;
            return items.reduce((h, s, i) => h + Math.max(d, stacked(s, inner)) + (i < items.length - 1 ? gap : 0), 0);
        }
        case 'bignum': {
            const px = 120 * sizeStep(sz) * e.scale * (items.length >= 5 ? 0.8 : 1);
            const inner = colW - px * 0.9 - 30 * e.scale;
            return rowsOf(items.map((s) => Math.max(px * 0.85, 8 * e.scale + stacked(s, inner))));
        }
        case 'chips': {
            let rows = 1;
            let x = 0;
            for (const s of items) {
                const w = s.length * bodyPx * pair.body.cw + 56 * e.scale;
                if (x > 0 && x + w > width) { rows++; x = 0; }
                x += w + 16 * e.scale;
            }
            return rows * (bodyPx * 1.4 + 28 * e.scale) + (rows - 1) * 16 * e.scale;
        }
        case 'numbers': {
            const inner = width - 28 * 2 * sizeStep(sz) * e.scale - 28 * e.scale;
            return items.reduce((h, s, i) => h + body(s, inner) + gap * 1.6 + (i > 0 ? 2 * e.scale : 0), 0);
        }
        default: {
            const inner = colW - 44 * e.scale;
            return rowsOf(items.map((s) => body(s, inner)));
        }
    }
};

const measureStack = (n: StackNode, width: number, e: EstCtx, parentDir: 'col' | 'row' | 'grid'): number => {
    void parentDir;
    const filled = !!(n.fill || n.gradient || n.border);
    const p = spaceOf(e, n.pad ?? (filled ? 40 : 0));
    const px = n.padX !== undefined ? spaceOf(e, n.padX) : p;
    const py = n.padY !== undefined ? spaceOf(e, n.padY) : p;
    const inner = Math.max(40, width - px * 2);
    const gap = spaceOf(e, n.gap ?? 0);
    const kids = n.children.filter(Boolean);
    if (n.dir === 'row') {
        // Split the width: basis/width fractions first, then growers share the rest.
        const fixed = kids.map((k) => (k.type === 'stack' && k.basis ? k.basis : k.type === 'stack' && k.width && WIDTH_FRAC[k.width] ? WIDTH_FRAC[k.width] : 0));
        const natural = kids.map((k, i) => (fixed[i] ? 0 : k.type === 'icon' ? ({ s: 44, m: 64, l: 96, xl: 140 } as const)[k.size || 'm'] * e.scale * (k.tile ? 1.8 : 1) : k.type === 'rule' ? (k.vertical ? (k.thick ?? 4) * e.scale : 96 * e.scale) : k.type === 'meta' ? 160 * e.scale : k.type === 'image' ? ({ s: 240, m: 330, l: 440 } as const)[k.size || 'm'] * e.scale : k.type === 'spacer' ? spaceOf(e, k.size ?? 0) : -1));
        const avail = inner - gap * Math.max(0, kids.length - 1);
        const fracW = fixed.reduce((a, f) => a + f * avail, 0);
        const natW = natural.reduce((a, w) => a + Math.max(0, w), 0);
        const flexCount = natural.filter((w, i) => w < 0 && !fixed[i]).length;
        const flexW = flexCount ? Math.max(60, (avail - fracW - natW) / flexCount) : 0;
        const hs = kids.map((k, i) => measure(k, fixed[i] ? fixed[i] * avail : natural[i] >= 0 ? Math.max(natural[i], 1) : flexW, e, 'row'));
        return Math.max(0, ...hs) + py * 2;
    }
    let h = 0;
    let counted = 0;
    for (const k of kids) {
        const kh = measure(k, k.type === 'stack' && k.width && WIDTH_FRAC[k.width] ? inner * WIDTH_FRAC[k.width] : inner, e, 'col');
        if (k.type === 'stack' && k.basis) {
            // Fixed-height band: its content must fit inside its share of the slide.
            const box = k.basis * e.availH;
            e.worst = Math.max(e.worst, kh / Math.max(1, box));
            h += Math.max(box, kh);
        } else {
            h += kh;
        }
        if (!(k.type === 'spacer' && k.grow)) counted++;
    }
    return h + gap * Math.max(0, counted - 1) + py * 2;
};

export interface FillEstimate {
    /** Needed height ÷ available height at full size (> 1 means it will be shrunk). */
    ratio: number;
    need: number;
    avail: number;
    /** The fit factor the browser will likely settle on (1 = no shrinking). */
    fit: number;
}

/** Estimates how much of the slide a design needs at full size. */
export const estimateFill = (
    design: SlideDesign,
    content: CanvasContent,
    opts: { format?: 'portrait' | 'square'; signature?: boolean } = {},
): FillEstimate => {
    const fmt = opts.format === 'square' ? 'square' : 'portrait';
    const geo = CANVAS[fmt];
    const style = design.style;
    const basePad = Math.round(geo.pad * (style.density === 'airy' ? 1.1 : style.density === 'dense' ? 0.85 : 1));
    const bottom = opts.signature === false ? basePad : Math.max(basePad, fmt === 'square' ? 236 : 250);
    const availH = geo.h - basePad - bottom;
    const e: EstCtx = { c: content, style, scale: fmt === 'square' ? 0.9 : 1, dens: densityFactor(style.density), availH, worst: 0 };
    const need = measureStack({ ...design.root, pad: 0, padX: 0, padY: 0 }, geo.w - basePad * 2, e, 'col');
    const ratio = Math.max(need / availH, e.worst);
    // Text shrinks with --fit but paddings/icons don't: the fit needed is a bit below 1/ratio.
    const fit = ratio <= 1 ? 1 : Math.max(0.5, 1 / (ratio * 1.04));
    return { ratio, need, avail: availH, fit };
};
