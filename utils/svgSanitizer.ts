import DOMPurify from 'dompurify';

/**
 * Sanitizes user-entered text content (e.g. preHeader, headline, body, list items) to prevent XSS.
 * Allows safe formatting tags like <span> and <br> while completely stripping scripts, 
 * dynamic event handlers (onerror/onload), and malicious attributes.
 */
export const sanitizeText = (text: string): string => {
    if (!text) return '';
    return DOMPurify.sanitize(text, {
        USE_PROFILES: { html: true },
        ADD_ATTR: [
            'style', 
            'class',
            'data-edit-field',
            'data-edit-index',
            'contenteditable',
            'spellcheck'
        ] // Allow inline colors, alignment styles, and edit attributes
    });
};
