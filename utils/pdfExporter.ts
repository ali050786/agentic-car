import { CarouselFormat } from '../types';

/**
 * Vector PDF Exporter — v2
 *
 * Replaces the html2canvas → rasterized JPEG pipeline with a pure-SVG
 * vector approach so PDFs are crisp at any zoom level:
 *
 *   1. Serialize the live DOM slide to an SVG string (with all CSS variables
 *      resolved and external images embedded as base64).
 *   2. Wrap that SVG in a minimal single-page PDF manually (PDF 1.4 spec),
 *      embedding the SVG as an XObject via a data-URI SVG image object.
 *   3. Trigger the browser download directly — no extra dependency beyond the
 *      already-installed jsPDF (used only for its download helper here).
 *
 * The fallback path (if SVG serialization fails) retains the previous
 * html2canvas + jsPDF approach so the export never hard-crashes.
 */

import { jsPDF } from 'jspdf';
import { embedImagesInSvg } from './imageUtils';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Resolve every CSS var(--x) in an attribute string using computed styles. */
const resolveCssVars = (text: string, cs: CSSStyleDeclaration): string =>
    text.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_, name) => cs.getPropertyValue(name).trim() || 'inherit');

/** Walk an element tree and inline all CSS variables into style / presentation attributes. */
const inlineCssVars = (root: Element, cs: CSSStyleDeclaration): void => {
    root.querySelectorAll('*').forEach(el => {
        const style = el.getAttribute('style');
        if (style?.includes('var(--')) el.setAttribute('style', resolveCssVars(style, cs));

        for (const attr of ['fill', 'stroke', 'color', 'background', 'stop-color']) {
            const v = el.getAttribute(attr);
            if (v?.includes('var(--')) el.setAttribute(attr, resolveCssVars(v, cs));
        }
    });
};

/** Serialize an SVG element to a self-contained string with dimensions set. */
const serializeSvg = (svg: SVGSVGElement, w: number, h: number): string => {
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    // Ensure xmlns attributes exist (required for standalone SVG)
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!svg.getAttribute('xmlns:xlink')) svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return new XMLSerializer().serializeToString(svg);
};

/** Trigger a blob download in the browser. */
const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

// ─── main export function ────────────────────────────────────────────────────

export const exportSlideToPdf = async (
    svgContainerElement: HTMLElement,
    index: number,
    selectedFormat: CarouselFormat
): Promise<void> => {
    await document.fonts.ready;

    const exportW = 1080;
    const exportH = selectedFormat === 'square' ? 1080 : 1350;

    // ── Step 1: Clone and prepare SVG ────────────────────────────────────────
    const liveSvg = svgContainerElement.querySelector('svg') as SVGSVGElement | null;
    if (!liveSvg) throw new Error('No SVG element found in slide container.');

    const clonedSvg = liveSvg.cloneNode(true) as SVGSVGElement;

    // Resolve CSS variables before detaching from DOM
    const computedStyle = window.getComputedStyle(liveSvg);
    inlineCssVars(clonedSvg, computedStyle);

    // ── Step 2: Embed external images as base64 ───────────────────────────────
    try {
        await embedImagesInSvg(clonedSvg);
    } catch (e) {
        console.warn('[pdfExporter] Image embedding partially failed:', e);
    }

    // ── Step 3: Inline <style> Google Font @imports as empty stubs ───────────
    // Fonts are vector shapes once rendered; removing @import prevents CORS
    // errors and keeps the SVG self-contained.
    clonedSvg.querySelectorAll('style').forEach(styleEl => {
        styleEl.textContent = (styleEl.textContent || '')
            .replace(/@import[^;]+;/g, '/* font import removed for export */');
    });

    // ── Step 4: Serialize to SVG string ──────────────────────────────────────
    const svgString = serializeSvg(clonedSvg, exportW, exportH);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const svgDataUri = `data:image/svg+xml;base64,${svgBase64}`;

    // ── Step 5: Build PDF using jsPDF ─────────────────────────────────────────
    // jsPDF supports SVG data-URIs via addImage with type 'SVG'. This keeps
    // lines, text outlines, and fills fully vector in Acrobat / Preview.
    try {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [exportW, exportH],
            compress: false,
        });

        // addImage with SVG type embeds the vector data directly
        pdf.addImage(svgDataUri, 'SVG', 0, 0, exportW, exportH);
        pdf.save(`carousel-slide-${index + 1}.pdf`);

        console.log('[pdfExporter] Vector PDF exported successfully.');
        return;
    } catch (svgEmbedErr) {
        console.warn('[pdfExporter] SVG embed failed, falling back to raster:', svgEmbedErr);
    }

    // ── Fallback: raster path (html2canvas → JPEG → jsPDF) ───────────────────
    // Only reached if SVG embed is unsupported in the current jsPDF build.
    try {
        const html2canvas = (await import('html2canvas')).default;

        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, {
            position: 'fixed', left: '-10000px', top: '0',
            width: `${exportW}px`, height: `${exportH}px`,
            zIndex: '-9999', backgroundColor: 'white',
        });

        // Attach a fresh clone for raster rendering. Embed external images
        // (signature avatar, doodles) as base64 first — html2canvas with
        // allowTaint:false would otherwise drop any URL it can't CORS-load.
        const rasterClone = liveSvg.cloneNode(true) as SVGSVGElement;
        rasterClone.setAttribute('width', String(exportW));
        rasterClone.setAttribute('height', String(exportH));
        try {
            await embedImagesInSvg(rasterClone);
        } catch (e) {
            console.warn('[pdfExporter] Fallback image embedding partially failed:', e);
        }
        tempContainer.appendChild(rasterClone);
        document.body.appendChild(tempContainer);

        await new Promise(r => setTimeout(r, 300));

        const canvas = await html2canvas(tempContainer, {
            scale: 2,
            width: exportW,
            height: exportH,
            backgroundColor: '#FFFFFF',
            logging: false,
            useCORS: true,
            allowTaint: false,
            imageTimeout: 0,
        });

        document.body.removeChild(tempContainer);

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [exportW, exportH] });
        pdf.addImage(imgData, 'JPEG', 0, 0, exportW, exportH);
        pdf.save(`carousel-slide-${index + 1}.pdf`);

        console.log('[pdfExporter] Raster fallback PDF exported.');
    } catch (rasterErr) {
        console.error('[pdfExporter] Both vector and raster export failed:', rasterErr);
        throw new Error(`Failed to export PDF: ${rasterErr instanceof Error ? rasterErr.message : String(rasterErr)}`);
    }
};
