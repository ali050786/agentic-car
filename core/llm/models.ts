/**
 * Model roles.
 *
 * Every LLM call in the app declares WHAT it is doing (its role), not which
 * model to use. The role decides the model, temperature, output budget and
 * timeout. That keeps decisions like "classification should be deterministic,
 * hook writing should be creative" in one place instead of being hardcoded in
 * each agent, and lets you swap models per role from env without code changes.
 *
 * All roles default to DeepSeek v4 Flash via OpenRouter. Override any role with
 * an env var, e.g. LLM_MODEL_WRITER="anthropic/claude-sonnet-4.5".
 * LLM_FALLBACK_MODELS is a comma-separated chain tried after the primary model
 * exhausts its retries (default: none, so the primary is simply retried).
 */

export type ModelRole =
    /** Classification, gating, routing, extraction. Deterministic. */
    | 'fast'
    /** Briefs, outlines, edit planning. Structured reasoning. */
    | 'planner'
    /** Slide copy. Needs voice and variety. */
    | 'writer'
    /** Hook candidates and other divergent brainstorming. */
    | 'creative'
    /** Critique, scoring, judging. Low temperature, consistent. */
    | 'critic';

export type ReasoningMode = 'off' | 'on' | 'default';

export interface RoleConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    /** Hard cap for the whole call, body included. */
    timeoutMs: number;
    /**
     * Hidden "thinking" before answering. 'off' asks OpenRouter to skip it
     * (much faster on hybrid models), 'on' forces it, 'default' sends nothing.
     */
    reasoning: ReasoningMode;
    /** Stream the answer (enables stall detection and hedging). */
    stream: boolean;
    /** Give up on an attempt when no token has arrived after this long. */
    firstTokenMs: number;
    /** Give up on an attempt when tokens stop arriving for this long. */
    stallMs: number;
    /** Start a second, identical request when the first hasn't produced a token after this long (0 = never). */
    hedgeMs: number;
}

export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

const env = (key: string): string | undefined => {
    try {
        // Works in Node (worker, Vercel) and is a no-op in the browser bundle.
        return typeof process !== 'undefined' ? process.env?.[key] : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Speed defaults. Hidden reasoning is off for every role. The writing roles
 * were switched off after the 2026-09-24 evals: same judge scores (8.0 vs 8.1),
 * 31s instead of 84s per deck, half the cost, and none of the empty responses
 * the reasoning mode produced. Turn it back on per role with
 * LLM_REASONING_WRITER=default (or on). Stalled or silent attempts are cut
 * short and retried instead of waiting for the full timeout.
 */
const BASE: Record<ModelRole, Omit<RoleConfig, 'model'>> = {
    fast: { temperature: 0.1, maxTokens: 2000, timeoutMs: 45_000, reasoning: 'off', stream: true, firstTokenMs: 20_000, stallMs: 15_000, hedgeMs: 9_000 },
    planner: { temperature: 0.3, maxTokens: 4000, timeoutMs: 60_000, reasoning: 'off', stream: true, firstTokenMs: 25_000, stallMs: 18_000, hedgeMs: 12_000 },
    writer: { temperature: 0.75, maxTokens: 8000, timeoutMs: 120_000, reasoning: 'off', stream: true, firstTokenMs: 45_000, stallMs: 20_000, hedgeMs: 18_000 },
    creative: { temperature: 0.95, maxTokens: 2500, timeoutMs: 60_000, reasoning: 'off', stream: true, firstTokenMs: 35_000, stallMs: 18_000, hedgeMs: 14_000 },
    critic: { temperature: 0.15, maxTokens: 4000, timeoutMs: 75_000, reasoning: 'off', stream: true, firstTokenMs: 25_000, stallMs: 18_000, hedgeMs: 12_000 },
};

const num = (v: string | undefined): number | undefined => {
    if (v === undefined || v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

const flagOn = (v: string | undefined, fallback: boolean) =>
    v === undefined || v.trim() === '' ? fallback : !/^(0|off|false|no)$/i.test(v.trim());

const reasoningMode = (v: string | undefined): ReasoningMode | undefined => {
    const t = (v || '').trim().toLowerCase();
    return t === 'off' || t === 'on' || t === 'default' ? t : undefined;
};

export const roleConfig = (role: ModelRole = 'planner'): RoleConfig => {
    const base = BASE[role] ?? BASE.planner;
    const R = role.toUpperCase();
    const model = env(`LLM_MODEL_${R}`) || env('LLM_MODEL_DEFAULT') || DEFAULT_MODEL;
    const temp = Number(env(`LLM_TEMP_${R}`));
    const hedgeOn = flagOn(env('LLM_HEDGE'), true);
    return {
        ...base,
        model,
        temperature: Number.isFinite(temp) ? temp : base.temperature,
        reasoning: reasoningMode(env(`LLM_REASONING_${R}`)) || reasoningMode(env('LLM_REASONING')) || base.reasoning,
        stream: flagOn(env('LLM_STREAM'), base.stream),
        firstTokenMs: num(env(`LLM_FIRST_TOKEN_MS_${R}`)) ?? num(env('LLM_FIRST_TOKEN_MS')) ?? base.firstTokenMs,
        stallMs: num(env(`LLM_STALL_MS_${R}`)) ?? num(env('LLM_STALL_MS')) ?? base.stallMs,
        hedgeMs: hedgeOn ? (num(env(`LLM_HEDGE_MS_${R}`)) ?? base.hedgeMs) : 0,
    };
};

/**
 * OpenRouter provider ordering. "throughput" (default) routes to the provider
 * generating fastest right now; "latency" to the quickest first token;
 * "off" leaves OpenRouter's default load balancing.
 */
export const providerSort = (): 'throughput' | 'latency' | 'price' | null => {
    const v = (env('LLM_PROVIDER_SORT') || 'throughput').trim().toLowerCase();
    return v === 'throughput' || v === 'latency' || v === 'price' ? v : null;
};

export const fallbackModels = (): string[] =>
    (env('LLM_FALLBACK_MODELS') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

export const isModelRole = (v: unknown): v is ModelRole =>
    v === 'fast' || v === 'planner' || v === 'writer' || v === 'creative' || v === 'critic';
