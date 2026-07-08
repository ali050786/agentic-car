import type { VercelRequest, VercelResponse } from '@vercel/node';
import { htmlToReadableText, extractTitle } from '../utils/htmlToText.js';
import { MAX_SOURCE_CONTENT_CHARS } from '../config/constants.js';
import { verifySession } from '../lib/apiAuth.js';
import https from 'https';
import dns from 'dns';
import { promisify } from 'util';

const resolveDns = promisify(dns.resolve);
const lookupDns = promisify(dns.lookup);

/**
 * Checks if a given IP belongs to a specified CIDR range.
 */
function ipInCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    
    if (ip.includes('.') && range.includes('.')) {
        const ipParts = ip.split('.').map(Number);
        const rangeParts = range.split('.').map(Number);
        
        let ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        let rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
        
        const mask = ~(2 ** (32 - bits) - 1);
        return (ipNum & mask) === (rangeNum & mask);
    }
    return false;
}

const PRIVATE_CIDRS = [
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '169.254.0.0/16',
    '0.0.0.0/8'
];

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF).
 * Resolves the host DNS and checks against private/loopback IP address ranges.
 */
async function isSafeUrl(urlObj: URL): Promise<boolean> {
    const hostname = urlObj.hostname;
    
    // Direct block of common local hostnames
    if (
        hostname === 'localhost' || 
        hostname.endsWith('.local') || 
        hostname.endsWith('.internal') ||
        hostname === '[::1]'
    ) {
        return false;
    }
    
    try {
        // Resolve host to IP addresses
        let ips: string[] = [];
        try {
            ips = await resolveDns(hostname);
        } catch {
            // Fallback lookup
            const result = await lookupDns(hostname);
            ips = [result.address];
        }
        
        for (const ip of ips) {
            // Check IPv4 CIDRs
            for (const cidr of PRIVATE_CIDRS) {
                if (ipInCidr(ip, cidr)) return false;
            }
            
            // Check IPv6 Private/Loopback prefixes
            if (ip.includes(':')) {
                const norm = ip.toLowerCase();
                if (
                    norm === '::1' || 
                    norm.startsWith('fc') || 
                    norm.startsWith('fd') || 
                    norm.startsWith('fe8') ||
                    norm.startsWith('fe9') ||
                    norm.startsWith('fea') ||
                    norm.startsWith('feb')
                ) {
                    return false;
                }
            }
        }
        return true;
    } catch {
        return false; // Reject unresolved hosts
    }
}

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

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        console.log(`[Vercel API] User ${userId} fetching URL: ${parsed.hostname}`);
        const upstream = await robustFetch(parsed.toString(), headers);
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `Upstream source returned status ${upstream.status}` });
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.includes('html') && !contentType.includes('text')) {
            return res.status(415).json({ error: 'The requested URL did not return a readable text or HTML page.' });
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
        return res.status(500).json({ error: 'Failed to scrape website content. Please try again later.' });
    }
}
