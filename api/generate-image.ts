import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function: Replicate Image Generation Proxy
 * 
 * Generates images using Replicate's black-forest-labs/flux-schnell model.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
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

        console.log(`[Vercel API] Generating image with Replicate (flux-schnell)`);

        // Use Replicate's predictions API
        // For flux-schnell, we can use the specific model endpoint or general predictions
        const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${replicateToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait' // Request synchronous response for smaller models like schnell
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

        // The output of flux-schnell is an array of URLs
        const imageUrl = prediction.output && prediction.output.length > 0 ? prediction.output[0] : null;

        if (!imageUrl) {
            throw new Error('No image output from Replicate');
        }

        // Download server-side: replicate.delivery sends no CORS headers, so the
        // browser cannot fetch the bytes itself for the Appwrite Storage upload
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
        console.error('[Vercel API] Error:', e);
        return res.status(500).json({
            error: 'Image generation error',
            message: e?.message || String(e)
        });
    }
}
