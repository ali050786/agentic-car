import { extractTextFromPdf } from './pdfExtractor';
import mammoth from 'mammoth';

/**
 * Supported file types for upload
 */
export const SUPPORTED_FILE_TYPES = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    md: 'text/markdown',
    txt: 'text/plain',
};

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.md', '.txt'];

/**
 * Validates if a file is a supported document type
 * @param file - File to validate
 * @returns true if file type is supported
 */
export function isSupportedFile(file: File): boolean {
    // Check MIME type
    const supportedMimeTypes = Object.values(SUPPORTED_FILE_TYPES);
    if (supportedMimeTypes.includes(file.type)) {
        return true;
    }

    // Check file extension as fallback
    const fileName = file.name.toLowerCase();
    return SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));
}

/**
 * Gets human-readable file type description
 * @param file - File to describe
 * @returns File type description
 */
export function getFileTypeDescription(file: File): string {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) return 'PDF Document';
    if (fileName.endsWith('.docx')) return 'Word Document (DOCX)';
    if (fileName.endsWith('.doc')) return 'Word Document (DOC)';
    if (fileName.endsWith('.md')) return 'Markdown File';
    if (fileName.endsWith('.txt')) return 'Text File';

    return 'Document';
}

/**
 * Extracts text from a DOCX file
 * @param file - DOCX file
 * @returns Promise resolving to extracted text
 */
async function extractTextFromDocx(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        if (!result.value || result.value.trim().length === 0) {
            throw new Error('No text content found in the document');
        }

        return result.value.trim();
    } catch (error: any) {
        throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
}

/**
 * Extracts text from a DOC file (legacy Word format)
 * Note: DOC format is complex and may not always work perfectly
 * @param file - DOC file
 * @returns Promise resolving to extracted text
 */
async function extractTextFromDoc(file: File): Promise<string> {
    try {
        // Try using mammoth (it has some DOC support)
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        if (!result.value || result.value.trim().length === 0) {
            throw new Error('Could not extract text from DOC file. Please convert to DOCX or PDF format for better results.');
        }

        return result.value.trim();
    } catch (error: any) {
        throw new Error(`Failed to extract text from DOC: ${error.message}. Try converting to DOCX or PDF format.`);
    }
}

/**
 * Extracts text from a Markdown file
 * @param file - Markdown file
 * @returns Promise resolving to extracted text
 */
async function extractTextFromMarkdown(file: File): Promise<string> {
    try {
        const text = await file.text();

        if (!text || text.trim().length === 0) {
            throw new Error('Markdown file is empty');
        }

        // Return raw markdown (AI can understand markdown syntax)
        return text.trim();
    } catch (error: any) {
        throw new Error(`Failed to read Markdown file: ${error.message}`);
    }
}

/**
 * Extracts text from a plain text file
 * @param file - Text file
 * @returns Promise resolving to extracted text
 */
async function extractTextFromText(file: File): Promise<string> {
    try {
        const text = await file.text();

        if (!text || text.trim().length === 0) {
            throw new Error('Text file is empty');
        }

        return text.trim();
    } catch (error: any) {
        throw new Error(`Failed to read text file: ${error.message}`);
    }
}

/**
 * Extracts text from any supported file format
 * @param file - File to extract text from
 * @returns Promise resolving to extracted text
 */
export async function extractTextFromFile(file: File): Promise<string> {
    // Validate file
    if (!isSupportedFile(file)) {
        throw new Error(`Unsupported file type. Please upload: ${SUPPORTED_EXTENSIONS.join(', ')}`);
    }

    const fileName = file.name.toLowerCase();

    console.log(`[FileProcessor] Extracting text from: ${file.name} (${getFileTypeDescription(file)})`);

    try {
        let extractedText: string;

        // Route to appropriate extractor based on file extension
        if (fileName.endsWith('.pdf')) {
            extractedText = await extractTextFromPdf(file);
        } else if (fileName.endsWith('.docx')) {
            extractedText = await extractTextFromDocx(file);
        } else if (fileName.endsWith('.doc')) {
            extractedText = await extractTextFromDoc(file);
        } else if (fileName.endsWith('.md')) {
            extractedText = await extractTextFromMarkdown(file);
        } else if (fileName.endsWith('.txt')) {
            extractedText = await extractTextFromText(file);
        } else {
            throw new Error('Unable to determine file type');
        }

        console.log(`[FileProcessor] Successfully extracted ${extractedText.length} characters from ${file.name}`);

        return extractedText;

    } catch (error: any) {
        console.error('[FileProcessor] Error:', error);
        throw error;
    }
}

/**
 * Formats file size for display
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
