import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContent } from '../core/llm/generateContent';

// Free tier limit - inlined to avoid module resolution issues in Vercel
const FREE_TIER_LIMIT = 10;

/**
 * Vercel Serverless Function: AI Model Proxy
 * 
 * This endpoint handles AI model generation requests with hybrid authentication:
 * - BYOK (Bring Your Own Key): User provides their own API key
 * - Free Tier: System keys with usage limits (10 generations per user)
 * 
 * Supports multiple providers: OpenRouter, OpenAI, Anthropic
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, selectedModel } = req.body;

        // Parse headers for hybrid auth
        const userApiKey = req.headers['x-api-key'] as string | undefined;
        const userId = req.headers['x-user-id'] as string | undefined;
        const apiProvider = (req.headers['x-api-provider'] as string) || 'openrouter';

        // BRANCH A: BYOK - User provided their own API key
        if (userApiKey) {
            const result = await generateContent({
                prompt,
                selectedModel,
                byok: { apiKey: userApiKey, provider: apiProvider },
            });
            return res.status(200).json(result);
        }

        // BRANCH B: FREE TIER - No user key provided
        console.log('[Vercel API] No user API key, using free tier');

        if (!userId) {
            return res.status(403).json({
                error: 'MISSING_USER_ID',
                message: 'User ID is required for free tier usage'
            });
        }

        // Get usage count from client (sent via header to avoid server-side Appwrite auth)
        const usageCountHeader = req.headers['x-usage-count'] as string | undefined;
        const usageCount = usageCountHeader ? parseInt(usageCountHeader, 10) : 0;

        if (usageCount >= FREE_TIER_LIMIT) {
            console.log(`[Vercel API] User ${userId} has exhausted free tier (${usageCount}/${FREE_TIER_LIMIT})`);
            return res.status(403).json({
                error: 'FREE_LIMIT_REACHED',
                message: 'Free trial exhausted. Please add your API key to continue.',
                usageCount: usageCount
            });
        }

        console.log(`[Vercel API] Using free tier for user ${userId} (${usageCount}/${FREE_TIER_LIMIT})`);
        const result = await generateContent({
            prompt,
            selectedModel,
            byok: null,
            systemKeys: {
                anthropic: process.env.CLAUDE_API_KEY,
                openrouter: process.env.OPENROUTER_API_KEY,
            },
        });

        // Note: Usage count increment happens on client side after successful response
        return res.status(200).json(result);
    } catch (e: any) {
        console.error('[Vercel API] Error:', e);
        return res.status(500).json({
            error: 'AI proxy error',
            message: e?.message || String(e)
        });
    }
}
