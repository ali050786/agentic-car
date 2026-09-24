/**
 * Canvas: AI-composed slide layouts (template-5, "The Canvas").
 *
 * renderCanvasSlide() is what core/design/renderSlide.ts calls for template-5:
 * it turns a slide (content + optional design) into the same kind of SVG
 * string the classic templates produce, so every consumer (stage, thumbnails,
 * exports, share page) works unchanged.
 */

import type { BrandingConfig, CarouselFormat, CarouselTheme, SlideLayout } from '../../../types';
import type { CanvasContent, DesignRef, DesignStyle, SlideDesign, StackNode, StoredDesign } from './types';
import { isDesignRef } from './types';
import { renderCanvas } from './render';
import { ARCHETYPE_BY_ID, designSlide, hashString, toBlock } from './archetypes';
import { defaultStyle } from './tokens';
import { ensureCoverage, sanitizeStyle } from './lint';
import { generateSignatureCard } from '../../../utils/signatureCardGenerator';
import { generatePatternSVG } from '../../../utils/patternGenerator';

export * from './types';
export { renderCanvas, splitKey, firstNumber, readField } from './render';
export { designSlide, designDeck, shuffleDesign, chooseInversions, pickArchetype, archetypesFor, ARCHETYPES, ARCHETYPE_BY_ID, hashString, toBlock } from './archetypes';
export { lintDesign, ensureCoverage, estimateFill, sanitizeDecor, sanitizeExtras, sanitizeStyle } from './lint';
export { directionFromWords, heuristicStyle } from './style';
export { DIRECTION_PRESETS, FONT_PAIRS, FONT_PAIR_IDS, defaultStyle, resolvePalette, fontImportUrl } from './tokens';

const listItemText = (it: any): string => {
    if (typeof it === 'string') return it;
    if (it && typeof it === 'object') {
        const b = (it.bullet || '').trim();
        const d = (it.description || '').trim();
        return b && d ? `${b}: ${d}` : b || d;
    }
    return '';
};

/** Slide (IR) → the flat content map the Canvas renderer reads. */
export const canvasContentOf = (layout: SlideLayout): CanvasContent => {
    const s = layout.slots || {};
    return {
        blockType: layout.blockType || 'body',
        preHeader: s.preHeader,
        headline: s.headline,
        body: s.body,
        footer: s.footer,
        statNumber: s.statNumber,
        statLabel: s.statLabel,
        quoteAuthor: s.quoteAuthor,
        splitLeft: s.splitLeft,
        splitRight: s.splitRight,
        accentPhrase: s.accentPhrase,
        listItems: (s.listItems || []).map(listItemText).filter(Boolean),
        extras: s.extras,
        icon: layout.visual?.icon,
        doodleUrl: layout.visual?.doodleUrl,
    };
};

/** The style a stored design carries (repaired if it came back malformed). */
export const styleOf = (d: StoredDesign | undefined | null, fallback: DesignStyle = defaultStyle()): DesignStyle =>
    d && typeof d === 'object' ? sanitizeStyle((d as any).style, fallback) : fallback;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * The design a slide renders with.
 *  - a composed tree: used as is, plus any field the words gained since it was made;
 *  - a recipe (library layout): rebuilt from the slide's current words;
 *  - a design made for another kind of slide (e.g. the stat became a body slide): re-picked from the library;
 *  - nothing: a deterministic library layout.
 */
export const designFor = (layout: SlideLayout, slideNumber?: number, style?: DesignStyle): SlideDesign => {
    const stored = layout.design as StoredDesign | undefined;
    const content = canvasContentOf(layout);
    const block = toBlock(layout.blockType || 'body');
    const st = style || styleOf(stored);
    const madeFor = (id?: string) => (id ? ARCHETYPE_BY_ID.get(id)?.block : undefined);
    const seedOf = () => hashString(`${layout.blockType}:${slideNumber ?? 0}:${(content.headline || '').slice(0, 24)}`);

    if (stored && !isDesignRef(stored) && stored.root && stored.root.type === 'stack') {
        const archetypeBlock = madeFor(stored.archetype);
        if (!archetypeBlock || archetypeBlock === block) {
            const root = clone(stored.root) as StackNode;
            ensureCoverage(root, content, layout.blockType || 'body');
            return { ...stored, style: st, root, bg: stored.bg || { kind: 'solid' } };
        }
        return designSlide(layout.blockType, content, st, { seed: stored.seed ?? seedOf(), invert: stored.invert, index: (slideNumber || 1) - 1 });
    }
    if (stored && isDesignRef(stored)) {
        const same = madeFor(stored.archetype) === block;
        return designSlide(layout.blockType, content, st, {
            archetype: same ? stored.archetype : undefined,
            seed: stored.seed ?? seedOf(),
            invert: stored.invert,
            index: (slideNumber || 1) - 1,
        });
    }
    return designSlide(layout.blockType, content, st, { seed: seedOf(), index: (slideNumber || 1) - 1 });
};

// ── storage ───────────────────────────────────────────────────────────────

/** Library designs are stored as recipes; composed trees in full. */
export const toStoredDesign = (d: SlideDesign | DesignRef | undefined | null): StoredDesign | undefined => {
    if (!d || typeof d !== 'object') return undefined;
    if (isDesignRef(d)) return d;
    if (d.composed || !d.archetype) return d;
    const ref: DesignRef = { v: 1, ref: true, style: d.style, archetype: d.archetype };
    if (d.seed !== undefined) ref.seed = d.seed;
    if (d.invert) ref.invert = d.invert;
    return ref;
};

/** Composed designs → recipes, largest first, until the slides JSON fits `maxChars`. */
export const compactDesigns = <T extends { design?: StoredDesign }>(slides: T[], maxChars = 60_000): T[] => {
    let size = JSON.stringify(slides).length;
    if (size <= maxChars) return slides;
    const out = slides.map((s) => ({ ...s }));
    const order = out
        .map((s, i) => ({ i, n: s.design && !isDesignRef(s.design) ? JSON.stringify(s.design).length : 0 }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n);
    for (const { i } of order) {
        if (size <= maxChars) break;
        const d = out[i].design as SlideDesign;
        const ref: DesignRef | undefined = d.archetype ? { v: 1, ref: true, style: d.style, archetype: d.archetype, ...(d.seed !== undefined ? { seed: d.seed } : {}), ...(d.invert ? { invert: d.invert } : {}) } : undefined;
        const before = JSON.stringify(d).length;
        out[i].design = ref;
        size -= before - (ref ? JSON.stringify(ref).length : 0);
    }
    return out;
};

/** The deck's style: what most slides use (falls back to the default). */
export const deckStyleOf = (slides: { design?: StoredDesign }[]): DesignStyle | null => {
    const counts = new Map<string, { style: DesignStyle; n: number }>();
    for (const s of slides) {
        if (!s?.design || typeof s.design !== 'object') continue;
        const st = styleOf(s.design);
        const key = JSON.stringify(st);
        const e = counts.get(key);
        if (e) e.n++;
        else counts.set(key, { style: st, n: 1 });
    }
    let best: { style: DesignStyle; n: number } | null = null;
    for (const e of counts.values()) if (!best || e.n > best.n) best = e;
    return best ? best.style : null;
};

const escAttr = (s: string) => s.replace(/&/g, '&amp;');

export const renderCanvasSlide = (params: {
    layout: SlideLayout;
    theme: CarouselTheme | null;
    branding?: BrandingConfig;
    format?: CarouselFormat;
    patternId?: number;
    patternOpacity?: number;
    patternScale?: number;
    patternSpacing?: number;
    uniqueId?: string;
    slideNumber?: number;
    totalSlides?: number;
}): string => {
    const { layout, theme, branding, format } = params;
    const design = designFor(layout, params.slideNumber);
    const content = canvasContentOf(layout);
    const signature = branding && branding.enabled ? branding.position || 'bottom-left' : null;
    const uid = (params.uniqueId || 'cv').replace(/[^\w-]/g, '');
    const out = renderCanvas(design, content, {
        format: format === 'square' ? 'square' : 'portrait',
        theme,
        slideNumber: params.slideNumber,
        totalSlides: params.totalSlides,
        signature,
        editable: true,
        scopeId: uid,
    });
    const pal = out.palette;

    // User-chosen background pattern, subtler than on the classic templates
    // because Canvas layouts carry their own decoration.
    const patternOpacity = Math.max(0, Math.min(0.5, params.patternOpacity ?? 0.1)) * 0.6;
    let pattern = '';
    if (patternOpacity > 0.001) {
        pattern = generatePatternSVG(params.patternId || 1, params.patternScale, params.patternSpacing)
            .replace(/id="bgPattern"/g, `id="bgPattern-${uid}"`)
            .replace(/var\(--pattern-color\)/g, pal.ink)
            .replace(/var\(--pattern-opacity\)/g, '1');
    }
    const patternRect = pattern ? `<rect x="0" y="0" width="${out.width}" height="${out.height}" fill="url(#bgPattern-${uid})" opacity="${patternOpacity}"/>` : '';

    const signatureCard = branding && branding.enabled
        ? generateSignatureCard({ ...branding, position: signature || 'bottom-left' }, out.bodyFamily, format, uid, 'template-5', out.signatureColors)
        : '';

    return `
<svg viewBox="0 0 ${out.width} ${out.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-canvas="true">
  <defs>
    <style>
      @import url('${escAttr(out.fontImport)}');
      :root {
        --text-default: ${pal.inkSoft};
        --text-highlight: ${pal.ink};
        --background: ${pal.bg};
        --background-2: ${pal.accent};
        --pattern-color: ${pal.ink};
        --pattern-opacity: ${patternOpacity};
      }
    </style>
    ${out.defs}
    ${pattern}
    <clipPath id="cvClip-${uid}"><rect x="0" y="0" width="${out.width}" height="${out.height}"/></clipPath>
  </defs>
  <g clip-path="url(#cvClip-${uid})">
    ${out.background}
    ${patternRect}
    ${out.decor}
  </g>
  <foreignObject x="0" y="0" width="${out.width}" height="${out.height}">
    ${out.html}
  </foreignObject>
  ${signatureCard}
</svg>
`;
};
