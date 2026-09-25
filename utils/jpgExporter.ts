import { CarouselFormat } from '../types';
import { slideToCanvas } from './slideRaster';

/**
 * Export one slide as a JPG (1080 × 1350, or 1080 × 1080 square), drawn by
 * the browser exactly as on screen (see slideRaster.ts).
 */
export const exportSlideToJpg = async (
  svgContainerElement: HTMLElement,
  index: number,
  selectedFormat: CarouselFormat
): Promise<void> => {
  try {
    const canvas = await slideToCanvas(svgContainerElement, selectedFormat, 1);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) throw new Error('Failed to create JPG');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `carousel-slide-${index + 1}.jpg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (error) {
    console.error('JPG export error:', error);
    throw new Error(`Failed to export JPG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
