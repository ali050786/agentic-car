import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySession } from '../lib/apiAuth.js';

/**
 * Vercel Serverless Function: Replicate Image Generation Proxy
 * 
 * Generates images using Replicate's black-forest-labs/flux-schnell model.
 * Requires user authentication to prevent unauthorized API credit consumption.
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
            console.warn('[Vercel API] Authentication failure in generate-image:', authErr?.message || authErr);
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'A valid session token is required to access this service.'
            });
        }

        const { prompt, aspectRatio } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const allowedRatios = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21', '4:3', '3:4'];
        const ratio = allowedRatios.includes(aspectRatio) ? aspectRatio : '1:1';

        const replicateToken = process.env.REPLICATE_API_TOKEN;
        if (!replicateToken) {
            console.error('[Vercel API] Missing REPLICATE_API_TOKEN');
            return res.status(500).json({ error: 'Replicate API configuration missing' });
        }

        console.log(`[Vercel API] User ${userId} generating image with Replicate (flux-schnell)`);

        // Use Replicate's predictions API
        const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${replicateToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait'
            },
            body: JSON.stringify({
                input: {
                    prompt: prompt,
                    go_fast: true,
                    megapixels: "1",
                    num_outputs: 1,
                    aspect_ratio: ratio,
                    output_format: "webp",
                    output_quality: 80,
                    num_inference_steps: 4
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Vercel API] Replicate API error:', errorText);
            throw new Error(`Replicate API error: ${errorText}`);
        }

        const prediction = await response.json();
        const imageUrl = prediction.output && prediction.output.length > 0 ? prediction.output[0] : null;

        if (!imageUrl) {
            throw new Error('No image output from Replicate');
        }

        // Download server-side to avoid CORS limits in client
        let imageBase64: string | null = null;
        try {
            const imgResp = await fetch(imageUrl);
            if (imgResp.ok) {
                const buf = Buffer.from(await imgResp.arrayBuffer());
                imageBase64 = `data:image/webp;base64,${buf.toString('base64')}`;
            }
        } catch (imgErr) {
            console.warn('[Vercel API] Could not download image bytes, returning URL only:', imgErr);
        }

        return res.status(200).json({ imageUrl, imageBase64 });

    } catch (e: any) {
        console.error('[Vercel API] Error in generate-image:', e);
        return res.status(500).json({
            error: 'Image generation error',
            message: 'An internal error occurred during image generation. Please try again later.'
        });
    }
}
