import { CarouselFormat } from '../types';
import { jsPDF } from 'jspdf';
import { exportSize, slideToCanvas } from './slideRaster';

/**
 * Export all slides as a multi-page PDF. Each page is the slide as the
 * browser draws it on screen (see slideRaster.ts), at 2× for sharp text.
 */
export const exportAllSlidesToPdf = async (
    slideElements: HTMLElement[],
    selectedFormat: CarouselFormat,
    onProgress?: (current: number, total: number) => void
): Promise<void> => {
    try {
        await document.fonts.ready;
        const { width, height } = exportSize(selectedFormat);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height], compress: true });

        for (let i = 0; i < slideElements.length; i++) {
            onProgress?.(i + 1, slideElements.length);
            const canvas = await slideToCanvas(slideElements[i], selectedFormat, 2);
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            if (i > 0) pdf.addPage([width, height], 'portrait');
            pdf.addImage(imgData, 'JPEG', 0, 0, width, height, undefined, 'FAST');
        }

        const timestamp = new Date().toISOString().split('T')[0];
        pdf.save(`carousel-all-slides-${timestamp}.pdf`);
    } catch (error) {
        console.error('Multi-page PDF export error:', error);
        throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
