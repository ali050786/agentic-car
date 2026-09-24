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

import { ModelRole, ReasoningMode, roleConfig, fallbackModels, providerSort } from './models';
import { JsonSchema, validateAndCoerce, unwrapEnvelope, describeSchema } from './schema';

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

/** Per-call usage, reported once per generateContent call (all attempts summed). */
export interface UsageReport {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
    /** Hidden reasoning tokens (part of completionTokens). Non-zero means the model "thought" first. */
    reasoningTokens?: number;
    /** USD, as reported by OpenRouter (usage.include). 0 when unknown. */
    costUsd: number;
    model: string;
    role: ModelRole;
    ms: number;
    attempts: number;
    repaired: boolean;
    /** Time to the first token of the attempt that succeeded (streaming only). */
    firstTokenMs?: number;
    /** How many times a slow attempt got a parallel twin. */
    hedges?: number;
    /** Why earlier attempts failed (timeouts, stalls, 5xx…), for the eval's timing report. */
    failures?: string[];
    /** false when every attempt failed (the call threw). */
    ok?: boolean;
}

export interface GenerateContentParams {
    prompt: string | { systemPrompt?: string; prompt: string };
    /** Legacy: the UI's model picker. Ignored; the role decides the model. */
    selectedModel?: string;
    /** What this call is for. Decides model, temperature, budget and timeout. */
    role?: ModelRole;
    /** Expected response shape. Validated and coerced; one repair retry on mismatch. */
    schema?: JsonSchema;
    /** Per-call temperature override (rarely needed; prefer roles). */
    temperature?: number;
    /** System keys used for the free tier. */
    systemKeys?: SystemKeys;
    onTokenUsage?: (usage: UsageReport) => void;
    byok?: any;
    /** Short label for logs/traces, e.g. "outline". */
    label?: string;
}

class LLMError extends Error {
    /** Tokens/cost of a response we paid for but couldn't use (bad JSON, empty, filtered). */
    usage?: RawCall['usage'];
    /** Retry at once, no backoff: the provider was slow, not overloaded. */
    fastRetry = false;
    constructor(message: string, public status?: number, public retryable = false) {
        super(message);
        this.name = 'LLMError';
    }
}

const quick = (e: LLMError) => { e.fastRetry = true; return e; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(8000, 900 * 2 ** (attempt - 1)) + Math.round(Math.random() * 400);

const LLAMA_GUARD_MESSAGE =
    'The free-tier AI safety filter (Llama Guard) flagged this request. ' +
    'This usually happens when search queries, inputs, or chat messages contain sensitive terms (such as "password" or "credentials"). ' +
    'Please try rephrasing your prompt without using those keywords.';

interface RawCall {
    content: string;
    parsed: any;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number; reasoningTokens: number; costUsd: number };
    firstTokenMs?: number;
}

interface CallParams {
    apiKey: string;
    model: string;
    messages: { role: string; content: string }[];
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    label: string;
    /** Stream tokens (enables first-token / stall detection). */
    stream?: boolean;
    reasoning?: ReasoningMode;
    providerSort?: string | null;
    firstTokenMs?: number;
    stallMs?: number;
    /** Cancels this request (the other half of a hedged pair finished first). */
    signal?: AbortSignal;
    onFirstToken?: () => void;
}

/** Models that rejected the reasoning switch: we stop sending it to them. */
const noReasoningSwitch = new Set<string>();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * One HTTP round trip to OpenRouter. Throws LLMError.
 *
 * Streaming is what makes slow calls cheap to recover from: an attempt with no
 * token after `firstTokenMs`, or whose tokens stop for `stallMs`, is cut and
 * retried right away instead of burning the whole timeout. Reasoning tokens
 * count as progress, so a model that thinks first isn't mistaken for a stall.
 */
const callOpenRouter = async (params: CallParams): Promise<RawCall> => {
    const controller = new AbortController();
    let abortWhy: 'timeout' | 'first-token' | 'stall' | 'cancelled' | null = null;
    const abort = (why: NonNullable<typeof abortWhy>) => {
        if (!abortWhy) abortWhy = why;
        controller.abort();
    };
    const started = Date.now();
    // The timer covers the whole call, body included: OpenRouter can send 200
    // headers early and then stall while the model generates.
    const timer = setTimeout(() => abort('timeout'), params.timeoutMs);
    const onCancel = () => abort('cancelled');
    if (params.signal) {
        if (params.signal.aborted) onCancel();
        else params.signal.addEventListener('abort', onCancel, { once: true });
    }
    let watchdog: ReturnType<typeof setInterval> | null = null;
    let firstTokenAt: number | null = null;
    let lastTokenAt = started;

    const sendReasoning = !!params.reasoning && params.reasoning !== 'default' && !noReasoningSwitch.has(params.model);
    const body: Record<string, unknown> = {
        model: params.model,
        messages: params.messages,
        response_format: { type: 'json_object' },
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        usage: { include: true },
    };
    if (params.stream) body.stream = true;
    if (sendReasoning) body.reasoning = { enabled: params.reasoning === 'on' };
    if (params.providerSort) body.provider = { sort: params.providerSort };

    const aborted = (err: any): LLMError => {
        if (abortWhy === 'timeout') return new LLMError(`Timed out after ${params.timeoutMs}ms`, undefined, true);
        if (abortWhy === 'first-token') return quick(new LLMError(`No response after ${params.firstTokenMs}ms`, undefined, true));
        if (abortWhy === 'stall') return quick(new LLMError(`Stalled: no tokens for ${params.stallMs}ms`, undefined, true));
        if (abortWhy === 'cancelled') return new LLMError('Cancelled: a parallel request finished first', undefined, false);
        return new LLMError(`Network error: ${err?.message || err}`, undefined, true);
    };

    let data: any;
    try {
        let response: Response;
        try {
            response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${params.apiKey}`,
                    'HTTP-Referer': 'https://carousel.blinkwiser.com',
                    'X-Title': 'Agentic Carousel Generator',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        } catch (err: any) {
            throw aborted(err);
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            if (response.status === 400 && sendReasoning && /reasoning/i.test(text)) {
                // This model/provider can't switch reasoning: stop sending it and retry at once.
                noReasoningSwitch.add(params.model);
                throw quick(new LLMError(`OpenRouter 400 (reasoning switch not supported, retrying without it): ${text.slice(0, 200)}`, 400, true));
            }
            const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
            throw new LLMError(`OpenRouter ${response.status}: ${text.slice(0, 300)}`, response.status, retryable);
        }

        const contentType = (response.headers && typeof response.headers.get === 'function' ? response.headers.get('content-type') : '') || '';
        if (params.stream && response.body && /event-stream/i.test(contentType)) {
            watchdog = setInterval(() => {
                const now = Date.now();
                if (firstTokenAt === null) {
                    if (params.firstTokenMs && now - started > params.firstTokenMs) abort('first-token');
                } else if (params.stallMs && now - lastTokenAt > params.stallMs) {
                    abort('stall');
                }
            }, Math.max(50, Math.min(500, Math.floor(Math.min(params.firstTokenMs || 500, params.stallMs || 500) / 4))));
            let content = '';
            let finish: string | null = null;
            let usage: any = null;
            let streamError: any = null;
            const handleLine = (line: string) => {
                // Lines starting with ":" are keep-alive comments: not progress.
                if (!line.startsWith('data:')) return;
                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') return;
                let chunk: any;
                try { chunk = JSON.parse(payload); } catch { return; }
                if (chunk?.error) { streamError = chunk.error; return; }
                const ch = chunk?.choices?.[0];
                const delta = ch?.delta || {};
                const piece = typeof delta.content === 'string' ? delta.content : '';
                const thinking = (typeof delta.reasoning === 'string' && delta.reasoning.length > 0)
                    || (Array.isArray(delta.reasoning_details) && delta.reasoning_details.length > 0);
                if (piece || thinking) {
                    const now = Date.now();
                    if (firstTokenAt === null) {
                        firstTokenAt = now;
                        params.onFirstToken?.();
                    }
                    lastTokenAt = now;
                }
                if (piece) content += piece;
                if (ch?.finish_reason) finish = ch.finish_reason;
                if (chunk?.usage) usage = chunk.usage;
            };
            try {
                const reader = (response.body as any).getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    let nl: number;
                    while ((nl = buffer.indexOf('\n')) >= 0) {
                        const line = buffer.slice(0, nl).replace(/\r$/, '');
                        buffer = buffer.slice(nl + 1);
                        handleLine(line);
                    }
                }
                if (buffer.trim()) handleLine(buffer.trim());
            } catch (err: any) {
                throw aborted(err);
            }
            if (streamError) {
                const code = Number(streamError.code) || undefined;
                throw new LLMError(`OpenRouter error: ${streamError.message || JSON.stringify(streamError).slice(0, 200)}`, code, !code || code === 429 || code >= 500);
            }
            data = { choices: [{ message: { content }, finish_reason: finish }], usage: usage || {} };
        } else {
            try {
                data = await response.json();
            } catch (err: any) {
                if (abortWhy) throw aborted(err);
                throw new LLMError(`Unreadable response: ${err?.message || err}`, undefined, true);
            }
        }
    } finally {
        clearTimeout(timer);
        if (watchdog) clearInterval(watchdog);
        params.signal?.removeEventListener('abort', onCancel);
    }
    if (data?.error) {
        const code = Number(data.error.code) || undefined;
        throw new LLMError(`OpenRouter error: ${data.error.message || JSON.stringify(data.error).slice(0, 200)}`, code, !code || code === 429 || code >= 500);
    }

    const choice = data?.choices?.[0];
    const cleaned = cleanAndDiagnose(choice, params.model, params.label);
    const u = data?.usage || {};
    const usage = {
        promptTokens: u.prompt_tokens || 0,
        completionTokens: u.completion_tokens || 0,
        totalTokens: u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0),
        cachedTokens: u.prompt_tokens_details?.cached_tokens || u.cached_tokens || 0,
        reasoningTokens: u.completion_tokens_details?.reasoning_tokens || u.reasoning_tokens || 0,
        costUsd: typeof u.cost === 'number' ? u.cost : 0,
    };

    const trimmed = (cleaned || '').trim();
    const paid = (e: LLMError) => { e.usage = usage; return e; };
    if (trimmed.startsWith('User Safety:')) {
        throw paid(new LLMError(LLAMA_GUARD_MESSAGE, 400, false));
    }
    if (!trimmed) throw paid(new LLMError('Empty response', undefined, true));

    let parsed: any;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e: any) {
        const truncated = (choice?.finish_reason ?? choice?.native_finish_reason) === 'length';
        throw paid(new LLMError(`Invalid JSON${truncated ? ' (truncated at max_tokens)' : ''}: ${e?.message || e}`, undefined, true));
    }
    return { content: trimmed, parsed, usage, firstTokenMs: firstTokenAt !== null ? firstTokenAt - started : undefined };
};

/**
 * Hedged request: if the first attempt hasn't produced a token after
 * `hedgeMs`, an identical second request starts; whichever finishes first
 * wins and the other is cancelled. Cuts the long tail of slow providers for
 * a few extra tokens.
 */
const callHedged = (base: CallParams, hedgeMs: number): Promise<RawCall & { hedged: boolean }> => {
    if (!base.stream || !hedgeMs || hedgeMs <= 0) return callOpenRouter(base).then((r) => ({ ...r, hedged: false }));
    return new Promise((resolve, reject) => {
        const controllers: AbortController[] = [];
        let settled = false;
        let running = 0;
        let hedged = false;
        let firstError: any = null;
        let firstTokenSeen = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const launch = () => {
            const ctrl = new AbortController();
            controllers.push(ctrl);
            running++;
            callOpenRouter({
                ...base,
                signal: ctrl.signal,
                onFirstToken: () => {
                    firstTokenSeen = true;
                    if (timer) clearTimeout(timer);
                },
            }).then((r) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                controllers.forEach((c) => { if (c !== ctrl) c.abort(); });
                resolve({ ...r, hedged });
            }).catch((err) => {
                running--;
                if (settled) return;
                if (!firstError) firstError = err;
                // A twin still running gets its chance; otherwise the attempt failed
                // (the retry loop decides what happens next).
                if (running === 0) {
                    settled = true;
                    if (timer) clearTimeout(timer);
                    reject(firstError);
                }
            });
        };
        launch();
        timer = setTimeout(() => {
            timer = null;
            if (settled || firstTokenSeen) return;
            hedged = true;
            launch();
        }, hedgeMs);
    });
};

/**
 * Calls the model for `role`, with retries, timeouts, a fallback chain, JSON
 * parsing, schema validation and one repair retry. Returns parsed JSON.
 * Throws only when every model in the chain failed.
 */
export const generateContent = async ({
    prompt,
    role = 'planner',
    schema,
    temperature,
    systemKeys = {},
    onTokenUsage,
    label,
    langfuseTrace,
    langfuseSpan,
}: GenerateContentParams & { langfuseTrace?: any; langfuseSpan?: any }): Promise<any> => {
    const promptString = typeof prompt === 'object' && prompt !== null ? prompt.prompt || '' : (prompt as string) || '';
    const systemPromptString = typeof prompt === 'object' && prompt !== null ? prompt.systemPrompt : undefined;

    const cfg = roleConfig(role);
    const models = Array.from(new Set([cfg.model, ...fallbackModels()]));
    const apiKey = systemKeys.openrouter;
    if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

    const callLabel = label || role;
    const started = Date.now();
    const totals = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, reasoningTokens: 0, costUsd: 0 };
    const addUsage = (u: RawCall['usage']) => {
        totals.promptTokens += u.promptTokens;
        totals.completionTokens += u.completionTokens;
        totals.totalTokens += u.totalTokens;
        totals.cachedTokens += u.cachedTokens;
        totals.reasoningTokens += u.reasoningTokens || 0;
        totals.costUsd += u.costUsd;
    };
    let hedges = 0;
    let firstTokenMs: number | undefined;
    const failures: string[] = [];
    const speed = { stream: cfg.stream, reasoning: cfg.reasoning, providerSort: providerSort(), firstTokenMs: cfg.firstTokenMs, stallMs: cfg.stallMs };

    const parent = langfuseSpan || langfuseTrace;
    const generation = parent
        ? parent.generation({
            name: `llm:${callLabel}`,
            model: cfg.model,
            modelParameters: { temperature: temperature ?? cfg.temperature, maxTokens: cfg.maxTokens, role },
            input: { systemPrompt: systemPromptString, prompt: promptString },
        })
        : null;

    const messages = [
        { role: 'system', content: systemPromptString ? `${SYSTEM_PROMPT}\n\n${systemPromptString}` : SYSTEM_PROMPT },
        { role: 'user', content: promptString },
    ];

    let attempts = 0;
    let repaired = false;
    let lastError: any = null;
    let usedModel = cfg.model;

    const finish = (value: any) => {
        const report: UsageReport = { ...totals, model: usedModel, role, ms: Date.now() - started, attempts, repaired, firstTokenMs, hedges, failures, ok: true };
        onTokenUsage?.(report);
        if (generation) {
            generation.update({
                model: usedModel,
                output: value,
                usage: { input: totals.promptTokens, output: totals.completionTokens, total: totals.totalTokens },
                metadata: { attempts, repaired, costUsd: totals.costUsd, ms: report.ms },
            });
            generation.end();
        }
        return value;
    };

    for (const model of models) {
        usedModel = model;
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            attempts++;
            try {
                const raw = await callHedged({
                    apiKey,
                    model,
                    messages,
                    temperature: temperature ?? cfg.temperature,
                    maxTokens: cfg.maxTokens,
                    timeoutMs: cfg.timeoutMs,
                    label: callLabel,
                    ...speed,
                }, cfg.hedgeMs);
                if (raw.hedged) hedges++;
                firstTokenMs = raw.firstTokenMs;
                addUsage(raw.usage);

                if (!schema) return finish(raw.parsed);

                let value = unwrapEnvelope(raw.parsed, schema);
                let check = validateAndCoerce(value, schema);
                if (check.errors.length === 0) return finish(check.value);

                // One repair round trip: show the model its own answer and exactly what was wrong.
                console.warn(`[LLM] ${callLabel}: schema mismatch (${check.errors.length}) → repair. First: ${check.errors[0]}`);
                try {
                    attempts++;
                    const fix = await callOpenRouter({
                        ...speed,
                        apiKey,
                        model,
                        messages: [
                            ...messages,
                            { role: 'assistant', content: raw.content.slice(0, 12000) },
                            {
                                role: 'user',
                                content: `Your JSON does not match the required shape. Problems:\n- ${check.errors.slice(0, 12).join('\n- ')}\n\nReturn the corrected JSON only. Required shape: ${describeSchema(schema)}`,
                            },
                        ],
                        temperature: 0,
                        maxTokens: cfg.maxTokens,
                        timeoutMs: cfg.timeoutMs,
                        label: `${callLabel}:repair`,
                    });
                    addUsage(fix.usage);
                    const fixedValue = unwrapEnvelope(fix.parsed, schema);
                    const fixedCheck = validateAndCoerce(fixedValue, schema);
                    repaired = true;
                    if (fixedCheck.errors.length <= check.errors.length) {
                        value = fixedCheck.value;
                        check = fixedCheck;
                    }
                } catch (repairErr: any) {
                    if (repairErr instanceof LLMError && repairErr.usage) addUsage(repairErr.usage);
                    console.warn(`[LLM] ${callLabel}: repair failed (${repairErr?.message}); using coerced original`);
                }
                if (check.errors.length) console.warn(`[LLM] ${callLabel}: returning with ${check.errors.length} residual schema issue(s)`);
                return finish(check.value);
            } catch (err: any) {
                lastError = err;
                if (err instanceof LLMError && err.usage) addUsage(err.usage);
                failures.push(String(err?.message || err).slice(0, 120));
                const retryable = err instanceof LLMError ? err.retryable : true;
                console.warn(`[LLM] ${callLabel} via ${model} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err?.message || err}`);
                if (!retryable) break;
                if (attempt < MAX_ATTEMPTS && !(err instanceof LLMError && err.fastRetry)) await sleep(backoff(attempt));
            }
        }
        // Auth errors won't be fixed by another model on the same key.
        if (lastError instanceof LLMError && (lastError.status === 401 || lastError.status === 403)) break;
        // A Llama Guard refusal is about the content, not the model.
        if (lastError instanceof LLMError && lastError.message === LLAMA_GUARD_MESSAGE) break;
    }

    // Failed calls still cost money: report what was spent before giving up.
    onTokenUsage?.({ ...totals, model: usedModel, role, ms: Date.now() - started, attempts, repaired, hedges, failures, ok: false });
    if (generation) {
        generation.update({ output: String(lastError?.message || lastError), metadata: { error: true, attempts } });
        generation.end();
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
};
