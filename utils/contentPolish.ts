/**
 * Deterministic, zero-cost copy cleanup — runs on every generation and edit,
 * before the (optional, LLM-based) ProofreaderAgent pass. Fixes mechanical
 * issues a model reliably gets right without needing to ask one.
 */

import { SlideContent, ListItemObject } from '../types';

const collapseSpaces = (s: string): string => s.replace(/[ \t]{2,}/g, ' ');

const fixSpaceBeforePunctuation = (s: string): string => s.replace(/\s+([.,!?;:])/g, '$1');

const collapseRepeatedPunctuation = (s: string): string => s
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/\.{4,}/g, '...');

const normalizeQuotes = (s: string): string => s
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/(^|\s)'(\S)/g, '$1‘$2')
    .replace(/(\S)'(\s|$)/g, '$1’$2')
    .replace(/(^|\s)"(\S)/g, '$1“$2')
    .replace(/(\S)"(\s|$|[.,!?;:])/g, '$1”$2');

const baseClean = (s: string): string => {
    let out = collapseSpaces(s);
    out = fixSpaceBeforePunctuation(out);
    out = collapseRepeatedPunctuation(out);
    out = normalizeQuotes(out);
    return out.trim();
};

/** Short labels (headline, preHeader, list bullets) — cleaned up, never end in a period. */
const polishLabel = (s: string): string => baseClean(s).replace(/\.+$/, '');

/** Full sentences (body, list descriptions) — cleaned up, terminal punctuation enforced. */
const polishProse = (s: string): string => {
    const cleaned = baseClean(s);
    if (!cleaned) return cleaned;
    return /[.!?"'’”)]$/.test(cleaned) ? cleaned : `${cleaned}.`;
};

const polishListItem = (item: string | ListItemObject): string | ListItemObject => {
    if (typeof item === 'string') return polishProse(item);
    return {
        bullet: polishLabel(item.bullet),
        description: polishProse(item.description),
    };
};

export const polishSlides = (slides: SlideContent[]): SlideContent[] => {
    return slides.map(slide => ({
        ...slide,
        preHeader: slide.preHeader ? polishLabel(slide.preHeader) : slide.preHeader,
        headline: slide.headline ? polishLabel(slide.headline) : slide.headline,
        body: slide.body ? polishProse(slide.body) : slide.body,
        // Footers are often short CTAs ("Swipe ->") rather than sentences — clean up
        // spacing/quotes/punctuation runs only, don't force or strip terminal punctuation.
        footer: slide.footer ? baseClean(slide.footer) : slide.footer,
        listItems: slide.listItems ? slide.listItems.map(polishListItem) : slide.listItems,
    }));
};
