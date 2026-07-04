/**
 * Shared source-material size policy for the composer's file/text/URL/video
 * intake. Content flows through several sequential LLM calls, so its size
 * drives cost across the whole pipeline — capped consistently regardless of
 * where it came from, with the truncation always surfaced to the user
 * rather than applied silently.
 */

import { MAX_SOURCE_CONTENT_CHARS, MAX_UPLOAD_FILE_SIZE_BYTES } from '../config/constants';
import { formatFileSize } from './fileProcessor';

export { MAX_SOURCE_CONTENT_CHARS, MAX_UPLOAD_FILE_SIZE_BYTES };

export interface CappedContent {
    content: string;
    truncated: boolean;
    originalLength: number;
}

/** Truncates content to the shared cap, reporting whether it cut anything. */
export const capSourceContent = (content: string): CappedContent => {
    const originalLength = content.length;
    if (originalLength <= MAX_SOURCE_CONTENT_CHARS) {
        return { content, truncated: false, originalLength };
    }
    return { content: content.slice(0, MAX_SOURCE_CONTENT_CHARS), truncated: true, originalLength };
};

/** Throws a friendly error if the file is over the upload size limit. */
export const assertUploadSizeOk = (file: File): void => {
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        throw new Error(
            `${file.name} is ${formatFileSize(file.size)} — please upload a file under ${formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES)}.`
        );
    }
};

/** One line describing a truncation, for the chat run timeline. */
export const truncationNote = (originalLength: number): string =>
    `Using the first ${MAX_SOURCE_CONTENT_CHARS.toLocaleString()} of ${originalLength.toLocaleString()} characters`;
