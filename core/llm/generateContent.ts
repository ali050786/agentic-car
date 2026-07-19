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

const SYSTEM_PROMPT = 'You are a specialized content agent that writes social media carousels on any topic, for any audience. ERROR HANDLING: You MUST respond with ONLY valid JSON. Do NOT think out loud, show your reasoning or plan, count characters, or write ANY prose before or after the JSON — no "We need to...", no "Let\'s...", no step-by-step. Do NOT include conversational filler like "Alright" or "Here is the JSON". Do NOT wrap the output in markdown code blocks. Your ENTIRE response must be a single JSON object: START YOUR RESPONSE WITH { AND END WITH }.';

/**
 * Attempts to repair truncated or slightly malformed JSON by auto-closing
 * open quotes, brackets, and braces in LIFO order.
 */
export const repairJson = (str: string): string => {
    if (!str) return str;
    const start = str.indexOf('{');
    if (start === -1) return str;

    let sub = str.substring(start).trim();

    let inString = false;
    let isEscaped = false;
    const stack: string[] = [];

    for (let i = 0; i < sub.length; i++) {
        const char = sub[i];

        if (isEscaped) {
            isEscaped = false;
            continue;
        }

        if (char === '\\' && inString) {
            isEscaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') {
                stack.push('}');
            } else if (char === '[') {
                stack.push(']');
            } else if (char === '}' || char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === char) {
                    stack.pop();
                }
            }
        }
    }

    if (inString) {
        sub += '"';
    }

    sub = sub.replace(/[,:\s]+$/, '');

    while (stack.length > 0) {
        sub += stack.pop();
    }

    return sub;
};

const cleanJsonResponse = (text: string): string => {
    let cleaned = text;
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
        cleaned = jsonMatch[1];
    } else {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            cleaned = text.substring(start, end + 1);
        } else if (start !== -1) {
            cleaned = text.substring(start);
        } else {
            cleaned = text.trim();
        }
    }

    if (!isValidJson(cleaned)) {
        const repaired = repairJson(cleaned);
        if (isValidJson(repaired)) {
            console.log('[LLM] 🔧 Successfully auto-repaired truncated/incomplete JSON response');
            return repaired;
        }
    }

    return cleaned;
};

/** True if `str` parses as JSON. Used to detect models that emit reasoning/prose
 *  instead of JSON (common on free reasoning models), so we can fall back to a
 *  more instruction-following model instead of hard-crashing the job. */
const isValidJson = (str: string): boolean => {
    if (!str) return false;
    try { JSON.parse(str); return true; } catch { return false; }
};

/**
 * Cleans a model response and logs a diagnostic (finish_reason / JSON
 * validity / truncation) so failures are visible in provider logs.
 */
const cleanAndDiagnose = (choice: any, model: string, label: string): string => {
    const content = choice?.message?.content ?? choice?.content ?? '';
    const finishReason = choice?.finish_reason ?? choice?.native_finish_reason ?? 'unknown';
    const cleaned = cleanJsonResponse(content);

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
    prompt: string | { systemPrompt?: string; prompt: string };
    selectedModel?: string;
    /** System keys used for the free tier. */
    systemKeys?: SystemKeys;
    onTokenUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number }) => void;
    byok?: any;
}

/**
 * Calls the appropriate provider for the given model/credentials and returns
 * the parsed JSON result. Throws on any provider error or empty response.
 */
export const generateContent = async ({
    prompt,
    selectedModel,
    systemKeys = {},
    onTokenUsage,
    langfuseTrace,
    langfuseSpan,
}: GenerateContentParams & { langfuseTrace?: any; langfuseSpan?: any }): Promise<any> => {
    let result: string | undefined;

    let promptString = '';
    let systemPromptString: string | undefined;

    if (typeof prompt === 'object' && prompt !== null) {
        promptString = prompt.prompt || '';
        systemPromptString = prompt.systemPrompt;
    } else {
        promptString = (prompt as string) || '';
    }

    const resolvedModel = selectedModel === 'deepseek-v4-flash' ? 'deepseek/deepseek-v4-flash' : (selectedModel || 'openrouter/free');
    const parent = langfuseSpan || langfuseTrace;
    const generation = parent ? parent.generation({
        name: selectedModel ? `generate-content-${selectedModel}` : 'generate-content',
        model: resolvedModel,
        input: { prompt: promptString, systemPrompt: systemPromptString },
    }) : null;

    let usageTracker: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number } | undefined;
    const wrappedOnTokenUsage = (usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number }) => {
        usageTracker = usage;
        if (onTokenUsage) {
            onTokenUsage(usage);
        }
    };

    try {
        // System keys (free tier)
        if (selectedModel === 'claude-haiku' || selectedModel === 'claude-sonnet') {
            const anthropicKey = systemKeys.anthropic;
            if (!anthropicKey) {
                throw new Error('Missing CLAUDE_API_KEY for Anthropic API');
            }

            console.log(`[LLM] Using system Anthropic API for ${selectedModel}`);
            const model = selectedModel === 'claude-sonnet' ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-5-20251001';

            const systemPromptBlock = systemPromptString ? `${SYSTEM_PROMPT}\n\n${systemPromptString}` : SYSTEM_PROMPT;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                    'anthropic-beta': 'prompt-caching-2024-07-31'
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 4096,
                    system: [
                        {
                            type: 'text',
                            text: systemPromptBlock,
                            cache_control: { type: 'ephemeral' }
                        }
                    ],
                    messages: [
                        { role: 'user', content: promptString }
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

            if (data.usage) {
                wrappedOnTokenUsage({
                    promptTokens: data.usage.input_tokens || 0,
                    completionTokens: data.usage.output_tokens || 0,
                    totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
                    cachedTokens: data.usage.cache_read_input_tokens || 0
                });
            }

        } else {
            // Use OpenRouter with model fallbacks
            const openrouterKey = systemKeys.openrouter;
            const primaryModel = selectedModel === 'deepseek-v4-flash' ? 'deepseek/deepseek-v4-flash' : 'openrouter/free';
            const modelsToTry = Array.from(new Set([
                primaryModel,
                'meta-llama/llama-3.3-70b-instruct:free',
                'google/gemini-2.0-flash-lite-001'
            ]));

            if (openrouterKey) {
                for (const currentModel of modelsToTry) {
                    console.log(`[LLM] Using OpenRouter API for ${selectedModel || 'default'} (model: ${currentModel})`);
                    try {
                        const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${openrouterKey}`,
                                'HTTP-Referer': 'https://agentic-carousel.vercel.app',
                                'X-Title': 'Agentic Carousel Generator',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: currentModel,
                                messages: [
                                    { role: 'system', content: systemPromptString ? `${SYSTEM_PROMPT}\n\n${systemPromptString}` : SYSTEM_PROMPT },
                                    { role: 'user', content: promptString }
                                ],
                                response_format: { type: 'json_object' },
                                temperature: 0.2,
                                max_tokens: 8000
                            })
                        });

                        if (openrouterResponse.ok) {
                            const openrouterData = await openrouterResponse.json();
                            const candidate = cleanAndDiagnose(openrouterData.choices?.[0], currentModel, 'openrouter');
                            if (isValidJson(candidate)) {
                                result = candidate;
                                if (openrouterData.usage) {
                                    wrappedOnTokenUsage({
                                        promptTokens: openrouterData.usage.prompt_tokens || 0,
                                        completionTokens: openrouterData.usage.completion_tokens || 0,
                                        totalTokens: openrouterData.usage.total_tokens || (openrouterData.usage.prompt_tokens || 0) + (openrouterData.usage.completion_tokens || 0),
                                        cachedTokens: openrouterData.usage.cached_tokens || 0
                                    });
                                }
                                break; // Successfully got valid JSON!
                            } else {
                                console.error(`[LLM] ⚠️ OpenRouter (${currentModel}) output was not valid JSON — attempting next model fallback.`);
                            }
                        } else {
                            const openrouterError = await openrouterResponse.text();
                            console.error(`[LLM] OpenRouter (${currentModel}) API returned error status: ${openrouterResponse.status} ${openrouterError}`);
                        }
                    } catch (err: any) {
                        console.error(`[LLM] OpenRouter (${currentModel}) fetch failed:`, err?.message || String(err));
                    }
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
                                    { role: 'system', content: systemPromptString ? `${SYSTEM_PROMPT}\n\n${systemPromptString}` : SYSTEM_PROMPT },
                                    { role: 'user', content: promptString }
                                ],
                                response_format: { type: 'json_object' },
                                temperature: 0.2,
                                max_tokens: 8000
                            })
                        });

                        if (groqResponse.ok) {
                            const groqData = await groqResponse.json();
                            const candidate = cleanAndDiagnose(groqData.choices?.[0], 'llama-3.3-70b-versatile', 'groq-fallback');
                            if (isValidJson(candidate)) {
                                result = candidate;
                                if (groqData.usage) {
                                    wrappedOnTokenUsage({
                                        promptTokens: groqData.usage.prompt_tokens || 0,
                                        completionTokens: groqData.usage.completion_tokens || 0,
                                        totalTokens: groqData.usage.total_tokens || (groqData.usage.prompt_tokens || 0) + (groqData.usage.completion_tokens || 0),
                                        cachedTokens: groqData.usage.cached_tokens || 0
                                    });
                                }
                            } else {
                                console.error('[LLM] ⚠️ Groq output was not valid JSON either.');
                            }
                        } else {
                            const groqError = await groqResponse.text();
                            console.error(`[LLM] Groq API error status (${groqResponse.status}):`, groqError);
                            if (groqResponse.status === 401) {
                                console.warn('[LLM] 💡 Groq returned 401 Unauthorized. Check your GROQ_API_KEY setting in .env if you wish to use Groq as fallback.');
                            }
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

        const cleanedResult = result ? result.trim() : '';
        
        // Check if OpenRouter/Groq safety guardrail (Llama Guard) blocked the prompt
        if (
            cleanedResult === 'User Safety: safe' || 
            cleanedResult === 'User Safety: unsafe' || 
            cleanedResult.startsWith('User Safety:')
        ) {
            throw new Error(
                'The free-tier AI safety filter (Llama Guard) flagged this request. ' +
                'This usually happens when search queries, inputs, or chat messages contain sensitive terms (such as "password" or "credentials"). ' +
                'Please try rephrasing your prompt without using those keywords, or switch to another model.'
            );
        }

        try {
            const parsed = JSON.parse(cleanedResult);
            if (generation) {
                generation.update({
                    output: cleanedResult,
                    usage: usageTracker ? {
                        inputTokens: usageTracker.promptTokens,
                        outputTokens: usageTracker.completionTokens,
                        totalTokens: usageTracker.totalTokens
                    } : undefined
                });
                generation.end();
            }
            return parsed;
        } catch (e: any) {
            console.error('[LLM] JSON parse failed. Raw response:', cleanedResult);
            throw new Error(`The model returned invalid JSON structure: ${e.message || String(e)}`);
        }
    } catch (err: any) {
        if (generation) {
            generation.update({
                output: err.message || String(err),
                metadata: { error: err.message || String(err) }
            });
            generation.end();
        }
        throw err;
    }
};
