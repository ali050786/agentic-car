import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using the npm package instead of CDN
// This avoids CORS and network issues
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/**
 * Extracts text content from a PDF file
 * @param file - The PDF file to extract text from
 * @returns Promise resolving to the extracted text as a single string
 * @throws Error if the PDF is password-protected, corrupted, or unreadable
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    try {
        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load the PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Array to store text from all pages
        const textPages: string[] = [];

        // Iterate through all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
                // Get the page
                const page = await pdf.getPage(pageNum);

                // Extract text content
                const textContent = await page.getTextContent();

                // Join all text items from the page
                const pageText = textContent.items
                    .map((item: any) => {
                        // Handle both text items and marked content
                        if ('str' in item) {
                            return item.str;
                        }
                        return '';
                    })
                    .join(' ');

                // Add page text to array
                textPages.push(pageText);
            } catch (pageError) {
                console.warn(`Error extracting text from page ${pageNum}:`, pageError);
                // Continue with other pages even if one fails
                textPages.push(`[Error reading page ${pageNum}]`);
            }
        }

        // Join all pages with double line breaks
        const fullText = textPages.join('\n\n').trim();

        // Check if we extracted any meaningful text
        if (!fullText || fullText.length < 10) {
            throw new Error('No readable text found in PDF. The document may be image-based or empty.');
        }

        return fullText;

    } catch (error: any) {
        // Handle specific PDF.js errors
        if (error.name === 'PasswordException') {
            throw new Error('This PDF is password-protected. Please provide an unlocked version.');
        }

        if (error.name === 'InvalidPDFException') {
            throw new Error('Invalid PDF file. The file may be corrupted or not a valid PDF.');
        }

        if (error.name === 'MissingPDFException') {
            throw new Error('PDF file is empty or missing data.');
        }

        if (error.name === 'UnexpectedResponseException') {
            throw new Error('Unable to load PDF. The file may be corrupted.');
        }

        // Re-throw custom errors we created above
        if (error.message && error.message.includes('No readable text found')) {
            throw error;
        }

        // Generic error for other cases
        throw new Error(`Failed to extract text from PDF: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Validates if a file is a PDF based on its type and extension
 * @param file - The file to validate
 * @returns true if the file appears to be a PDF
 */
export function isPdfFile(file: File): boolean {
    const validTypes = ['application/pdf'];
    const validExtensions = ['.pdf'];

    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext =>
        file.name.toLowerCase().endsWith(ext)
    );

    return hasValidType || hasValidExtension;
}

/**
 * Gets a human-readable file size string
 * @param bytes - File size in bytes
 * @returns Formatted file size string (e.g., "2.5 MB")
 */
export function getFileSizeString(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}
