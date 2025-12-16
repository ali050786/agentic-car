import { SlideContent, CarouselTheme, CarouselFormat } from '../types';
import { optimizeSvgForFigma } from './figmaOptimizer';

/**
 * Trigger a download of the SVG file for a specific slide.
 */
export const downloadSvg = async (slide: SlideContent, templateId: string, index: number, theme: CarouselTheme | null) => {
  // Get selectedPattern and patternOpacity from carousel store
  const { useCarouselStore } = await import('../store/useCarouselStore.ts');
  const { selectedPattern, patternOpacity } = useCarouselStore.getState();

  // Use Satori to generate the clean SVG
  const svgString = await optimizeSvgForFigma(slide, theme, templateId, undefined, undefined, selectedPattern, patternOpacity);

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `carousel-${templateId}-slide-${index + 1}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Download all slides with a small delay to prevent browser blocking.
 */
export const downloadAllSvgs = async (slides: SlideContent[], templateId: string) => {
  // Dynamic import to avoid circular dependency
  const { useCarouselStore } = await import('../store/useCarouselStore.ts');
  const theme = useCarouselStore.getState().theme;

  for (let i = 0; i < slides.length; i++) {
    await downloadSvg(slides[i], templateId, i, theme);
    // Small delay to prevent browser blocking
    await new Promise(r => setTimeout(r, 300));
  }
};

/**
 * Export slide as JPG by capturing the rendered SVG content
 */
export const exportToJpg = async (
  svgContainerElement: HTMLElement,
  index: number,
  selectedFormat: CarouselFormat
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Wait for fonts to load
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 1000)); // Increased wait time for fonts

      // Determine dimensions based on format
      const width = 1080;
      const height = selectedFormat === 'square' ? 1080 : 1350;

      // Find the actual SVG element in the container
      const svgElement = svgContainerElement.querySelector('svg');

      if (!svgElement) {
        throw new Error('No SVG element found in container');
      }

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;

      // Ensure SVG has proper dimensions and viewBox
      clonedSvg.setAttribute('width', width.toString());
      clonedSvg.setAttribute('height', height.toString());
      clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      // Find and update style tags to ensure fonts are loaded
      const styleTags = clonedSvg.querySelectorAll('style');
      styleTags.forEach(styleTag => {
        if (styleTag.textContent) {
          // Keep @import statements - they should work in SVG
          styleTag.textContent = styleTag.textContent;
        }
      });

      // Serialize the SVG to string
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvg);

      // Ensure proper XML namespace
      if (!svgString.includes('xmlns=')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // Create blob and URL
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS

      img.onload = () => {
        try {
          // Fill white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);

          // Convert to JPG
          canvas.toBlob((jpgBlob) => {
            if (!jpgBlob) {
              reject(new Error('Failed to create JPG blob'));
              return;
            }

            const link = document.createElement('a');
            link.download = `carousel-slide-${index + 1}.jpg`;
            link.href = URL.createObjectURL(jpgBlob);
            link.click();
            URL.revokeObjectURL(link.href);

            resolve();
          }, 'image/jpeg', 0.95);
        } catch (drawError) {
          console.error('Canvas drawing error:', drawError);
          URL.revokeObjectURL(url);
          reject(new Error('Failed to draw image to canvas'));
        }
      };

      img.onerror = (error) => {
        console.error('Image load error:', error);
        console.error('SVG content:', svgString.substring(0, 500) + '...');
        URL.revokeObjectURL(url);
        reject(new Error('Failed to render SVG to image. This may be due to external resources (fonts/images) not loading.'));
      };

      img.src = url;

    } catch (error) {
      console.error('Export error:', error);
      reject(error);
    }
  });
};