import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';
import { verifySession } from '../lib/apiAuth.js';

/**
 * Vercel Serverless Function: YouTube Transcript Fetch
 *
 * Requires user authentication.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Authenticate the user
        let userId: string;
        try {
            const authResult = await verifySession(req);
            userId = authResult.userId;
        } catch (authErr: any) {
            console.warn('[Vercel API] Authentication failure in youtube-transcript:', authErr?.message || authErr);
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'A valid session token is required to access this service.'
            });
        }

        const { videoId } = req.body || {};
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        console.log(`[Vercel API] Fetching transcript for video ${videoId} requested by user ${userId}`);
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        if (!transcriptItems || transcriptItems.length === 0) {
            return res.status(404).json({ error: 'No transcript available for this video. The video may not have captions.' });
        }

        const fullTranscript = transcriptItems.map((item: any) => item.text).join(' ').replace(/\s+/g, ' ').trim();
        return res.status(200).json({ transcript: fullTranscript });
    } catch (e: any) {
        console.error('[Vercel API] youtube-transcript error:', e);
        return res.status(500).json({ error: 'Failed to fetch transcript. Please try again later.' });
    }
}
