import type { VercelRequest, VercelResponse } from '@vercel/node';
import { htmlToReadableText, extractTitle } from '../utils/htmlToText';
import { MAX_SOURCE_CONTENT_CHARS } from '../config/constants';
import https from 'https';

/**
 * A highly resilient fetch helper that:
 * 1. Enforces a timeout (6 seconds) to prevent Vercel platform-level timeouts
 * 2. Uses native global fetch if available
 * 3. Safely falls back to the native HTTPS Node module if fetch throws or is missing
 */
const robustFetch = async (
    url: string,
    headers: Record<string, string>,
    timeoutMs = 6000
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; headers: { get: (name: string) => string | null } }> => {
    if (typeof fetch === 'function') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers
            });
            clearTimeout(timeoutId);
            return {
                ok: response.ok,
                status: response.status,
                text: () => response.text(),
                headers: {
                    get: (name: string) => response.headers.get(name)
                }
            };
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (!(err instanceof ReferenceError)) {
                throw err;
            }
        }
    }

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers
        };

        const timer = setTimeout(() => {
            req.destroy();
            reject(new Error('Request timed out'));
        }, timeoutMs);

        const req = https.request(options, (res) => {
            clearTimeout(timer);
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
                    status: res.statusCode ?? 0,
                    text: async () => data,
                    headers: {
                        get: (name: string) => {
                            const val = res.headers[name.toLowerCase()];
                            return Array.isArray(val) ? val.join(', ') : (val || null);
                        }
                    }
                });
            });
        });

        req.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });

        req.end();
    });
};

/**
 * Vercel Serverless Function: Article Scraper
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

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        const upstream = await robustFetch(parsed.toString(), headers);
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
