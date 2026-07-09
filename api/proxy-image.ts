import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySession } from '../lib/apiAuth.js';
import { isSafeUrl } from '../utils/urlSafety.js';

/**
 * Vercel Serverless Function: Image CORS Proxy
 *
 * Fetches an external image server-side and streams it back so the browser
 * can convert it to base64 for html2canvas exports (JPG/PDF) without CORS issues.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Authenticate user to prevent anonymous resource exhaustion
        try {
            await verifySession(req);
        } catch (authErr: any) {
            console.warn('[Vercel API] Authentication failure in proxy-image:', authErr?.message || authErr);
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

        if (!/^https?:$/.test(parsed.protocol)) {
            return res.status(400).json({ error: 'URL not allowed' });
        }

        // 2. Perform DNS-resolved host check to block SSRF bypass attempts
        const safe = await isSafeUrl(parsed);
        if (!safe) {
            console.warn(`[SSRF Blocked] User requested unsafe/local URL in proxy-image: ${target}`);
            return res.status(400).json({ error: 'Access to this URL is blocked for security reasons.' });
        }

        const upstream = await fetch(parsed.toString());
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(buf);
    } catch (e: any) {
        console.error('[Vercel API] proxy-image error:', e);
        return res.status(500).json({ error: 'proxy-image error', message: e?.message || String(e) });
    }
}
