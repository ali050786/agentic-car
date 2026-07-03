import type { VercelRequest, VercelResponse } from '@vercel/node';

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
