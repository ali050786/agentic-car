/**
 * Studio-side Canvas (template-5) operations on slide data. Pure functions:
 * the caller writes the result to the store and autosave persists it.
 *
 * Library layouts are stored as recipes (archetype + seed), composed layouts
 * as full trees; see core/design/canvas/index.ts → toStoredDesign.
 */

import type { SlideContent } from '../../types';
import type { DesignStyle, Direction, FontPairId, MarkStyle, SlideDesign, StoredDesign } from '../../core/design/canvas/types';
import { isDesignRef } from '../../core/design/canvas/types';
import {
    archetypesFor, canvasContentOf, deckStyleOf, defaultStyle, designDeck, designFor, designSlide, hashString, heuristicStyle, shuffleDesign, styleOf, toStoredDesign,
} from '../../core/design/canvas';
import { slideToLayout } from '../../utils/slideMigration';

type AnySlide = SlideContent & { design?: StoredDesign };

const layoutsOf = (slides: AnySlide[]) => slides.map((s) => slideToLayout(s as any));

/** The deck's current look (what most slides use). */
export const currentDeckStyle = (slides: AnySlide[], topic = ''): DesignStyle =>
    deckStyleOf(slides) || heuristicStyle(topic);

/** Gives every slide without a Canvas layout one from the library (deck-aware variety). */
export const ensureDeckDesigns = (slides: AnySlide[], topic = ''): AnySlide[] | null => {
    if (!slides.length || slides.every((s) => s.design && typeof s.design === 'object')) return null;
    const style = currentDeckStyle(slides, topic);
    const layouts = layoutsOf(slides);
    const designs = designDeck(layouts.map((l) => ({ blockType: l.blockType, content: canvasContentOf(l) })), style, hashString(topic || layouts[0]?.slots?.headline || 'deck'));
    return slides.map((s, i) => (s.design && typeof s.design === 'object' ? s : { ...s, design: toStoredDesign(designs[i]) }));
};

/** A new look for the whole deck: fresh library layouts in that direction (instant, no model). */
export const restyleDeck = (slides: AnySlide[], direction: Direction, topic = '', keep?: Partial<DesignStyle>): AnySlide[] => {
    const style: DesignStyle = { ...defaultStyle(direction), ...(keep || {}) };
    const layouts = layoutsOf(slides);
    const seed = hashString(`${topic}:${direction}:${slides.length}`);
    const designs = designDeck(layouts.map((l) => ({ blockType: l.blockType, content: canvasContentOf(l) })), style, seed);
    return slides.map((s, i) => ({ ...s, design: toStoredDesign(designs[i]) }));
};

/** Deck settings that don't change layouts: fonts, corners, headline accent, heading case. */
export const patchDeckStyle = (slides: AnySlide[], patch: { fonts?: FontPairId; radius?: DesignStyle['radius']; mark?: MarkStyle; headingCase?: DesignStyle['headingCase'] }, topic = ''): AnySlide[] => {
    const base = currentDeckStyle(slides, topic);
    const style: DesignStyle = { ...base, ...patch };
    const withDesigns = ensureDeckDesigns(slides, topic) || slides;
    return withDesigns.map((s) => ({ ...s, design: { ...(s.design as StoredDesign), style } as StoredDesign }));
};

/** "Shuffle layout": the next library layout for this slide's content. */
export const shuffleSlide = (slide: AnySlide, index: number, deckStyle: DesignStyle): AnySlide => {
    const layout = slideToLayout(slide as any);
    const current: SlideDesign = designFor(layout, index + 1, deckStyle);
    const next = shuffleDesign(current, layout.blockType, canvasContentOf(layout), deckStyle);
    return { ...slide, design: toStoredDesign({ ...next, invert: current.invert }) };
};

/** Toggles the slide's full-color moment (accent fill). */
export const toggleInvert = (slide: AnySlide, index: number, deckStyle: DesignStyle): AnySlide => {
    const layout = slideToLayout(slide as any);
    const stored = slide.design;
    const on = !!(stored && (stored as any).invert);
    if (stored && !isDesignRef(stored) && (stored as SlideDesign).root) {
        const d = stored as SlideDesign;
        const next: SlideDesign = on
            ? { ...d, invert: undefined, bg: { kind: 'solid' } }
            : { ...d, invert: 'accent', bg: { kind: 'solid', color: 'accent' } };
        return { ...slide, design: next };
    }
    const current = designFor(layout, index + 1, deckStyle);
    if (on) return { ...slide, design: toStoredDesign({ ...current, invert: undefined }) };
    // Only some layouts carry a full-color fill well: switch to one if needed.
    const content = canvasContentOf(layout);
    const options = archetypesFor(layout.blockType, content);
    const target = options.find((a) => a.id === current.archetype && a.invertible) || options.find((a) => a.invertible);
    if (!target) return slide;
    const next = designSlide(layout.blockType, content, deckStyle, { archetype: target.id, seed: current.seed, invert: 'accent', index });
    return { ...slide, design: toStoredDesign(next) };
};

/** Whether this slide's content has a layout that can take a full-color fill. */
export const canInvert = (slide: AnySlide | undefined): boolean => {
    if (!slide) return false;
    const layout = slideToLayout(slide as any);
    return archetypesFor(layout.blockType, canvasContentOf(layout)).some((a) => a.invertible);
};

export const isInverted = (slide: AnySlide | undefined) => !!(slide?.design && (slide.design as any).invert);

export const styleOfSlide = (slide: AnySlide | undefined, fallback: DesignStyle) => styleOf(slide?.design, fallback);
