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
    groq?: string;
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
    if (selectedModel === 'claude-haiku' || selectedModel === 'claude-sonnet') {
        const anthropicKey = systemKeys.anthropic;
        if (!anthropicKey) {
            throw new Error('Missing CLAUDE_API_KEY for Anthropic API');
        }

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

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[LLM] Anthropic API error:', errorText);
            throw new Error(`Anthropic API error: ${errorText}`);
        }

        const data = await response.json();
        result = cleanJsonResponse(data.content[0]?.text || '{"slides":[]}');

    } else {
        // Free Models Router (Auto) -> Use OpenRouter with "openrouter/free"
        const openrouterKey = systemKeys.openrouter;
        
        let openrouterResponse: Response | null = null;
        let openrouterError = '';

        if (openrouterKey) {
            console.log(`[LLM] Using OpenRouter API for ${selectedModel || 'default'} (model: openrouter/free)`);
            try {
                openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openrouterKey}`,
                        'HTTP-Referer': 'https://agentic-carousel.vercel.app',
                        'X-Title': 'Agentic Carousel Generator',
                        'Content-Type': 'application/json'
                    },
            body: JSON.stringify({
                        model: 'openrouter/free',
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.2,
                        max_tokens: 4000,
                        response_format: { type: 'json_object' }
                    })
                });

                if (openrouterResponse.ok) {
                    const openrouterData = await openrouterResponse.json();
                    result = cleanAndDiagnose(openrouterData.choices?.[0], 'openrouter/free', 'free-tier router');
                } else {
                    openrouterError = await openrouterResponse.text();
                    console.error('[LLM] OpenRouter API returned error status:', openrouterResponse.status, openrouterError);
                }
            } catch (err: any) {
                openrouterError = err?.message || String(err);
                console.error('[LLM] OpenRouter fetch failed:', openrouterError);
            }
        } else {
            console.warn('[LLM] Missing OPENROUTER_API_KEY, skipping OpenRouter');
        }

        // Fallback to Groq API if OpenRouter failed
        if (!result) {
            const groqKey = systemKeys.groq;
            if (groqKey) {
                console.log(`[LLM] OpenRouter failed, attempting fallback to Groq API (model: llama-3.3-70b-versatile)`);
                try {
                    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${groqKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: SYSTEM_PROMPT },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.2,
                            max_tokens: 4000,
                            response_format: { type: 'json_object' }
                        })
                    });

                    if (groqResponse.ok) {
                        const groqData = await groqResponse.json();
                        result = cleanAndDiagnose(groqData.choices?.[0], 'llama-3.3-70b-versatile', 'groq-fallback');
                    } else {
                        const groqError = await groqResponse.text();
                        console.error('[LLM] Groq API returned error status:', groqResponse.status, groqError);
                    }
                } catch (err: any) {
                    console.error('[LLM] Groq fetch failed:', err?.message || String(err));
                }
            } else {
                console.warn('[LLM] Missing GROQ_API_KEY, cannot fall back to Groq');
            }
        }

        // If both failed, throw a specific user friendly error
        if (!result) {
            throw new Error('Free API servers are busy or unavailable, please try again after some time.');
        }
    }

    return JSON.parse(result!);
};
