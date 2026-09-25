import { CarouselFormat } from '../types';
import { jsPDF } from 'jspdf';
import { exportSize, slideToCanvas } from './slideRaster';

/**
 * Export one slide as a single-page PDF, drawn by the browser exactly as on
 * screen (see slideRaster.ts), at 2× for sharp text.
 */
export const exportSlideToPdf = async (
    svgContainerElement: HTMLElement,
    index: number,
    selectedFormat: CarouselFormat
): Promise<void> => {
    try {
        const { width, height } = exportSize(selectedFormat);
        const canvas = await slideToCanvas(svgContainerElement, selectedFormat, 2);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height], compress: true });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, width, height, undefined, 'FAST');
        pdf.save(`carousel-slide-${index + 1}.pdf`);
    } catch (error) {
        console.error('PDF export error:', error);
        throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
