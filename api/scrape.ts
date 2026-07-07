import type { VercelRequest, VercelResponse } from '@vercel/node';
import { htmlToReadableText, extractTitle } from '../utils/htmlToText';
import { MAX_SOURCE_CONTENT_CHARS } from '../config/constants';


/**
 * Vercel Serverless Function: Article Scraper
 *
 * Mirrors the /api/scrape Vite middleware in vite.config.ts. Same private-host
 * SSRF guard as proxy-image; strips scripts/styles/tags to plain text.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const target = (req.query.url as string) || '';

        let parsed: URL;
        try {
            parsed = new URL(target);
        } catch {
            return res.status(400).json({ error: 'Invalid url parameter' });
        }

        const hostname = parsed.hostname;
        const isPrivate = hostname === 'localhost' || /^(\d+\.){3}\d+$/.test(hostname) || hostname.endsWith('.local');
        if (!/^https?:$/.test(parsed.protocol) || isPrivate) {
            return res.status(400).json({ error: 'URL not allowed' });
        }

        const upstream = await fetch(parsed.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.includes('html') && !contentType.includes('text')) {
            return res.status(415).json({ error: 'That URL did not return a readable page' });
        }

        const html = await upstream.text();
        const fullText = htmlToReadableText(html);
        const content = fullText.slice(0, MAX_SOURCE_CONTENT_CHARS);

        if (content.length < 100) {
            return res.status(422).json({ error: 'Could not extract readable content from this page' });
        }

        return res.status(200).json({
            content,
            title: extractTitle(html),
            truncated: fullText.length > MAX_SOURCE_CONTENT_CHARS,
            originalLength: fullText.length,
        });
    } catch (e: any) {
        console.error('[Vercel API] scrape error:', e);
        return res.status(500).json({ error: e?.message || String(e) });
    }
}
