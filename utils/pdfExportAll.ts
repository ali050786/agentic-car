import { CarouselFormat } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
 * Capture a single slide element and return canvas
 */
const captureSlideToCanvas = async (
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

    applyComputedColors(svgElement, svgContainerElement);

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.overflow = 'hidden';

    svgElement.setAttribute('width', width.toString());
    svgElement.setAttribute('height', height.toString());
    svgElement.style.position = 'absolute';
    svgElement.style.left = '0';
    svgElement.style.top = '0';
    svgElement.style.zIndex = '0';
    svgElement.style.width = `${width}px`;
    svgElement.style.height = `${height}px`;

    wrapper.appendChild(svgElement);
    extractedDivs.forEach(div => wrapper.appendChild(div));

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

/**
 * Export all slides as a multi-page PDF
 */
export const exportAllSlidesToPdf = async (
    slideElements: HTMLElement[],
    selectedFormat: CarouselFormat,
    onProgress?: (current: number, total: number) => void
): Promise<void> => {
    try {
        await document.fonts.ready;

        const width = 1080;
        const height = selectedFormat === 'square' ? 1080 : 1350;

        // Create PDF with first page dimensions
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [width, height]
        });

        console.log(`Starting export of ${slideElements.length} slides...`);

        // Capture and add each slide
        for (let i = 0; i < slideElements.length; i++) {
            if (onProgress) {
                onProgress(i + 1, slideElements.length);
            }

            console.log(`Capturing slide ${i + 1}/${slideElements.length}`);

            const canvas = await captureSlideToCanvas(slideElements[i], selectedFormat);
            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            // Add new page for slides after the first
            if (i > 0) {
                pdf.addPage([width, height], 'portrait');
            }

            pdf.addImage(imgData, 'JPEG', 0, 0, width, height);

            // Small delay between slides
            await new Promise(r => setTimeout(r, 100));
        }

        // Save the PDF
        const timestamp = new Date().toISOString().split('T')[0];
        pdf.save(`carousel-all-slides-${timestamp}.pdf`);

        console.log('All slides exported successfully!');

    } catch (error) {
        console.error('Multi-page PDF export error:', error);
        throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
