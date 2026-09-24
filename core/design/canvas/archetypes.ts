/**
 * The Canvas layout library.
 *
 * Proven slide compositions for every content kind, each with variations.
 * They are used three ways:
 *   1. as the starting draft the AI Design Director customizes per slide,
 *   2. as the fallback when an AI layout is invalid,
 *   3. to design a deck instantly (no AI call) when a user switches an
 *      existing deck to Canvas or shuffles a slide's layout.
 * Everything here is deterministic for a given (content, style, seed).
 */

import type {
    CanvasContent, Decor, DesignStyle, Direction, FieldRef, SceneNode, SlideBackground,
    SlideDesign, StackNode, TextNode, TextRole,
} from './types';
import { defaultStyle } from './tokens';
import { ensureCoverage } from './lint';

type Block = 'hero' | 'body' | 'list' | 'stat' | 'quote' | 'split' | 'closing';

export interface ArchetypeCtx {
    style: DesignStyle;
    variant: number;
    index: number;
    total: number;
    /** Whole slide in a strong color (accent or ink) for rhythm across the deck. */
    invert?: 'accent' | 'ink';
}

interface Built {
    root: StackNode;
    bg?: SlideBackground;
    decor?: Decor[];
}

export interface Archetype {
    id: string;
    block: Block;
    label: string;
    /** Directions this layout suits best (others may still use it, less often). */
    fits?: Direction[];
    when?: (c: CanvasContent) => boolean;
    /** Works as a whole-slide color inversion (no bands/cards fighting the fill). */
    invertible?: boolean;
    /** Already carries a strong color block (bands): never inverted, and not placed next to an inverted slide. */
    banded?: boolean;
    build: (c: CanvasContent, a: ArchetypeCtx) => Built;
}

// ── builders ───────────────────────────────────────────────────────────────

const text = (field: FieldRef, role: TextRole, o: Partial<TextNode> = {}): TextNode => ({ type: 'text', field, role, ...o });
const stack = (o: Partial<StackNode>, children: (SceneNode | false | null | undefined)[]): StackNode => ({
    type: 'stack',
    ...o,
    children: children.filter(Boolean) as SceneNode[],
});
const col = (o: Partial<StackNode>, children: (SceneNode | false | null | undefined)[]) => stack({ dir: 'col', ...o }, children);
const row = (o: Partial<StackNode>, children: (SceneNode | false | null | undefined)[]) => stack({ dir: 'row', ...o }, children);
const grow = (): SceneNode => ({ type: 'spacer', grow: true });
const gap = (size: 8 | 16 | 24 | 32 | 36 | 40 | 48 | 56 = 24): SceneNode => ({ type: 'spacer', size });

const has = (c: CanvasContent, f: keyof CanvasContent) => {
    const v = c[f];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : !!v;
};
const len = (s?: string) => (s || '').length;
const isPercent = (c: CanvasContent) => /^\s*\d{1,3}(\.\d+)?\s*%\s*$/.test(c.statNumber || '');
const avgItemLen = (c: CanvasContent) => {
    const items = c.listItems || [];
    return items.length ? items.reduce((a, s) => a + s.length, 0) / items.length : 0;
};
const allKeyed = (c: CanvasContent) => (c.listItems || []).every((s) => /^[^:]{1,48}:\s*\S/.test(s));

/** Size step for a headline in a given role, from its length (display 120px, title 86px at step 0). */
const headlineStep = (h: string | undefined, role: 'display' | 'title'): number => {
    const n = len(h);
    if (role === 'display') return n <= 20 ? 1 : n <= 36 ? 0 : n <= 52 ? -1 : n <= 70 ? -2 : -3;
    return n <= 18 ? 1 : n <= 34 ? 0 : n <= 52 ? -1 : n <= 72 ? -2 : -3;
};
const bodyStep = (b: string | undefined) => (len(b) > 190 ? -1 : len(b) <= 70 ? 1 : 0);

/** List text size from how much there is: few short items get big type. */
const listStep = (c: CanvasContent, look: 'cards' | 'rows' = 'rows'): number => {
    const n = (c.listItems || []).length;
    const avg = avgItemLen(c);
    if (look === 'cards') return n <= 3 && avg <= 40 ? 1 : n >= 5 || avg > 80 ? -1 : 0;
    if (n <= 3 && avg <= 24) return 2;
    if (n <= 4 && avg <= 48) return 1;
    return n >= 5 || avg > 85 ? -1 : 0;
};

/** Size step for the giant stat number from its length. */
const numberStep = (s?: string) => { const n = len(s); return n <= 3 ? 1 : n <= 5 ? 0 : n <= 7 ? -1 : -2; };

/** Kicker + page number row that tops most slides. */
const topRow = (c: CanvasContent, a: ArchetypeCtx, onAccent = false): SceneNode =>
    row({ justify: 'between', align: 'center', gap: 24 }, [
        has(c, 'preHeader') ? text('preHeader', 'kicker', onAccent ? { color: 'onAccent' } : {}) : { type: 'spacer', size: 0 },
        { type: 'meta', kind: a.style.direction === 'tech' || a.style.direction === 'minimal' ? 'pageOfTotal' : 'page', color: onAccent ? 'onAccent' : 'inkSoft' },
    ]);

const markFor = (s: DesignStyle) => s.mark;

// ── archetypes ─────────────────────────────────────────────────────────────

export const ARCHETYPES: Archetype[] = [
    // HERO ------------------------------------------------------------------
    {
        id: 'hero-stack', block: 'hero', label: 'Big headline', invertible: true,
        build: (c, a) => ({
            root: col({ justify: 'between' }, [
                row({ justify: 'between', align: 'center' }, [
                    has(c, 'preHeader') && (a.variant % 2 === 0
                        ? text('preHeader', 'kicker')
                        : { type: 'badge', field: 'preHeader', fill: a.invert ? 'bg' : 'accentSoft', color: 'ink' }),
                    (a.style.direction === 'tech' || a.style.direction === 'minimal') && { type: 'meta', kind: 'pageOfTotal' },
                ]),
                col({ gap: 36 }, [
                    text('headline', 'display', { size: headlineStep(c.headline, 'display'), mark: markFor(a.style) }),
                    a.variant % 3 === 0 && { type: 'rule', width: 'short', thick: 8, color: a.invert ? 'onAccent' : 'accent' },
                    has(c, 'body') && text('body', 'body', { size: bodyStep(c.body), maxWidth: '3/4' }),
                ]),
                { type: 'meta', kind: 'swipe' },
            ]),
        }),
    },
    {
        id: 'hero-band', block: 'hero', label: 'Color band', banded: true, fits: ['bold', 'playful', 'corporate', 'magazine'],
        build: (c, a) => ({
            root: col({ gap: 0 }, [
                col({ bleed: 'top', fill: 'accent', basis: 0.62, justify: 'end', gap: 28, padY: 64 }, [
                    has(c, 'preHeader') && text('preHeader', 'kicker', { color: 'onAccent' }),
                    text('headline', 'display', { size: headlineStep(c.headline, 'display'), color: 'onAccent', mark: a.style.mark === 'box' || a.style.mark === 'color' ? 'underline' : a.style.mark }),
                ]),
                col({ grow: true, justify: 'between', padY: 52, gap: 32 }, [
                    has(c, 'body') && text('body', 'body', { size: bodyStep(c.body) }),
                    { type: 'meta', kind: 'swipe' },
                ]),
            ]),
        }),
    },
    {
        id: 'hero-centered', block: 'hero', label: 'Centered statement', invertible: true, fits: ['minimal', 'editorial', 'playful', 'tech'],
        build: (c, a) => ({
            root: col({ justify: 'center', align: 'center', gap: 44 }, [
                has(c, 'preHeader') && { type: 'badge', field: 'preHeader', fill: a.invert ? 'bg' : 'accentSoft', color: 'ink', align: 'center' },
                text('headline', 'display', { size: headlineStep(c.headline, 'display'), align: 'center', mark: markFor(a.style) }),
                has(c, 'body') && text('body', 'body', { align: 'center', maxWidth: '3/4', size: bodyStep(c.body) }),
                gap(16),
                { type: 'meta', kind: 'swipe', align: 'center' },
            ]),
            decor: a.style.direction === 'playful'
                ? [{ shape: 'blob', x: 90, y: 10, w: 46, color: 'accentSoft', opacity: 0.55 }, { shape: 'spark', x: 12, y: 8, w: 8, color: 'accent', opacity: 1 }]
                : [{ shape: 'ring', x: 50, y: 50, w: 96, color: 'accent', opacity: 0.1 }],
        }),
    },
    {
        id: 'hero-card', block: 'hero', label: 'Headline card', fits: ['corporate', 'tech', 'playful', 'brutalist'],
        build: (c, a) => ({
            root: col({ justify: 'between' }, [
                has(c, 'preHeader') ? text('preHeader', 'kicker') : { type: 'meta', kind: 'page' },
                col({ fill: 'surface', pad: 60, gap: 32, shadow: a.style.direction === 'brutalist' ? 'hard' : 'none', border: a.style.direction === 'brutalist' ? 'ink' : undefined, borderW: 4 }, [
                    has(c, 'icon') && { type: 'icon', name: c.icon!, size: 'm', tile: 'accent' },
                    text('headline', 'title', { size: headlineStep(c.headline, 'title') + 1, mark: markFor(a.style) }),
                    has(c, 'body') && text('body', 'body', { size: bodyStep(c.body) }),
                ]),
                { type: 'meta', kind: 'swipe' },
            ]),
        }),
    },
    {
        id: 'hero-visual', block: 'hero', label: 'Headline + visual',
        when: (c) => has(c, 'doodleUrl') || has(c, 'icon'),
        build: (c, a) => ({
            root: col({ justify: 'between', gap: 32 }, [
                has(c, 'preHeader') && text('preHeader', 'kicker'),
                col({ gap: 32 }, [
                    text('headline', 'display', { size: headlineStep(c.headline, 'display'), mark: markFor(a.style) }),
                    has(c, 'body') && text('body', 'body', { maxWidth: '3/4', size: bodyStep(c.body) }),
                ]),
                row({ justify: 'between', align: 'end' }, [
                    { type: 'meta', kind: 'swipe' },
                    has(c, 'doodleUrl')
                        ? { type: 'image', src: 'doodle', size: 's', mask: a.style.radius === 'none' ? 'none' : 'arch' }
                        : { type: 'icon', name: c.icon!, size: 'xl', tile: 'accentSoft', shape: a.style.radius === 'none' ? 'square' : 'circle' },
                ]),
            ]),
        }),
    },

    // BODY ------------------------------------------------------------------
    {
        id: 'body-statement', block: 'body', label: 'Statement', invertible: true,
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                grow(),
                col({ gap: 36 }, [
                    has(c, 'icon') && a.variant % 2 === 1 && { type: 'icon', name: c.icon!, size: 'l', color: a.invert ? 'onAccent' : 'accent' },
                    text('headline', 'title', { size: headlineStep(c.headline, 'title') + (len(c.body) < 90 ? 1 : 0), mark: markFor(a.style) }),
                    { type: 'rule', width: 'short', thick: 8, color: a.invert ? 'onAccent' : 'accent' },
                    has(c, 'body') && text('body', 'body', { size: bodyStep(c.body) }),
                ]),
                grow(),
            ]),
        }),
    },
    {
        id: 'body-card', block: 'body', label: 'Card', fits: ['corporate', 'tech', 'playful', 'brutalist', 'minimal'],
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(48),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                has(c, 'body') && col({ fill: a.variant % 2 ? 'surface2' : 'surface', pad: 52, gap: 28, border: a.style.direction === 'brutalist' ? 'ink' : a.style.direction === 'tech' ? 'line' : undefined, borderW: a.style.direction === 'brutalist' ? 4 : 2, shadow: a.style.direction === 'brutalist' ? 'hard' : 'none' }, [
                    has(c, 'icon') && { type: 'icon', name: c.icon!, size: 'm', tile: 'accent' },
                    text('body', 'body', { size: bodyStep(c.body) + (len(c.body) < 140 ? 1 : 0), color: 'ink' }),
                ]),
                grow(),
            ]),
        }),
    },
    {
        id: 'body-rail', block: 'body', label: 'Accent rail', invertible: true, fits: ['editorial', 'bold', 'magazine', 'minimal'],
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                grow(),
                row({ gap: 44 }, [
                    { type: 'rule', vertical: true, thick: 12, color: a.invert ? 'onAccent' : 'accent' },
                    col({ grow: true, gap: 36 }, [
                        text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                        has(c, 'body') && text('body', 'body', { size: bodyStep(c.body) }),
                    ]),
                ]),
                grow(),
            ]),
        }),
    },
    {
        id: 'body-icon', block: 'body', label: 'Icon focus', invertible: true, fits: ['corporate', 'playful', 'tech', 'minimal'],
        when: (c) => has(c, 'icon'),
        build: (c, a) => ({
            root: col({ align: 'center' }, [
                row({ justify: 'center' }, [has(c, 'preHeader') ? text('preHeader', 'kicker', { align: 'center' }) : { type: 'meta', kind: 'pageOfTotal' }]),
                grow(),
                { type: 'icon', name: c.icon!, size: 'l', tile: a.invert ? 'bg' : 'accentSoft', shape: a.style.radius === 'none' ? 'square' : 'circle' },
                gap(48),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), align: 'center', mark: markFor(a.style) }),
                gap(32),
                has(c, 'body') && text('body', 'body', { align: 'center', maxWidth: '3/4', size: bodyStep(c.body) }),
                grow(),
            ]),
        }),
    },
    {
        id: 'body-split-title', block: 'body', label: 'Title over text', invertible: true, fits: ['magazine', 'editorial', 'bold'],
        when: (c) => len(c.headline) <= 48,
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(48),
                text('headline', 'display', { size: headlineStep(c.headline, 'display'), mark: markFor(a.style) }),
                grow(),
                row({ gap: 36, align: 'start' }, [
                    col({ width: '1/4', padY: 20 }, [{ type: 'rule', width: 'full', thick: 6, color: a.invert ? 'onAccent' : 'accent' }]),
                    col({ grow: true }, [has(c, 'body') && text('body', 'body', { size: bodyStep(c.body) })]),
                ]),
            ]),
        }),
    },

    // LIST ------------------------------------------------------------------
    {
        id: 'list-numbers', block: 'list', label: 'Numbered rows', invertible: true,
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                { type: 'list', look: 'numbers', size: listStep(c) },
                grow(),
            ]),
        }),
    },
    {
        id: 'list-cards', block: 'list', label: 'Cards', fits: ['corporate', 'playful', 'tech', 'brutalist', 'bold'],
        when: (c) => allKeyed(c),
        build: (c, a) => {
            const n = (c.listItems || []).length;
            const cols = n === 4 && avgItemLen(c) <= 70 ? 2 : 1;
            return {
                root: col({}, [
                    topRow(c, a),
                    gap(40),
                    text('headline', 'title', { size: headlineStep(c.headline, 'title') - (cols === 1 && n > 3 ? 1 : 0), mark: markFor(a.style) }),
                    grow(),
                    { type: 'list', look: 'cards', cols: cols as 1 | 2, fill: a.variant % 2 ? 'surface2' : 'surface', size: listStep(c, 'cards') },
                    grow(),
                ]),
            };
        },
    },
    {
        id: 'list-steps', block: 'list', label: 'Steps', fits: ['corporate', 'tech', 'minimal', 'playful'],
        when: (c) => allKeyed(c) || avgItemLen(c) > 24,
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                { type: 'list', look: allKeyed(c) ? 'steps' : 'timeline', size: listStep(c) },
                grow(),
            ]),
        }),
    },
    {
        id: 'list-checks', block: 'list', label: 'Checklist panel', fits: ['playful', 'corporate', 'minimal'],
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                col({ fill: 'surface', pad: 52 }, [{ type: 'list', look: 'checks', gap: 36, size: listStep(c) }]),
                grow(),
            ]),
        }),
    },
    {
        id: 'list-bignum', block: 'list', label: 'Big numbers', invertible: true, fits: ['magazine', 'bold', 'editorial', 'brutalist', 'playful'],
        when: (c) => (c.listItems || []).length <= 4,
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                { type: 'list', look: 'bignum', gap: 44, size: Math.min(1, listStep(c)) },
                grow(),
            ]),
        }),
    },
    {
        id: 'list-chips', block: 'list', label: 'Tags', invertible: true, fits: ['playful', 'minimal', 'tech'],
        when: (c) => avgItemLen(c) <= 26,
        build: (c, a) => ({
            root: col({ justify: 'center', gap: 48 }, [
                has(c, 'preHeader') && text('preHeader', 'kicker'),
                text('headline', 'display', { size: headlineStep(c.headline, 'display'), mark: markFor(a.style) }),
                { type: 'list', look: 'chips', size: listStep(c) },
            ]),
        }),
    },

    // STAT ------------------------------------------------------------------
    {
        id: 'stat-giant', block: 'stat', label: 'Giant number', invertible: true,
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                { type: 'number', field: 'statNumber', size: numberStep(c.statNumber), outline: a.style.direction === 'magazine' && a.variant % 2 === 1 },
                gap(16),
                has(c, 'statLabel') && text('statLabel', 'subtitle', { size: -1, maxWidth: '3/4' }),
                grow(),
                has(c, 'body') && text('body', 'small'),
            ]),
        }),
    },
    {
        id: 'stat-ring', block: 'stat', label: 'Ring chart', fits: ['corporate', 'tech', 'minimal', 'playful'],
        when: (c) => isPercent(c),
        build: (c, a) => ({
            root: col({ align: 'center' }, [
                row({ justify: 'center' }, [has(c, 'preHeader') ? text('preHeader', 'kicker', { align: 'center' }) : { type: 'meta', kind: 'pageOfTotal' }]),
                gap(36),
                text('headline', 'title', { size: headlineStep(c.headline, 'title') - 1, align: 'center', mark: markFor(a.style) }),
                grow(),
                { type: 'chart', kind: 'ring', size: 'l' },
                gap(36),
                has(c, 'statLabel') && text('statLabel', 'subtitle', { align: 'center', size: -1, maxWidth: '3/4' }),
                grow(),
            ]),
        }),
    },
    {
        id: 'stat-band', block: 'stat', label: 'Number band', banded: true, fits: ['bold', 'playful', 'magazine', 'corporate'],
        build: (c, a) => ({
            root: col({ gap: 0 }, [
                col({ bleed: 'top', fill: 'accent', basis: 0.6, justify: 'end', gap: 12, padY: 56 }, [
                    has(c, 'preHeader') && text('preHeader', 'kicker', { color: 'onAccent' }),
                    { type: 'number', field: 'statNumber', color: 'onAccent', size: numberStep(c.statNumber) },
                    has(c, 'statLabel') && text('statLabel', 'subtitle', { size: -1, color: 'onAccent', maxWidth: '3/4' }),
                ]),
                col({ grow: true, justify: 'center', gap: 28, padY: 44 }, [
                    text('headline', 'title', { size: headlineStep(c.headline, 'title') - 1, mark: markFor(a.style) }),
                    has(c, 'body') && text('body', 'small'),
                ]),
            ]),
        }),
    },
    {
        id: 'stat-progress', block: 'stat', label: 'Progress bar', fits: ['tech', 'minimal', 'corporate'],
        when: (c) => isPercent(c),
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                { type: 'number', field: 'statNumber', size: numberStep(c.statNumber) - 1 },
                gap(24),
                { type: 'chart', kind: 'progress' },
                gap(32),
                has(c, 'statLabel') && text('statLabel', 'subtitle', { size: -1 }),
                grow(),
            ]),
        }),
    },

    // QUOTE -----------------------------------------------------------------
    {
        id: 'quote-mark', block: 'quote', label: 'Quote mark', invertible: true,
        build: (c, a) => ({
            root: col({ justify: 'center', gap: 44, align: a.variant % 2 ? 'center' : 'start' }, [
                { type: 'quotemark', size: 'l' },
                text('headline', 'quote', { align: a.variant % 2 ? 'center' : 'left', size: len(c.headline) > 160 ? -2 : len(c.headline) > 110 ? -1 : 0 }),
                row({ gap: 20, align: 'center', justify: a.variant % 2 ? 'center' : 'start' }, [
                    { type: 'rule', width: 'short', thick: 4, color: a.invert ? 'onAccent' : 'accent' },
                    has(c, 'quoteAuthor') && text('quoteAuthor', 'label', { color: 'accent' }),
                ]),
            ]),
        }),
    },
    {
        id: 'quote-card', block: 'quote', label: 'Quote card', fits: ['corporate', 'playful', 'minimal', 'tech'],
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                grow(),
                col({ fill: 'surface', pad: 64, gap: 36 }, [
                    { type: 'quotemark', size: 'm' },
                    text('headline', 'quote', { size: len(c.headline) > 140 ? -2 : len(c.headline) > 90 ? -1 : 0 }),
                    has(c, 'quoteAuthor') && text('quoteAuthor', 'label', { color: 'accent' }),
                ]),
                grow(),
            ]),
        }),
    },

    // SPLIT -----------------------------------------------------------------
    {
        id: 'split-columns', block: 'split', label: 'Side by side',
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                row({ gap: 24, align: 'stretch' }, [
                    col({ grow: true, fill: 'surface', pad: 44, gap: 20 }, [
                        text('splitLeft', 'label', { part: 'key', color: 'inkSoft' }),
                        text('splitLeft', 'subtitle', { part: 'value', size: -2 }),
                    ]),
                    col({ grow: true, fill: 'accent', pad: 44, gap: 20 }, [
                        text('splitRight', 'label', { part: 'key', color: 'onAccent' }),
                        text('splitRight', 'subtitle', { part: 'value', size: -2, color: 'onAccent' }),
                    ]),
                ]),
                grow(),
            ]),
        }),
    },
    {
        id: 'split-stacked', block: 'split', label: 'Before / after',
        build: (c, a) => ({
            root: col({}, [
                topRow(c, a),
                gap(40),
                text('headline', 'title', { size: headlineStep(c.headline, 'title'), mark: markFor(a.style) }),
                grow(),
                col({ fill: 'surface', pad: 44, gap: 16 }, [
                    text('splitLeft', 'label', { part: 'key', color: 'inkSoft' }),
                    text('splitLeft', 'subtitle', { part: 'value', size: -1, color: 'inkSoft' }),
                ]),
                row({ justify: 'center', padY: 8 }, [{ type: 'icon', name: 'ArrowDown', size: 's', color: 'accent' }]),
                col({ fill: 'accent', pad: 44, gap: 16 }, [
                    text('splitRight', 'label', { part: 'key', color: 'onAccent' }),
                    text('splitRight', 'subtitle', { part: 'value', size: -1, color: 'onAccent' }),
                ]),
                grow(),
            ]),
        }),
    },

    // CLOSING ---------------------------------------------------------------
    {
        id: 'closing-cta', block: 'closing', label: 'Call to action', invertible: true,
        build: (c, a) => ({
            root: col({ justify: 'center', align: 'center', gap: 40 }, [
                has(c, 'preHeader') && text('preHeader', 'kicker', { align: 'center' }),
                text('headline', 'display', { size: headlineStep(c.headline, 'display'), align: 'center', mark: markFor(a.style) }),
                has(c, 'body') && text('body', 'body', { align: 'center', maxWidth: '3/4', size: bodyStep(c.body) }),
                gap(16),
                has(c, 'footer') && { type: 'badge', field: 'footer', size: 'button', align: 'center', fill: a.invert ? 'bg' : 'accent', color: a.invert ? 'ink' : 'onAccent' },
            ]),
            decor: [{ shape: a.style.direction === 'playful' ? 'blob' : 'ring', x: 50, y: 46, w: 98, color: 'accent', opacity: 0.1 }],
        }),
    },
    {
        id: 'closing-band', block: 'closing', label: 'CTA band', banded: true, fits: ['bold', 'magazine', 'corporate', 'brutalist'],
        build: (c, a) => ({
            root: col({ gap: 0 }, [
                col({ grow: true, justify: 'center', gap: 36 }, [
                    has(c, 'preHeader') && text('preHeader', 'kicker'),
                    text('headline', 'display', { size: headlineStep(c.headline, 'display'), mark: markFor(a.style) }),
                    has(c, 'body') && text('body', 'body', { maxWidth: '3/4', size: bodyStep(c.body) }),
                ]),
                has(c, 'footer') && col({ bleed: 'bottom', fill: 'accent', padY: 52, align: 'start' }, [
                    { type: 'badge', field: 'footer', size: 'button', fill: 'bg', color: 'ink' },
                ]),
            ]),
        }),
    },
    {
        id: 'closing-card', block: 'closing', label: 'CTA card', fits: ['corporate', 'playful', 'tech', 'minimal'],
        build: (c, a) => ({
            root: col({ justify: 'center' }, [
                col({ fill: 'surface', pad: 64, gap: 36, align: 'start' }, [
                    has(c, 'icon') && { type: 'icon', name: c.icon!, size: 'm', tile: 'accent' },
                    has(c, 'preHeader') && text('preHeader', 'kicker'),
                    text('headline', 'title', { size: headlineStep(c.headline, 'title') + 1, mark: markFor(a.style) }),
                    has(c, 'body') && text('body', 'body', { size: bodyStep(c.body) }),
                    has(c, 'footer') && { type: 'badge', field: 'footer', size: 'button' },
                ]),
            ]),
        }),
    },
];

export const ARCHETYPE_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

export const toBlock = (blockType: string): Block => {
    if (blockType === 'cta') return 'closing';
    return (['hero', 'body', 'list', 'stat', 'quote', 'split', 'closing'].includes(blockType) ? blockType : 'body') as Block;
};

export const archetypesFor = (blockType: string, c: CanvasContent): Archetype[] =>
    ARCHETYPES.filter((a) => a.block === toBlock(blockType) && (!a.when || a.when(c)));

// ── deterministic variety ──────────────────────────────────────────────────

/** Small seeded PRNG (mulberry32). */
export const rng = (seed: number) => {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

export const hashString = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
};

/** Choose a layout: favours ones that fit the direction, avoids repeating the previous slide's. */
export const pickArchetype = (
    blockType: string,
    c: CanvasContent,
    style: DesignStyle,
    seed: number,
    avoid: string[] = [],
    filter?: (a: Archetype) => boolean,
): Archetype => {
    const all = archetypesFor(blockType, c);
    const allowed = filter ? all.filter(filter) : all;
    const base = allowed.length ? allowed : all;
    const pool = base.filter((a) => !avoid.includes(a.id));
    const list = pool.length ? pool : base;
    const weights = list.map((a) => (a.fits?.includes(style.direction) ? 3 : 1));
    const total = weights.reduce((x, y) => x + y, 0);
    let r = rng(seed)() * total;
    for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
    }
    return list[list.length - 1] || ARCHETYPES[0];
};

// ── backgrounds & decorations per direction ────────────────────────────────

const backgroundFor = (style: DesignStyle, block: Block, variant: number): SlideBackground => {
    switch (style.direction) {
        case 'editorial': return block === 'hero' || block === 'closing' ? { kind: 'frame', color2: 'line' } : { kind: 'solid' };
        case 'tech': return block === 'hero' ? { kind: 'spot', color2: 'accent', angle: 315 } : { kind: 'solid' };
        case 'corporate': return block === 'hero' || block === 'closing' ? { kind: 'gradient', color: 'bg', color2: 'surface2', angle: 120 } : { kind: 'solid' };
        case 'brutalist': return { kind: 'frame', color2: 'ink' };
        case 'playful': return variant % 3 === 2 ? { kind: 'gradient', color: 'bg', color2: 'accentSoft', angle: 150 } : { kind: 'solid' };
        default: return { kind: 'solid' };
    }
};

/**
 * Decorations per direction. Positions vary per slide (seeded) and stay out of
 * the text column: big faint shapes bleed off an edge, small accents sit in the
 * margins. The bottom-left corner is left for the signature card and the top
 * row for kicker + page number.
 */
export const decorFor = (style: DesignStyle, block: Block, seed: number, inverted = false): Decor[] => {
    const r = rng(seed ^ 0x9e3779b9);
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length) % xs.length];
    const chance = (p: number) => r() < p;
    // Bleeding anchors for big shapes (center points, % of canvas).
    const bleed = pick([{ x: 104, y: 100 }, { x: 102, y: 1 }, { x: 108, y: 88 }, { x: 72, y: 108 }]);
    // Margin spots for small accents (clear of top row and signature corner).
    const spot = pick([{ x: 92, y: 95 }, { x: 94, y: 3.5 }, { x: 5, y: 3.5 }, { x: 95, y: 60 }]);
    const soft = inverted ? 'ink' : 'accent';
    switch (style.direction) {
        case 'editorial':
            if (block === 'body' || block === 'list' || block === 'stat') return chance(0.7) ? [{ shape: 'bignum', x: 80, y: 90, w: 34, h: 28, color: 'ink', opacity: 0.07 }] : [];
            return [];
        case 'bold': {
            if (block === 'hero' || block === 'closing') return [];
            const shape = pick(['circle', 'circle', 'ring', 'dots'] as const);
            if (shape === 'dots') return [{ shape: 'dots', x: 88, y: 92, w: 22, h: 14, color: soft, opacity: 0.4 }];
            return [{ shape, x: bleed.x, y: bleed.y, w: pick([40, 48, 56]), color: soft, opacity: shape === 'ring' ? 0.3 : 0.16 }];
        }
        case 'minimal':
            if (block === 'hero' || block === 'closing') return [{ shape: 'spark', x: spot.x, y: spot.y, w: 4.5, color: 'accent', opacity: 1 }];
            return chance(0.35) ? [{ shape: 'circle', x: spot.x, y: spot.y, w: 1.8, color: 'accent', opacity: 1 }] : [];
        case 'playful': {
            const blob = pick([{ x: 98, y: 3 }, { x: 102, y: 96 }, { x: 104, y: 84 }]);
            return [
                { shape: 'blob', x: blob.x, y: blob.y, w: pick([34, 40, 46]), color: 'accentSoft', opacity: inverted ? 0.25 : 0.6, rotate: Math.round(r() * 80) },
                { shape: pick(['spark', 'star', 'spark']), x: blob.y > 50 ? 8 : 92, y: blob.y > 50 ? 3.5 : 95, w: 6.5, color: inverted ? 'bg' : 'accent', opacity: 1, rotate: 12 },
                ...(chance(0.3) && block !== 'list' ? [{ shape: 'wave', x: 80, y: 97, w: 30, h: 3, color: soft, opacity: 0.5 } as Decor] : []),
            ];
        }
        case 'tech':
            return [
                { shape: pick(['dots', 'dots', 'grid']), x: 86, y: 93, w: 24, h: 13, color: 'ink', opacity: 0.3 },
                ...(block === 'hero' || block === 'closing' ? [{ shape: 'ring', x: 100, y: 4, w: 58, color: 'accent', opacity: 0.22 } as Decor] : []),
            ];
        case 'corporate':
            return [{ shape: 'circle', x: bleed.x, y: bleed.y, w: block === 'hero' || block === 'closing' ? 62 : 42, color: inverted ? 'bg' : 'accentSoft', opacity: inverted ? 0.12 : 0.4 }];
        case 'magazine':
            return block === 'hero' ? [] : chance(0.75) ? [{ shape: 'bignum', x: 78, y: 91, w: 46, h: 36, color: 'ink', opacity: 0.07 }] : [];
        case 'brutalist':
            return [
                { shape: 'cross', x: spot.x, y: spot.y, w: 5, color: 'accent', opacity: 1 },
                ...(chance(0.4) && block !== 'hero' ? [{ shape: 'lines', x: 88, y: 92, w: 20, h: 10, color: 'ink', opacity: 0.35 } as Decor] : []),
            ];
        default:
            return [];
    }
};

// ── public API ─────────────────────────────────────────────────────────────

/** Designs one slide from the layout library. */
export const designSlide = (
    blockType: string,
    content: CanvasContent,
    style: DesignStyle = defaultStyle(),
    opts: { seed?: number; archetype?: string; index?: number; total?: number; avoid?: string[]; invert?: 'accent' | 'ink'; filter?: (a: Archetype) => boolean } = {},
): SlideDesign => {
    const seed = opts.seed ?? hashString(`${blockType}:${content.headline || ''}`);
    const chosen = (opts.archetype && ARCHETYPE_BY_ID.get(opts.archetype)) || pickArchetype(blockType, content, style, seed, opts.avoid, opts.filter);
    const invert = opts.invert && chosen.invertible ? opts.invert : undefined;
    const a: ArchetypeCtx = { style, variant: seed % 7, index: opts.index ?? 0, total: opts.total ?? 0, invert };
    const built = chosen.build(content, a);
    // Safety net: a layout never drops a field the slide has.
    ensureCoverage(built.root, content, blockType);
    const block = toBlock(blockType);
    return {
        v: 1,
        style,
        bg: invert ? { kind: 'solid', color: invert } : built.bg || backgroundFor(style, block, a.variant),
        root: built.root,
        decor: [...(built.decor || []), ...decorFor(style, block, seed, !!invert)].slice(0, 5),
        archetype: chosen.id,
        seed,
        ...(invert ? { invert } : {}),
    };
};

/** How many whole-slide color inversions a deck gets, and in which color. */
const INVERT_PLAN: Record<Direction, { max: number; color: 'accent' | 'ink' }> = {
    bold: { max: 2, color: 'accent' },
    playful: { max: 2, color: 'accent' },
    brutalist: { max: 1, color: 'accent' },
    corporate: { max: 1, color: 'accent' },
    tech: { max: 1, color: 'accent' },
    magazine: { max: 1, color: 'ink' },
    editorial: { max: 1, color: 'ink' },
    minimal: { max: 1, color: 'ink' },
};

/**
 * Which slides get a whole-slide color inversion: never two neighbours,
 * prefers quotes, stats and statements, needs an invertible layout for the
 * content. Decided from block types, before layouts are picked.
 */
export const chooseInversions = (
    slides: { blockType: string; content: CanvasContent }[],
    style: DesignStyle,
    deckSeed: number,
): number[] => {
    const plan = INVERT_PLAN[style.direction] || INVERT_PLAN.bold;
    const n = slides.length;
    if (n < 4 || plan.max <= 0) return [];
    const max = Math.min(plan.max, Math.floor(n / 3));
    const r = rng(deckSeed ^ 0x51ed27);
    const PRIORITY: Record<string, number> = { quote: 3, stat: 2.5, body: 2, closing: 1.6, list: 1.2, hero: 1, split: 0 };
    const candidates = slides
        .map((s, i) => ({ i, block: toBlock(s.blockType), ok: archetypesFor(s.blockType, s.content).some((a) => a.invertible) }))
        .filter((x) => x.ok && (PRIORITY[x.block] ?? 0) > 0)
        .map((x) => ({ ...x, score: (PRIORITY[x.block] ?? 1) + r() * 1.6 }))
        .sort((p, q) => q.score - p.score);
    const chosen: number[] = [];
    for (const c of candidates) {
        if (chosen.length >= max) break;
        if (chosen.some((j) => Math.abs(j - c.i) <= 1)) continue;
        chosen.push(c.i);
    }
    return chosen.sort((p, q) => p - q);
};

/** Designs a whole deck with variety (no two neighbours share a layout, a couple of color-inverted slides for rhythm). */
export const designDeck = (
    slides: { blockType: string; content: CanvasContent }[],
    style: DesignStyle = defaultStyle(),
    deckSeed = 1,
): SlideDesign[] => {
    const inverted = new Set(chooseInversions(slides, style, deckSeed));
    const invertColor = INVERT_PLAN[style.direction]?.color || 'accent';
    const used = new Map<string, number>();
    let prev = '';
    return slides.map((s, i) => {
        const avoid = [prev, ...Array.from(used.entries()).filter(([, n]) => n >= 2).map(([id]) => id)];
        const inv = inverted.has(i);
        // Inverted slides need an invertible layout; their neighbours skip banded ones (two heavy color blocks in a row).
        const nextToInverted = inverted.has(i - 1) || inverted.has(i + 1);
        const filter = inv ? (a: Archetype) => !!a.invertible : nextToInverted ? (a: Archetype) => !a.banded : undefined;
        const d = designSlide(s.blockType, s.content, style, {
            seed: hashString(`${deckSeed}:${i}:${s.blockType}`), index: i, total: slides.length, avoid, filter,
            invert: inv ? invertColor : undefined,
        });
        prev = d.archetype || '';
        used.set(prev, (used.get(prev) || 0) + 1);
        return d;
    });
};

/** Next layout for "Shuffle layout": a different archetype for the same content. */
export const shuffleDesign = (current: SlideDesign | undefined, blockType: string, content: CanvasContent, style?: DesignStyle): SlideDesign => {
    const st = style || current?.style || defaultStyle();
    const options = archetypesFor(blockType, content);
    const idx = Math.max(0, options.findIndex((o) => o.id === current?.archetype));
    const next = options[(idx + 1) % Math.max(1, options.length)] || options[0];
    const seed = ((current?.seed ?? 0) + 1) >>> 0;
    return designSlide(blockType, content, st, { archetype: next?.id, seed, invert: current?.invert });
};
