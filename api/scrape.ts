import type { VercelRequest, VercelResponse } from '@vercel/node';
import { htmlToReadableText, extractTitle } from '../utils/htmlToText.js';
import { MAX_SOURCE_CONTENT_CHARS } from '../config/constants.js';
import { verifySession } from '../lib/apiAuth.js';
import https from 'https';
import { isSafeUrl } from '../utils/urlSafety.js';

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
 * Rotating browser User-Agent pool — randomised per request to avoid
 * consistent fingerprinting by bot-detection systems.
 */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
];

const randomAgent = (): string =>
    USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/**
 * Stealth scraping strategies tried in order.
 * Each returns `{ html, title }` or throws so the next one is tried.
 */
type ScrapeResult = { html: string; contentType: string };

const scrapeStrategies: Array<(url: string) => Promise<ScrapeResult>> = [
    // Strategy 1: Standard browser-like GET (matches what most sites expect)
    async (url: string): Promise<ScrapeResult> => {
        const res = await robustFetch(url, {
            'User-Agent': randomAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { html: await res.text(), contentType: res.headers.get('content-type') || '' };
    },

    // Strategy 2: Googlebot impersonation — many sites whitelist crawlers
    async (url: string): Promise<ScrapeResult> => {
        const res = await robustFetch(url, {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'From': 'googlebot(at)googlebot.com',
        }, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { html: await res.text(), contentType: res.headers.get('content-type') || '' };
    },

    // Strategy 3: curl/wget-style minimal request — bypasses some JS-free bot gates
    async (url: string): Promise<ScrapeResult> => {
        const res = await robustFetch(url, {
            'User-Agent': 'curl/8.7.1',
            'Accept': '*/*',
        }, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { html: await res.text(), contentType: res.headers.get('content-type') || '' };
    },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Authenticate the user session
        let userId: string;
        try {
            const authResult = await verifySession(req);
            userId = authResult.userId;
        } catch (authErr: any) {
            console.warn('[Vercel API] Authentication failure in scraper:', authErr?.message || authErr);
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'A valid session token is required to access this service.'
            });
        }

        const target = (req.query.url as string) || '';

        let parsed: URL;
        try {
            parsed = new URL(target);
        } catch {
            return res.status(400).json({ error: 'Invalid url parameter' });
        }

        // Validate protocol
        if (!/^https?:$/.test(parsed.protocol)) {
            return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are supported.' });
        }

        // DNS-level SSRF validation check
        const safe = await isSafeUrl(parsed);
        if (!safe) {
            console.warn(`[SSRF Blocked] User ${userId} requested unsafe/local URL: ${target}`);
            return res.status(400).json({ error: 'Access to this URL is blocked for security reasons.' });
        }



        console.log(`[Vercel API] User ${userId} scraping URL: ${parsed.hostname}`);

        // Try each stealth strategy in sequence; stop on first success
        let html: string | null = null;
        let contentType = '';
        let lastError = '';

        for (const [i, strategy] of scrapeStrategies.entries()) {
            try {
                const result = await strategy(parsed.toString());
                html = result.html;
                contentType = result.contentType;
                console.log(`[Vercel API] Strategy ${i + 1} succeeded for ${parsed.hostname}`);
                break;
            } catch (err: any) {
                lastError = err?.message || String(err);
                console.warn(`[Vercel API] Strategy ${i + 1} failed for ${parsed.hostname}: ${lastError}`);
            }
        }

        if (!html) {
            return res.status(422).json({ error: `All scraping strategies failed: ${lastError}` });
        }
        if (!contentType.includes('html') && !contentType.includes('text')) {
            return res.status(415).json({ error: 'The requested URL did not return a readable text or HTML page.' });
        }

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
        return res.status(500).json({ error: 'Failed to scrape website content. Please try again later.' });
    }
}
