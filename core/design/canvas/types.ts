/**
 * The Canvas layout language.
 *
 * A slide's design is a small tree of layout nodes (stacks, grids, text,
 * lists, numbers, charts, icons, images, rules, badges) plus background
 * decorations. It never contains the slide's words: text nodes point at the
 * slide's content fields (headline, body, list items, …). That separation is
 * what keeps three things independent:
 *   - content: edited in place, checked by the copy pipeline
 *   - design: composed per slide by the Design Director (or the layout library)
 *   - color: named roles filled from the palette / brand kit at render time
 */

/** Named color roles, resolved from the carousel theme when rendering. */
export type ColorRole =
    | 'bg'          // slide background
    | 'surface'     // subtle panel on the background
    | 'surface2'    // tinted panel
    | 'ink'         // primary text
    | 'inkSoft'     // secondary text
    | 'accent'      // brand primary
    | 'accent2'     // brand secondary
    | 'accentSoft'  // light tint of the accent (highlights, soft fills)
    | 'onAccent'    // text that sits on accent fills
    | 'line';       // hairlines, borders

export const COLOR_ROLES: ColorRole[] = ['bg', 'surface', 'surface2', 'ink', 'inkSoft', 'accent', 'accent2', 'accentSoft', 'onAccent', 'line'];

/** Content fields a text node can show. `x.<key>` are short extra labels stored in slots.extras. */
export type ContentField =
    | 'preHeader' | 'headline' | 'body' | 'footer'
    | 'statNumber' | 'statLabel' | 'quoteAuthor' | 'splitLeft' | 'splitRight';
export type FieldRef = ContentField | `x.${string}`;

export const CONTENT_FIELDS: ContentField[] = ['preHeader', 'headline', 'body', 'footer', 'statNumber', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight'];

export type TextRole = 'kicker' | 'display' | 'title' | 'subtitle' | 'body' | 'small' | 'label' | 'quote' | 'number' | 'caption';
export const TEXT_ROLES: TextRole[] = ['kicker', 'display', 'title', 'subtitle', 'body', 'small', 'label', 'quote', 'number', 'caption'];

/** How the headline's accent phrase is emphasised. */
export type MarkStyle = 'none' | 'color' | 'highlight' | 'underline' | 'serif' | 'box';
export const MARK_STYLES: MarkStyle[] = ['none', 'color', 'highlight', 'underline', 'serif', 'box'];

export type Space = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64 | 72 | 80 | 96 | 120;
export const SPACES: Space[] = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96, 120];

export type Width = 'auto' | 'full' | '1/4' | '1/3' | '2/5' | '1/2' | '3/5' | '2/3' | '3/4';
export const WIDTHS: Width[] = ['auto', 'full', '1/4', '1/3', '2/5', '1/2', '3/5', '2/3', '3/4'];

export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
export type TextAlign = 'left' | 'center' | 'right';
export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'pill' | 'theme';

export interface StackNode {
    type: 'stack';
    dir?: 'col' | 'row';
    gap?: Space;
    pad?: Space;
    padX?: Space;
    padY?: Space;
    align?: Align;
    justify?: Justify;
    fill?: ColorRole;
    /** Two-stop gradient fill (overrides fill). */
    gradient?: [ColorRole, ColorRole];
    radius?: Radius;
    border?: ColorRole;
    borderW?: 1 | 2 | 3 | 4 | 6;
    width?: Width;
    /** Fraction of the parent's main axis (0.15–0.85). Used for bands and columns. */
    basis?: number;
    /** Take the remaining space along the parent's main axis. */
    grow?: boolean;
    /** Extend to the slide edges (only for direct children of the root). */
    bleed?: 'top' | 'bottom' | 'x' | 'all';
    shadow?: 'none' | 'soft' | 'hard';
    rotate?: number;
    wrap?: boolean;
    children: SceneNode[];
}

export interface GridNode {
    type: 'grid';
    cols: 2 | 3;
    gap?: Space;
    children: SceneNode[];
}

export interface TextNode {
    type: 'text';
    field: FieldRef;
    role: TextRole;
    /** Size step: -3 … +3 (each step ≈ 15%). */
    size?: number;
    color?: ColorRole;
    align?: TextAlign;
    weight?: 300 | 400 | 500 | 600 | 700 | 800 | 900;
    italic?: boolean;
    upper?: boolean;
    font?: 'display' | 'body' | 'mono';
    /** For "Key: value" fields: show only one side. */
    part?: 'key' | 'value';
    /** Accent-phrase treatment (headline only). */
    mark?: MarkStyle;
    maxWidth?: Width;
    tracking?: 'tight' | 'normal' | 'wide';
}

export type ListLook = 'numbers' | 'checks' | 'dots' | 'cards' | 'steps' | 'timeline' | 'bignum' | 'chips';
export const LIST_LOOKS: ListLook[] = ['numbers', 'checks', 'dots', 'cards', 'steps', 'timeline', 'bignum', 'chips'];

export interface ListNode {
    type: 'list';
    look: ListLook;
    cols?: 1 | 2 | 3;
    gap?: Space;
    size?: number;
    /** Color of numbers / markers. */
    marker?: ColorRole;
    /** Card fill (cards look). */
    fill?: ColorRole;
    color?: ColorRole;
}

export interface NumberNode {
    type: 'number';
    field: FieldRef;
    size?: number;
    color?: ColorRole;
    outline?: boolean;
    align?: TextAlign;
}

export interface ChartNode {
    type: 'chart';
    /** ring/progress read a percentage from statNumber; bars read numbers from list items. */
    kind: 'ring' | 'progress' | 'bars';
    color?: ColorRole;
    track?: ColorRole;
    size?: 's' | 'm' | 'l';
}

export interface IconNode {
    type: 'icon';
    name: string;
    size?: 's' | 'm' | 'l' | 'xl';
    color?: ColorRole;
    tile?: ColorRole;
    shape?: 'circle' | 'square' | 'none';
}

export interface ImageNode {
    type: 'image';
    src: 'doodle';
    size?: 's' | 'm' | 'l';
    mask?: 'none' | 'circle' | 'rounded' | 'arch';
    frame?: ColorRole;
}

export interface RuleNode {
    type: 'rule';
    color?: ColorRole;
    width?: Width | 'short';
    thick?: 1 | 2 | 4 | 6 | 8 | 12;
    /** Vertical rule (stretches to the row's height). */
    vertical?: boolean;
}

export interface BadgeNode {
    type: 'badge';
    field: FieldRef;
    fill?: ColorRole;
    color?: ColorRole;
    outline?: boolean;
    /** 'button' renders a large call-to-action pill. */
    size?: 's' | 'button';
    align?: 'start' | 'center' | 'end';
}

export interface MetaNode {
    type: 'meta';
    kind: 'page' | 'pageOfTotal' | 'swipe' | 'progress';
    color?: ColorRole;
    align?: TextAlign;
}

export interface SpacerNode {
    type: 'spacer';
    size?: Space;
    grow?: boolean;
}

export interface QuoteMarkNode {
    type: 'quotemark';
    color?: ColorRole;
    size?: 's' | 'm' | 'l';
}

export type SceneNode =
    | StackNode | GridNode | TextNode | ListNode | NumberNode | ChartNode
    | IconNode | ImageNode | RuleNode | BadgeNode | MetaNode | SpacerNode | QuoteMarkNode;

export const NODE_TYPES: SceneNode['type'][] = ['stack', 'grid', 'text', 'list', 'number', 'chart', 'icon', 'image', 'rule', 'badge', 'meta', 'spacer', 'quotemark'];

export type DecorShape =
    | 'circle' | 'ring' | 'blob' | 'rect' | 'pill' | 'arc' | 'dots' | 'grid' | 'lines'
    | 'wave' | 'spark' | 'star' | 'arrow' | 'cross' | 'triangle' | 'halftone' | 'bignum';
export const DECOR_SHAPES: DecorShape[] = ['circle', 'ring', 'blob', 'rect', 'pill', 'arc', 'dots', 'grid', 'lines', 'wave', 'spark', 'star', 'arrow', 'cross', 'triangle', 'halftone', 'bignum'];

/** A background decoration in slide coordinates (0–100 = % of width/height). */
export interface Decor {
    shape: DecorShape;
    x: number;
    y: number;
    /** Width in % of slide width. */
    w: number;
    /** Height in % of slide width (defaults to w, i.e. square). */
    h?: number;
    color: ColorRole;
    opacity?: number;
    rotate?: number;
    /** Outline instead of fill (circle, rect, pill, triangle, star). */
    outline?: boolean;
    /** Drawn above the content (small accents only). */
    front?: boolean;
}

export interface SlideBackground {
    kind: 'solid' | 'gradient' | 'spot' | 'frame';
    color?: ColorRole;
    color2?: ColorRole;
    angle?: number;
}

export type Direction = 'editorial' | 'bold' | 'minimal' | 'playful' | 'tech' | 'corporate' | 'magazine' | 'brutalist';
export const DIRECTIONS: Direction[] = ['editorial', 'bold', 'minimal', 'playful', 'tech', 'corporate', 'magazine', 'brutalist'];

export type FontPairId =
    | 'modern' | 'editorial' | 'classic' | 'warm' | 'poster' | 'condensed'
    | 'tech' | 'friendly' | 'geometric' | 'elegant' | 'agency' | 'brutal';

export interface DesignStyle {
    direction: Direction;
    fonts: FontPairId;
    radius: 'none' | 'sm' | 'md' | 'lg';
    headingCase: 'none' | 'upper';
    density: 'airy' | 'normal' | 'dense';
    /** Default accent treatment for headlines. */
    mark: MarkStyle;
}

export interface SlideDesign {
    v: 1;
    style: DesignStyle;
    bg: SlideBackground;
    root: StackNode;
    decor?: Decor[];
    /** Layout-library id this design started from (for shuffle / analytics). */
    archetype?: string;
    /** Variation seed used by the layout library. */
    seed?: number;
    /** Whole slide filled with a strong color for rhythm (kept when shuffling). */
    invert?: 'accent' | 'ink';
    /** Composed by the AI (a custom tree, stored in full) rather than taken from the layout library. */
    composed?: boolean;
}

/**
 * How a library design is stored: just the recipe. The tree is rebuilt at
 * render time from the slide's current words, so edits re-balance the layout
 * (and a deck of recipes stays tiny in the database).
 */
export interface DesignRef {
    v: 1;
    ref: true;
    style: DesignStyle;
    archetype: string;
    seed?: number;
    invert?: 'accent' | 'ink';
}

export type StoredDesign = SlideDesign | DesignRef;

export const isDesignRef = (d: unknown): d is DesignRef =>
    !!d && typeof d === 'object' && (d as any).ref === true && typeof (d as any).archetype === 'string';

/** What the renderer needs to know about the slide's content (field → text). */
export interface CanvasContent {
    blockType: string;
    preHeader?: string;
    headline?: string;
    body?: string;
    footer?: string;
    statNumber?: string;
    statLabel?: string;
    quoteAuthor?: string;
    splitLeft?: string;
    splitRight?: string;
    accentPhrase?: string;
    listItems?: string[];
    extras?: Record<string, string>;
    icon?: string;
    doodleUrl?: string;
}
