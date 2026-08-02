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
        if (truncated) console.error('[LLM]    → hit the model\'s output limit; shrink the request');
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

    const modelName = 'deepseek/deepseek-v4-flash';
    const parent = langfuseSpan || langfuseTrace;
    const generation = parent ? parent.generation({
        name: 'generate-content-deepseek-v4-flash',
        model: modelName,
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
        const openrouterKey = systemKeys.openrouter;
        if (!openrouterKey) {
            throw new Error('Missing OPENROUTER_API_KEY for DeepSeek v4 Flash execution');
        }

        console.log(`[LLM] Calling OpenRouter API with model ${modelName}`);
        const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': 'https://agentic-carousel.vercel.app',
                'X-Title': 'Agentic Carousel Generator',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: 'system', content: systemPromptString ? `${SYSTEM_PROMPT}\n\n${systemPromptString}` : SYSTEM_PROMPT },
                    { role: 'user', content: promptString }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2
            })
        });

        if (!openrouterResponse.ok) {
            const openrouterError = await openrouterResponse.text();
            console.error(`[LLM] OpenRouter API error status: ${openrouterResponse.status} ${openrouterError}`);
            throw new Error(`OpenRouter API error (${openrouterResponse.status}): ${openrouterError}`);
        }

        const openrouterData = await openrouterResponse.json();
        const candidate = cleanAndDiagnose(openrouterData.choices?.[0], modelName, 'openrouter');
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
        } else {
            console.error('[LLM] ⚠️ OpenRouter output was not valid JSON.');
            throw new Error('LLM output failed JSON validation.');
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
