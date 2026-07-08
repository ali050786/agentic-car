import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContent } from '../core/llm/generateContent.js';
import { verifySessionAndConsumeLimit } from '../lib/apiAuth.js';

/**
 * Vercel Serverless Function: AI Model Proxy
 * 
 * This endpoint handles AI model generation requests with stateful server-side
 * authentication and rate limiting.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, selectedModel } = req.body;

        // Verify session and statefully consume free-tier limits on the server
        let userId: string;
        try {
            const authResult = await verifySessionAndConsumeLimit(req);
            userId = authResult.userId;
        } catch (authErr: any) {
            console.warn('[Vercel API] Authentication/limits failure:', authErr?.message || authErr);
            if (authErr.name === 'FreeLimitError') {
                return res.status(403).json({
                    error: 'FREE_LIMIT_REACHED',
                    message: authErr.message || 'Free trial exhausted. Please contact admin for more credits.',
                    usageCount: authErr.usageCount
                });
            }
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'A valid session token is required to access this service.'
            });
        }

        console.log(`[Vercel API] Running content generation for user ${userId}`);
        const result = await generateContent({
            prompt,
            selectedModel,
            systemKeys: {
                anthropic: process.env.CLAUDE_API_KEY,
                openrouter: process.env.OPENROUTER_API_KEY,
                groq: process.env.GROQ_API_KEY,
            },
        });

        return res.status(200).json(result);
    } catch (e: any) {
        console.error('[Vercel API] Error:', e);
        // Sanitize error returned to client to avoid system information leakage
        return res.status(500).json({
            error: 'AI proxy error',
            message: 'An internal error occurred during content generation. Please try again later.'
        });
    }
}
