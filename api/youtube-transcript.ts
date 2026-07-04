import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Vercel Serverless Function: YouTube Transcript Fetch
 *
 * Mirrors the /api/youtube-transcript Vite middleware in vite.config.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { videoId } = req.body || {};
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        if (!transcriptItems || transcriptItems.length === 0) {
            return res.status(404).json({ error: 'No transcript available for this video. The video may not have captions.' });
        }

        const fullTranscript = transcriptItems.map((item: any) => item.text).join(' ').replace(/\s+/g, ' ').trim();
        return res.status(200).json({ transcript: fullTranscript });
    } catch (e: any) {
        console.error('[Vercel API] youtube-transcript error:', e);
        return res.status(500).json({ error: e?.message || String(e) });
    }
}
