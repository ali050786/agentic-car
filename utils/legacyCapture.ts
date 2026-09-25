/**
 * The older export capture (html2canvas), kept as a fallback. See slideRaster.ts.
 */

import { CarouselFormat } from '../types';
import { embedImagesInSvg } from './imageUtils';
import html2canvas from 'html2canvas';

/**
 * Replace CSS variables with computed values in a string
 */
const replaceCssVariables = (cssText: string, computedStyle: CSSStyleDeclaration): string => {
    return cssText.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (match, varName) => {
        const value = computedStyle.getPropertyValue(varName);
        return value || match;
    });
};

/**
 * Apply computed colors to all elements recursively
 */
const applyComputedColors = (element: Element, rootElement: HTMLElement) => {
    const computedStyle = window.getComputedStyle(rootElement);

    const allElements = element.querySelectorAll('*');
    allElements.forEach((el) => {
        const styleAttr = el.getAttribute('style');
        if (styleAttr && styleAttr.includes('var(--')) {
            const replaced = replaceCssVariables(styleAttr, computedStyle);
            el.setAttribute('style', replaced);
        }

        ['fill', 'stroke', 'color'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && val.includes('var(--')) {
                const replaced = replaceCssVariables(val, computedStyle);
                el.setAttribute(attr, replaced);
            }
        });
    });
};

/**
 * Capture a slide with html2canvas (redraws the slide itself, so it can
 * differ from the screen). Kept only as a fallback for browsers that refuse
 * the native capture in slideRaster.ts.
 */
export const captureWithHtml2canvas = async (
    svgContainerElement: HTMLElement,
    selectedFormat: CarouselFormat
): Promise<HTMLCanvasElement> => {
    const width = 1080;
    const height = selectedFormat === 'square' ? 1080 : 1350;

    const rootComputedStyle = window.getComputedStyle(svgContainerElement);
    const clonedSlide = svgContainerElement.cloneNode(true) as HTMLElement;

    const svgElement = clonedSlide.querySelector('svg') as SVGElement;
    if (!svgElement) {
        throw new Error('No SVG element found');
    }

    // Extract foreignObjects
    const foreignObjects = Array.from(svgElement.querySelectorAll('foreignObject'));
    const extractedDivs: HTMLDivElement[] = [];

    foreignObjects.forEach((fo, idx) => {
        const x = parseFloat(fo.getAttribute('x') || '0');
        const y = parseFloat(fo.getAttribute('y') || '0');
        const foWidth = parseFloat(fo.getAttribute('width') || '0');
        const foHeight = parseFloat(fo.getAttribute('height') || '0');

        const content = fo.querySelector('div');
        if (content) {
            const extractedDiv = content.cloneNode(true) as HTMLDivElement;
            extractedDiv.style.position = 'absolute';
            extractedDiv.style.left = `${x}px`;
            extractedDiv.style.top = `${y}px`;
            extractedDiv.style.width = `${foWidth}px`;
            extractedDiv.style.height = `${foHeight}px`;
            extractedDiv.style.zIndex = `${100 + idx}`;

            const styleAttr = extractedDiv.getAttribute('style');
            if (styleAttr) {
                extractedDiv.setAttribute('style', replaceCssVariables(styleAttr, rootComputedStyle));
            }

            applyComputedColors(extractedDiv, svgContainerElement);
            extractedDivs.push(extractedDiv);
        }

        fo.remove();
    });

    // Embed external images as base64 to ensure they render in PDF
    try {
        await embedImagesInSvg(svgElement);
        await Promise.all(extractedDivs.map(div => embedImagesInSvg(div)));
    } catch (e) {
        console.warn('Error embedding images:', e);
    }

    applyComputedColors(svgElement, svgContainerElement);

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.overflow = 'hidden';

    // The SVG viewBox and the export canvas can differ (e.g. 1080x1380 vs 1080x1350).
    // Rendering the SVG at canvas size scales the SVG layer but NOT the extracted divs,
    // so their coordinates drift apart. Instead, build a stage at viewBox size where
    // both layers share the same pixel space, then scale the whole stage uniformly.
    const viewBoxParts = (svgElement.getAttribute('viewBox') || `0 0 ${width} ${height}`)
        .split(/[\s,]+/).map(Number);
    const vbW = viewBoxParts[2] || width;
    const vbH = viewBoxParts[3] || height;
    const stageScale = Math.min(width / vbW, height / vbH);

    const stage = document.createElement('div');
    stage.style.position = 'absolute';
    stage.style.left = `${(width - vbW * stageScale) / 2}px`;
    stage.style.top = `${(height - vbH * stageScale) / 2}px`;
    stage.style.width = `${vbW}px`;
    stage.style.height = `${vbH}px`;
    stage.style.transform = `scale(${stageScale})`;
    stage.style.transformOrigin = '0 0';

    svgElement.setAttribute('width', vbW.toString());
    svgElement.setAttribute('height', vbH.toString());
    svgElement.style.position = 'absolute';
    svgElement.style.left = '0';
    svgElement.style.top = '0';
    svgElement.style.zIndex = '0';
    svgElement.style.width = `${vbW}px`;
    svgElement.style.height = `${vbH}px`;

    stage.appendChild(svgElement);
    extractedDivs.forEach(div => stage.appendChild(div));
    wrapper.appendChild(stage);

    // Create temp container
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-10000px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${width}px`;
    tempContainer.style.height = `${height}px`;
    tempContainer.style.zIndex = '-9999';
    tempContainer.style.backgroundColor = 'white';

    tempContainer.appendChild(wrapper);
    document.body.appendChild(tempContainer);

    await new Promise(r => setTimeout(r, 500));

    const canvas = await html2canvas(tempContainer, {
        scale: 1,
        width: width,
        height: height,
        backgroundColor: '#FFFFFF',
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 0,
        removeContainer: false,
    });

    document.body.removeChild(tempContainer);

    return canvas;
};
