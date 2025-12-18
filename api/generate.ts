import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FREE_TIER_LIMIT } from '../config/constants';

// Helper to extract JSON from markdown code blocks
const cleanJsonResponse = (text: string): string => {
    // 1. Try to match markdown code blocks first
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
        return jsonMatch[1];
    }

    // 2. Try to find the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return text.substring(start, end + 1);
    }

    // 3. Return as-is if no structure found (fallback)
    return text.trim();
};

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
        const { prompt, responseSchema, selectedModel } = req.body;

        // Parse headers for hybrid auth
        const userApiKey = req.headers['x-api-key'] as string | undefined;
        const userId = req.headers['x-user-id'] as string | undefined;
        const apiProvider = (req.headers['x-api-provider'] as string) || 'openrouter';

        let result: any;
        let usingSystemKey = false;

        // BRANCH A: BYOK - User provided their own API key
        if (userApiKey) {
            console.log('[Vercel API] Using user-provided API key (BYOK)');
            console.log('[Vercel API] Provider:', apiProvider);
            console.log('[Vercel API] Selected model:', selectedModel);

            const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. ERROR HANDLING: You MUST respond with ONLY valid JSON. Do NOT include any conversational filler like "Alright" or "Here is the JSON". Do NOT wrap the output in markdown code blocks if possible, but pure JSON string is best. START YOUR RESPONSE WITH { AND END WITH }.';

            // Route to correct API based on provider
            if (apiProvider === 'openrouter') {
                // OpenRouter - supports all models
                const model =
                    selectedModel === 'deepseek-r1t' ? 'tngtech/deepseek-r1t-chimera:free' :
                        selectedModel === 'claude-haiku-openrouter' ? 'anthropic/claude-3.5-haiku' :
                            selectedModel === 'gemini-2.5-flash' ? 'google/gemini-2.5-flash' :
                                selectedModel === 'gemini-2.0-flash-exp' ? 'google/gemini-2.0-flash-exp:free' :
                                    selectedModel === 'grok-4.1-fast' ? 'x-ai/grok-4.1-fast' :
                                        selectedModel === 'gpt-4o' ? 'openai/gpt-4o' :
                                            selectedModel === 'gpt-4-turbo' ? 'openai/gpt-4-turbo' :
                                                selectedModel === 'claude-sonnet' ? 'anthropic/claude-3.5-sonnet' :
                                                    selectedModel === 'claude-haiku' ? 'anthropic/claude-3.5-haiku' :
                                                        'tngtech/deepseek-r1t-chimera:free';

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${userApiKey}`,
                        'HTTP-Referer': 'https://agentic-carousel.vercel.app',
                        'X-Title': 'Agentic Carousel Generator',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.2,
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[Vercel API] OpenRouter error:', errorText);
                    throw new Error(`OpenRouter API error: ${errorText}`);
                }

                const data = await response.json();
                result = cleanJsonResponse(data.choices[0]?.message?.content || '{"slides":[]}');

            } else if (apiProvider === 'openai') {
                // OpenAI API - only GPT models
                const model =
                    selectedModel === 'gpt-4o' ? 'gpt-4o' :
                        selectedModel === 'gpt-4-turbo' ? 'gpt-4-turbo-preview' :
                            'gpt-4o'; // Default

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${userApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.2,
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[Vercel API] OpenAI error:', errorText);
                    throw new Error(`OpenAI API error: ${errorText}`);
                }

                const data = await response.json();
                result = cleanJsonResponse(data.choices[0]?.message?.content || '{"slides":[]}');

            } else if (apiProvider === 'anthropic') {
                // Anthropic API - only Claude models
                const model =
                    selectedModel === 'claude-sonnet' ? 'claude-sonnet-4-5-20250929' :
                        selectedModel === 'claude-haiku' ? 'claude-3-5-haiku-20241022' :
                            'claude-3-5-haiku-20241022'; // Default

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': userApiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        max_tokens: 4096,
                        messages: [
                            { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
                        ],
                        temperature: 0.2,
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[Vercel API] Anthropic error:', errorText);
                    throw new Error(`Anthropic API error: ${errorText}`);
                }

                const data = await response.json();
                result = cleanJsonResponse(data.content[0]?.text || '{"slides":[]}');

            } else {
                throw new Error(`Unsupported API provider: ${apiProvider}`);
            }
        } else {
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

            // Use system keys for free tier
            console.log(`[Vercel API] Using free tier for user ${userId} (${usageCount}/${FREE_TIER_LIMIT})`);
            usingSystemKey = true;

            const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. ERROR HANDLING: You MUST respond with ONLY valid JSON. Do NOT include any conversational filler like "Alright" or "Here is the JSON". Do NOT wrap the output in markdown code blocks if possible, but pure JSON string is best. START YOUR RESPONSE WITH { AND END WITH }.';

            // Free tier: Route based on selected model
            if (selectedModel === 'claude-haiku-openrouter') {
                // Use system Anthropic API for Claude Haiku
                const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
                if (!anthropicKey) {
                    console.error('[Vercel API] Missing ANTHROPIC_API_KEY for free tier Claude');
                    return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY for free tier' });
                }

                console.log('[Vercel API] Using system Anthropic API for Claude Haiku');

                const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-haiku-20241022',
                        max_tokens: 4096,
                        messages: [
                            { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
                        ],
                        temperature: 0.2,
                    })
                });

                if (!anthropicResponse.ok) {
                    const errorText = await anthropicResponse.text();
                    console.error('[Vercel API] Anthropic API error:', errorText);
                    throw new Error(`Anthropic API error: ${errorText}`);
                }

                const anthropicData = await anthropicResponse.json();
                result = cleanJsonResponse(anthropicData.content[0]?.text || '{"slides":[]}');

            } else {
                // Use system OpenRouter API for DeepSeek and others
                const openrouterKey = process.env.OPENROUTER_API_KEY || '';
                if (!openrouterKey) {
                    console.error('[Vercel API] Missing OPENROUTER_API_KEY for free tier');
                    return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY for free tier' });
                }

                console.log('[Vercel API] Using system OpenRouter API for DeepSeek');

                const freeModel =
                    selectedModel === 'deepseek-r1t' ? 'tngtech/deepseek-r1t-chimera:free' :
                        selectedModel === 'gemini-2.0-flash-exp' ? 'google/gemini-2.0-flash-exp:free' :
                            'tngtech/deepseek-r1t-chimera:free'; // Default to DeepSeek

                const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openrouterKey}`,
                        'HTTP-Referer': 'https://agentic-carousel.vercel.app',
                        'X-Title': 'Agentic Carousel Generator',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: freeModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.2,
                    })
                });

                if (!openrouterResponse.ok) {
                    const errorText = await openrouterResponse.text();
                    console.error('[Vercel API] OpenRouter API error:', errorText);
                    throw new Error(`OpenRouter API error: ${errorText}`);
                }

                const openrouterData = await openrouterResponse.json();
                result = cleanJsonResponse(openrouterData.choices[0]?.message?.content || '{"slides":[]}');
            }

            // Note: Usage count increment happens on client side after successful response
        }

        return res.status(200).json(JSON.parse(result));
    } catch (e: any) {
        console.error('[Vercel API] Error:', e);
        return res.status(500).json({
            error: 'AI proxy error',
            message: e?.message || String(e)
        });
    }
}
