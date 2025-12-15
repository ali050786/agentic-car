import { CarouselFormat } from '../types';
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

  // Process all elements (including SVG elements)
  const allElements = element.querySelectorAll('*');
  allElements.forEach((el) => {
    // Get style attribute
    const styleAttr = el.getAttribute('style');
    if (styleAttr && styleAttr.includes('var(--')) {
      const replaced = replaceCssVariables(styleAttr, computedStyle);
      el.setAttribute('style', replaced);
    }

    // Replace fill, stroke in SVG elements
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
 * Export slide as JPG using html2canvas.
 * Extracts foreignObject content as positioned divs for proper rendering.
 */
export const exportSlideToJpg = async (
  svgContainerElement: HTMLElement,
  index: number,
  selectedFormat: CarouselFormat
): Promise<void> => {
  let tempContainer: HTMLDivElement | null = null;

  try {
    // Wait for fonts to be fully loaded
    await document.fonts.ready;

    // Get dimensions
    const width = 1080;
    const height = selectedFormat === 'square' ? 1080 : 1350;

    // Get computed style from root to resolve CSS variables
    const rootComputedStyle = window.getComputedStyle(svgContainerElement);

    // Clone the slide element
    const clonedSlide = svgContainerElement.cloneNode(true) as HTMLElement;

    // Find SVG element
    const svgElement = clonedSlide.querySelector('svg') as SVGElement;
    if (!svgElement) {
      throw new Error('No SVG element found');
    }

    // Extract all foreignObject elements
    const foreignObjects = Array.from(svgElement.querySelectorAll('foreignObject'));
    const extractedDivs: HTMLDivElement[] = [];

    foreignObjects.forEach((fo, idx) => {
      const x = parseFloat(fo.getAttribute('x') || '0');
      const y = parseFloat(fo.getAttribute('y') || '0');
      const foWidth = parseFloat(fo.getAttribute('width') || '0');
      const foHeight = parseFloat(fo.getAttribute('height') || '0');

      // Extract the div content
      const content = fo.querySelector('div');
      if (content) {
        const extractedDiv = content.cloneNode(true) as HTMLDivElement;

        // Position absolutely with proper z-index
        extractedDiv.style.position = 'absolute';
        extractedDiv.style.left = `${x}px`;
        extractedDiv.style.top = `${y}px`;
        extractedDiv.style.width = `${foWidth}px`;
        extractedDiv.style.height = `${foHeight}px`;
        extractedDiv.style.zIndex = `${100 + idx}`;

        // Replace CSS variables in style attribute
        const styleAttr = extractedDiv.getAttribute('style');
        if (styleAttr) {
          const replaced = replaceCssVariables(styleAttr, rootComputedStyle);
          extractedDiv.setAttribute('style', replaced);
        }

        // Apply to all child elements
        applyComputedColors(extractedDiv, svgContainerElement);

        extractedDivs.push(extractedDiv);
      }

      // Remove foreignObject from SVG
      fo.remove();
    });

    // Replace CSS variables in SVG
    applyComputedColors(svgElement, svgContainerElement);

    // Create a wrapper container
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.overflow = 'hidden';

    // Style SVG to be a background layer
    svgElement.setAttribute('width', width.toString());
    svgElement.setAttribute('height', height.toString());
    svgElement.style.position = 'absolute';
    svgElement.style.left = '0';
    svgElement.style.top = '0';
    svgElement.style.zIndex = '0';
    svgElement.style.width = `${width}px`;
    svgElement.style.height = `${height}px`;

    // Add SVG first (z-index 0)
    wrapper.appendChild(svgElement);

    // Add extracted divs on top (z-index 100+)
    extractedDivs.forEach(div => {
      wrapper.appendChild(div);
    });

    // Create temporary off-screen container
    tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-10000px';
    tempContainer.style.top = '0';
    tempContainer.style.width = `${width}px`;
    tempContainer.style.height = `${height}px`;
    tempContainer.style.zIndex = '-9999';
    tempContainer.style.backgroundColor = 'white';

    tempContainer.appendChild(wrapper);
    document.body.appendChild(tempContainer);

    // Wait for rendering
    await new Promise(r => setTimeout(r, 500));

    // DEBUG: Log the structure
    console.log('=== RECONSTRUCTED STRUCTURE ===');
    console.log('Wrapper HTML (first 2000 chars):', wrapper.outerHTML.substring(0, 2000));
    console.log('Number of extracted divs:', extractedDivs.length);
    console.log('================================');

    // Capture the temporary container
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

    console.log('Canvas captured:', canvas.width, 'x', canvas.height);

    // Remove temp container
    document.body.removeChild(tempContainer);
    tempContainer = null;

    // Convert to JPG and download
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create JPG blob');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `carousel-slide-${index + 1}.jpg`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);

  } catch (error) {
    // Clean up
    if (tempContainer && document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }

    console.error('JPG export error:', error);
    throw new Error(`Failed to export JPG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
