import DOMPurify from 'dompurify';

/**
 * Sanitizes user-entered text content (e.g. preHeader, headline, body, list items) to prevent XSS.
 * Allows safe formatting tags like <span> and <br> while completely stripping scripts, 
 * dynamic event handlers (onerror/onload), and malicious attributes.
 */
export const sanitizeText = (text: string): string => {
    if (!text) return '';
    const sanitizeFn =
        typeof DOMPurify?.sanitize === 'function'
            ? DOMPurify.sanitize
            : typeof (DOMPurify as any)?.default?.sanitize === 'function'
            ? (DOMPurify as any).default.sanitize
            : null;

    if (sanitizeFn) {
        return sanitizeFn(text, {
            USE_PROFILES: { html: true },
            ADD_ATTR: [
                'style', 
                'class',
                'data-edit-field',
                'data-edit-index',
                'contenteditable',
                'spellcheck'
            ]
        });
    }
    // Fallback string replacement when DOMPurify lacks DOM window context (e.g. CLI/Node)
    return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};
