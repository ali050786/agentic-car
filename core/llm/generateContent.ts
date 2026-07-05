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
    'openrouter/free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-120b:free',
    'openai/gpt-oss-20b:free',
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

export interface SystemKeys {
    anthropic?: string;
    openrouter?: string;
}

export interface GenerateContentParams {
    prompt: string;
    selectedModel?: string;
    /** System keys used for the free tier. */
    systemKeys?: SystemKeys;
}

/**
 * Calls the appropriate provider for the given model/credentials and returns
 * the parsed JSON result. Throws on any provider error or empty response.
 */
export const generateContent = async ({
    prompt,
    selectedModel,
    systemKeys = {},
}: GenerateContentParams): Promise<any> => {
    let result: string | undefined;

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

            let openrouterResponse: Response | null = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

                if (openrouterResponse.status === 429) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.warn(`[LLM] Model ${freeModel} rate limited (429). Retrying in 3 seconds (Attempt ${attempts}/${maxAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        continue;
                    }
                }
                break;
            }

            if (openrouterResponse && openrouterResponse.ok) {
                const openrouterData = await openrouterResponse.json();
                const content = openrouterData.choices[0]?.message?.content;
                if (content) {
                    const cleaned = cleanAndDiagnose(openrouterData.choices[0], freeModel, 'free-tier default');
                    try {
                        JSON.parse(cleaned); // Test if it's valid JSON
                        result = cleaned;
                        break; // Success! Break the fallback loop
                    } catch (parseErr: any) {
                        lastError = `Invalid JSON response from ${freeModel}: ${(content || '').slice(0, 100)} (${parseErr?.message})`;
                        console.error('[LLM] ⚠️', lastError);
                        // Do NOT break, let it fall through to the next model in the chain!
                    }
                } else {
                    lastError = `Empty response content from ${freeModel}`;
                    console.error('[LLM]', lastError);
                }
            } else if (openrouterResponse) {
                lastError = await openrouterResponse.text();
                console.error(`[LLM] OpenRouter error for ${freeModel}, trying next:`, lastError);
            } else {
                lastError = 'No response from OpenRouter';
                console.error(`[LLM] ${lastError} for ${freeModel}, trying next`);
            }
        }

        if (!result) {
            throw new Error(`OpenRouter API error: ${lastError}`);
        }
    }

    return JSON.parse(result!);
};
