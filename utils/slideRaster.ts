/**
 * Slide → canvas, drawn by the browser itself: the same engine that draws the
 * studio, so JPG and PDF exports match the screen (fonts, line breaks, fitted
 * text sizes, spacing, italics).
 *
 * A slide is an SVG with HTML inside (foreignObject). We clone the live
 * slide, inline everything it loads (Google Fonts files and images, as data
 * URLs, since an SVG drawn as an image can't fetch anything), and draw it
 * into a canvas at the export size.
 *
 * Page size: slides are 1080 × 1380 and exports 1080 × 1350 (LinkedIn's 4:5),
 * so the slide is scaled to cover the page and ~15px are trimmed top and
 * bottom (inside the margins), never letterboxed.
 *
 * If a browser refuses (an old Safari can mark such canvases as unreadable),
 * slideToCanvas falls back to the older html2canvas capture.
 */

import type { CarouselFormat } from '../types';
import { embedImagesInSvg } from './imageUtils';
import { captureWithHtml2canvas } from './legacyCapture';

export const exportSize = (format: CarouselFormat) => ({ width: 1080, height: format === 'square' ? 1080 : 1350 });

// ── fonts ────────────────────────────────────────────────────────────────

const cssCache = new Map<string, Promise<string>>();
const fileCache = new Map<string, Promise<string>>();

const cached = <T,>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> => {
    const hit = map.get(key);
    if (hit) return hit;
    const p = load().catch((err) => {
        map.delete(key);
        throw err;
    });
    map.set(key, p);
    return p;
};

const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });

const fetchText = (url: string) =>
    cached(cssCache, url, async () => {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`Font CSS ${res.status}`);
        return res.text();
    });

const fetchDataUrl = (url: string) =>
    cached(fileCache, url, async () => {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`Font file ${res.status}`);
        return blobToDataUrl(await res.blob());
    });

/** "U+0000-00FF, U+0131, U+02??" → ranges. */
const parseRanges = (spec: string): [number, number][] =>
    spec.split(',').map((part) => {
        const p = part.trim().replace(/^U\+/i, '');
        if (p.includes('-')) {
            const [a, b] = p.split('-');
            return [parseInt(a, 16), parseInt(b, 16)] as [number, number];
        }
        if (p.includes('?')) return [parseInt(p.replace(/\?/g, '0'), 16), parseInt(p.replace(/\?/g, 'F'), 16)] as [number, number];
        const v = parseInt(p, 16);
        return [v, v] as [number, number];
    }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));

const codePoints = (text: string): Set<number> => {
    const set = new Set<number>();
    for (const ch of `${text}${text.toUpperCase()}${text.toLowerCase()} 0123456789`) set.add(ch.codePointAt(0)!);
    return set;
};

const usesFamily = (markup: string, family: string) => {
    const f = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(['"]|&quot;)${f}\\1`).test(markup);
};

/**
 * @font-face rules for the families a slide uses, from the given Google Fonts
 * stylesheets, with each font file inlined. Only the unicode subsets the
 * slide's text needs are kept.
 */
const inlineFontCss = async (sheetUrls: string[], markup: string, text: string): Promise<string> => {
    const points = codePoints(text);
    const needs = (range: string | undefined) => !range || parseRanges(range).some(([a, b]) => {
        for (const cp of points) if (cp >= a && cp <= b) return true;
        return false;
    });
    const out: string[] = [];
    for (const url of sheetUrls) {
        let css = '';
        try {
            css = await fetchText(url);
        } catch (err) {
            console.warn('[export] font stylesheet not loaded:', url, err);
            continue;
        }
        const faces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
        const kept = faces.filter((face) => {
            const family = face.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/)?.[1]?.trim();
            return !!family && usesFamily(markup, family) && needs(face.match(/unicode-range:\s*([^;]+);/)?.[1]);
        });
        const inlined = await Promise.all(kept.map(async (face) => {
            const urls = Array.from(face.matchAll(/url\((['"]?)([^'")]+)\1\)/g)).map((m) => m[2]).filter((u) => !u.startsWith('data:'));
            let next = face;
            for (const u of urls) {
                try {
                    next = next.split(u).join(await fetchDataUrl(new URL(u, url).href));
                } catch (err) {
                    console.warn('[export] font file not loaded:', u, err);
                    return '';
                }
            }
            return next;
        }));
        out.push(...inlined.filter(Boolean));
    }
    return out.join('\n');
};

/** Google Fonts stylesheets a slide relies on: the app's own links first, then the slide's @imports (same order the page applies them). */
const fontSheets = (svg: SVGSVGElement): string[] => {
    const page = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')).map((l) => l.href);
    const own = Array.from(svg.querySelectorAll('style')).flatMap((st) =>
        Array.from((st.textContent || '').matchAll(/@import\s+url\((['"]?)([^'")]+)\1\)/g)).map((m) => m[2].replace(/&amp;/g, '&')));
    return Array.from(new Set([...page, ...own]));
};

// ── drawing ──────────────────────────────────────────────────────────────

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.decoding = 'sync';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Slide image failed to load'));
        img.src = src;
    });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RasterOptions {
    width: number;
    height: number;
    /** Pixel density (2 = retina-sharp text in PDFs). */
    scale?: number;
    background?: string;
}

/** The slide inside `source` (a container or the <svg>), drawn by the browser into a canvas. */
export const rasterizeSlide = async (source: Element, opts: RasterOptions): Promise<HTMLCanvasElement> => {
    const live = (source instanceof SVGSVGElement ? source : source.querySelector('svg')) as SVGSVGElement | null;
    if (!live) throw new Error('No slide found to export');
    const scale = opts.scale || 1;
    const W = Math.round(opts.width * scale);
    const H = Math.round(opts.height * scale);

    const svg = live.cloneNode(true) as SVGSVGElement;
    await document.fonts.ready;

    // 1. Images and fonts as data URLs.
    try {
        await embedImagesInSvg(svg);
    } catch (err) {
        console.warn('[export] some images could not be embedded:', err);
    }
    const sheets = fontSheets(svg);
    svg.querySelectorAll('style').forEach((st) => {
        st.textContent = (st.textContent || '').replace(/@import\s+url\([^)]*\)\s*;?/g, '');
    });
    const fontCss = await inlineFontCss(sheets, new XMLSerializer().serializeToString(svg), svg.textContent || '');
    if (fontCss) {
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = fontCss;
        svg.insertBefore(style, svg.firstChild);
    }

    // 2. Export size: cover the page (trim, never letterbox).
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const xml = new XMLSerializer().serializeToString(svg);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    const draw = () => {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = opts.background || '#FFFFFF';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
    };
    // Safari paints images inside foreignObject only from the second draw.
    draw();
    await wait(80);
    draw();
    // Throws if the browser marked the canvas unreadable (caller falls back).
    ctx.getImageData(0, 0, 1, 1);
    return canvas;
};

/** A slide as a canvas at export size: the browser's own drawing, or the older capture if that fails. */
export const slideToCanvas = async (source: HTMLElement, format: CarouselFormat, scale = 1): Promise<HTMLCanvasElement> => {
    const { width, height } = exportSize(format);
    try {
        return await rasterizeSlide(source, { width, height, scale });
    } catch (err) {
        console.warn('[export] native capture failed, using html2canvas:', err);
        return captureWithHtml2canvas(source, format);
    }
};
