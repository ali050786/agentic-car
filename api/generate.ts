import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContent } from '../core/llm/generateContent.js';
import { verifySession } from '../lib/apiAuth.js';
import { langfuse } from '../core/llm/langfuse.js';

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

    let userId = 'unknown';
    try {
        const { prompt, selectedModel } = req.body;

        // Verify the session on the server (no usage limits — the platform is free)
        try {
            const authResult = await verifySession(req);
            userId = authResult.userId;
        } catch (authErr: any) {
            console.warn('[Vercel API] Authentication failure:', authErr?.message || authErr);
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'A valid session token is required to access this service.'
            });
        }

        console.log(`[Vercel API] Running content generation for user ${userId}`);

        // Start Langfuse Trace for direct API call
        const trace = langfuse?.trace({
            name: 'api-generate',
            userId,
            metadata: {
                selectedModel,
            }
        });

        const result = await generateContent({
            prompt,
            selectedModel,
            systemKeys: {
                anthropic: process.env.CLAUDE_API_KEY,
                openrouter: process.env.OPENROUTER_API_KEY,
                groq: process.env.GROQ_API_KEY,
            },
            langfuseTrace: trace,
        });

        return res.status(200).json(result);
    } catch (e: any) {
        console.error('[Vercel API] Error:', e);
        // Sanitize error returned to client to avoid system information leakage
        return res.status(500).json({
            error: 'AI proxy error',
            message: 'An internal error occurred during content generation. Please try again later.'
        });
    } finally {
        if (langfuse) {
            try {
                await langfuse.flushAsync();
            } catch (err) {
                console.error('[Vercel API] Langfuse flush failed:', err);
            }
        }
    }
}
