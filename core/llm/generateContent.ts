/**
 * Shared, environment-agnostic LLM-calling logic.
 *
 * Extracted from api/generate.ts so the same provider-routing, BYOK handling,
 * free-model fallback chain, and JSON-cleaning/diagnostics can be reused by
 * both the (legacy) Vercel function and the background worker — instead of
 * two copies drifting apart. Takes API keys as explicit params (never reads
 * import.meta.env or process.env itself) so it runs unmodified in either
 * runtime.
 */

const SYSTEM_PROMPT = 'You are a specialized content agent for LinkedIn carousels. ERROR HANDLING: You MUST respond with ONLY valid JSON. Do NOT include any conversational filler like "Alright" or "Here is the JSON". Do NOT wrap the output in markdown code blocks if possible, but pure JSON string is best. START YOUR RESPONSE WITH { AND END WITH }.';

// Free OpenRouter endpoints are frequently rate-limited upstream, so the
// system-key default path tries each of these in order until one responds.
const FREE_MODEL_FALLBACK_CHAIN = [
    'openai/gpt-oss-120b:free',
    'openai/gpt-oss-20b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
];

const cleanJsonResponse = (text: string): string => {
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) return jsonMatch[1];

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return text.substring(start, end + 1);
    }

    return text.trim();
};

/**
 * Cleans a model response and logs a diagnostic (finish_reason / JSON
 * validity / truncation) so failures are visible in provider logs.
 */
const cleanAndDiagnose = (choice: any, model: string, label: string): string => {
    const content = choice?.message?.content ?? choice?.content ?? '';
    const finishReason = choice?.finish_reason ?? choice?.native_finish_reason ?? 'unknown';
    const cleaned = cleanJsonResponse(content || '{"slides":[]}');

    let parseError = '';
    try { JSON.parse(cleaned); } catch (e: any) { parseError = e?.message || 'parse failed'; }

    const truncated = finishReason === 'length';
    if (truncated || parseError) {
        console.error(`[LLM] ⚠️ MODEL RESPONSE PROBLEM (${label}, ${model}): finishReason=${finishReason}, truncated=${truncated}, validJson=${!parseError}, rawLen=${(content || '').length}`);
        if (truncated) console.error('[LLM]    → hit token limit; raise max_tokens or shrink the request');
        if (parseError) console.error('[LLM]    → invalid JSON, first 300 chars:', cleaned.slice(0, 300));
    }
    return cleaned;
};

export interface ByokCredentials {
    apiKey: string;
    provider: 'openrouter' | 'openai' | 'anthropic' | string;
}

export interface SystemKeys {
    anthropic?: string;
    openrouter?: string;
}

export interface GenerateContentParams {
    prompt: string;
    selectedModel?: string;
    /** User-provided key (BYOK). When present, this branch is used exclusively. */
    byok?: ByokCredentials | null;
    /** System keys used for the free tier. Ignored when byok is set. */
    systemKeys?: SystemKeys;
}

/**
 * Calls the appropriate provider for the given model/credentials and returns
 * the parsed JSON result. Throws on any provider error or empty response.
 */
export const generateContent = async ({
    prompt,
    selectedModel,
    byok,
    systemKeys = {},
}: GenerateContentParams): Promise<any> => {
    let result: string | undefined;

    if (byok) {
        const { apiKey: userApiKey, provider: apiProvider } = byok;
        console.log('[LLM] Using user-provided API key (BYOK)');
        console.log('[LLM] Provider:', apiProvider);
        console.log('[LLM] Selected model:', selectedModel);

        if (apiProvider === 'openrouter') {
            const model =
                selectedModel === 'gpt-oss-120b' ? 'openai/gpt-oss-120b:free' :
                selectedModel === 'deepseek-r1t' ? 'openai/gpt-oss-120b:free' :
                    selectedModel === 'claude-haiku-openrouter' ? 'anthropic/claude-3.5-haiku' :
                        selectedModel === 'claude-sonnet-openrouter' ? 'anthropic/claude-3.5-sonnet' :
                            selectedModel === 'gemini-2.5-flash' ? 'google/gemini-2.5-flash' :
                                selectedModel === 'gemini-2.0-flash-exp' ? 'google/gemini-2.0-flash-exp:free' :
                                    selectedModel === 'grok-4.1-fast' ? 'x-ai/grok-4.1-fast' :
                                        selectedModel === 'gpt-4o' ? 'openai/gpt-4o' :
                                            selectedModel === 'gpt-4-turbo' ? 'openai/gpt-4-turbo' :
                                                selectedModel === 'claude-sonnet' ? 'anthropic/claude-3.5-sonnet' :
                                                    selectedModel === 'claude-haiku' ? 'anthropic/claude-3.5-haiku' :
                                                        'openai/gpt-oss-120b:free';

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
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LLM] OpenRouter error:', errorText);
                throw new Error(`OpenRouter API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanJsonResponse(data.choices[0]?.message?.content || '{"slides":[]}');

        } else if (apiProvider === 'openai') {
            const model =
                selectedModel === 'gpt-4o' ? 'gpt-4o' :
                    selectedModel === 'gpt-4-turbo' ? 'gpt-4-turbo-preview' :
                        'gpt-4o';

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LLM] OpenAI error:', errorText);
                throw new Error(`OpenAI API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanJsonResponse(data.choices[0]?.message?.content || '{"slides":[]}');

        } else if (apiProvider === 'anthropic') {
            const model =
                selectedModel === 'claude-sonnet' ? 'claude-sonnet-4-5-20250929' :
                    selectedModel === 'claude-haiku' ? 'claude-3-5-haiku-20241022' :
                        'claude-3-5-haiku-20241022';

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
                        { role: 'user', content: `${SYSTEM_PROMPT}\n\n${prompt}` }
                    ],
                    temperature: 0.2,
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LLM] Anthropic error:', errorText);
                throw new Error(`Anthropic API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanJsonResponse(data.content[0]?.text || '{"slides":[]}');

        } else {
            throw new Error(`Unsupported API provider: ${apiProvider}`);
        }

        return JSON.parse(result);
    }

    // System keys (free tier)
    if (selectedModel === 'claude-haiku' || selectedModel === 'claude-sonnet' || selectedModel === 'claude-haiku-openrouter' || selectedModel === 'claude-sonnet-openrouter') {
        const anthropicKey = systemKeys.anthropic;

        if (anthropicKey && (selectedModel === 'claude-haiku' || selectedModel === 'claude-sonnet')) {
            console.log(`[LLM] Using system Anthropic API for ${selectedModel}`);
            const model = selectedModel === 'claude-sonnet' ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-5-20251001';

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 4096,
                    messages: [
                        { role: 'user', content: `${SYSTEM_PROMPT}\n\n${prompt}` }
                    ],
                    temperature: 0.2,
                })
            });

            if (response.ok) {
                const data = await response.json();
                result = cleanJsonResponse(data.content[0]?.text || '{"slides":[]}');
            } else {
                const errorText = await response.text();
                console.error('[LLM] Anthropic error fallback:', errorText);
                // Fall through to OpenRouter below
            }
        }

        if (!result) {
            const openrouterKey = systemKeys.openrouter;
            if (!openrouterKey) {
                throw new Error('Missing OPENROUTER_API_KEY for free tier');
            }

            const freeModel = (selectedModel === 'claude-haiku-openrouter' || selectedModel === 'claude-haiku')
                ? 'anthropic/claude-3.5-haiku'
                : 'anthropic/claude-3.5-sonnet';

            console.log(`[LLM] Using system OpenRouter API for ${selectedModel} (model: ${freeModel})`);

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
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                })
            });

            if (!openrouterResponse.ok) {
                const errorText = await openrouterResponse.text();
                console.error('[LLM] OpenRouter API error:', errorText);
                throw new Error(`OpenRouter API error: ${errorText}`);
            }

            const openrouterData = await openrouterResponse.json();
            result = cleanJsonResponse(openrouterData.choices[0]?.message?.content || '{"slides":[]}');
        }

    } else {
        const openrouterKey = systemKeys.openrouter;
        if (!openrouterKey) {
            throw new Error('Missing OPENROUTER_API_KEY for free tier');
        }

        let lastError = '';
        for (const freeModel of FREE_MODEL_FALLBACK_CHAIN) {
            console.log(`[LLM] Using system OpenRouter API for ${selectedModel || 'default'} (model: ${freeModel})`);

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
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 8000,
                })
            });

            if (openrouterResponse.ok) {
                const openrouterData = await openrouterResponse.json();
                const content = openrouterData.choices[0]?.message?.content;
                if (content) {
                    result = cleanAndDiagnose(openrouterData.choices[0], freeModel, 'free-tier default');
                    break;
                }
                lastError = `Empty response from ${freeModel}`;
                console.error('[LLM]', lastError);
            } else {
                lastError = await openrouterResponse.text();
                console.error(`[LLM] OpenRouter error for ${freeModel}, trying next:`, lastError);
            }
        }

        if (!result) {
            throw new Error(`OpenRouter API error: ${lastError}`);
        }
    }

    return JSON.parse(result!);
};
