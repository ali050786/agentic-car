/**
 * Minimal HTML -> readable text extraction for server-side article scraping.
 * Runs in Node (Vite middleware + Vercel function) where there's no DOM —
 * regex-based, good enough for "get the article body text", not full
 * Readability parity. Shared by vite.config.ts's /api/scrape middleware and
 * api/scrape.ts so the two never drift.
 */

export const extractTitle = (html: string): string => {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? decodeEntities(match[1]).trim() : '';
};

const decodeEntities = (s: string): string => s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

export const htmlToReadableText = (html: string): string => {
    const text = html
        // Strip non-content blocks entirely
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
        // Turn block-level closing tags into newlines so paragraphs don't run together
        .replace(/<\/(p|div|h[1-6]|li|br|section|article)>/gi, '\n')
        // Strip all remaining tags
        .replace(/<[^>]+>/g, ' ');

    return decodeEntities(text)
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
