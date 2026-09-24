/**
 * Node-side replacement for services/aiService.ts's generateContentFromAgent,
 * used when core/agents/*.ts run inside the background worker (or evals)
 * instead of the browser. The per-job context (user, token/cost tracking,
 * tracing, optional mock model) is threaded through AsyncLocalStorage.
 *
 * Spans: withSpan() runs its callback in a CHILD context that carries its own
 * Langfuse span. Previously one mutable `langfuseSpan` slot was shared by the
 * whole job, so parallel calls (proofread chunks, doodles) overwrote each
 * other and traces were misattributed. Now each branch keeps its own parent.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { generateContent, UsageReport } from './generateContent';
import { langfuse } from './langfuse';
import type { ModelRole } from './models';
import type { JsonSchema } from './schema';
import { validateAndCoerce, unwrapEnvelope } from './schema';

export interface TokenTracker {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
    costUsd?: number;
}

/** One finished step (span) or model call, for the job's trace summary. */
export interface StepMetric {
    kind: 'step' | 'llm';
    name: string;
    ms: number;
    ok: boolean;
    model?: string;
    role?: ModelRole;
    tokens?: number;
    costUsd?: number;
    attempts?: number;
    /** Wall-clock start (epoch ms), so a report can lay steps on a timeline. */
    at?: number;
    reasoningTokens?: number;
    /** Time to first token of the successful attempt (streamed calls). */
    firstTokenMs?: number;
    /** Parallel twins launched for slow starts. */
    hedges?: number;
    /** Why failed attempts failed (timeouts, stalls, 5xx…). */
    failures?: string[];
}

export interface MockLLMRequest {
    role: ModelRole;
    label: string;
    systemPrompt?: string;
    prompt: string;
    schema?: JsonSchema;
}

export interface AgentJobContext {
    userId: string;
    selectedModel: string;
    tokenTracker?: TokenTracker;
    langfuseTrace?: any;
    langfuseSpan?: any;
    /** Collected step/LLM metrics (shared by reference across child contexts). */
    metrics?: StepMetric[];
    /** Offline tests / evals: answer model calls without the network. */
    mockLLM?: (req: MockLLMRequest) => any | Promise<any>;
    /** True once the job is stopped (user cancel, or the pipeline already refused): new model calls throw. */
    isCancelled?: () => boolean;
}

export interface AgentCallOptions {
    role?: ModelRole;
    label?: string;
    temperature?: number;
}

const storage = new AsyncLocalStorage<AgentJobContext>();

export const currentAgentContext = (): AgentJobContext | undefined => storage.getStore();

/** Wraps a job's execution so every generateContentFromAgent call inside sees this context. */
export const runWithAgentContext = <T>(ctx: AgentJobContext, fn: () => Promise<T>): Promise<T> => {
    if (!ctx.metrics) ctx.metrics = [];
    return storage.run(ctx, async () => {
        try {
            return await fn();
        } finally {
            if (langfuse) {
                try {
                    await langfuse.flushAsync();
                } catch (err) {
                    console.error('[agentGateway] Langfuse flush failed:', err);
                }
            }
        }
    });
};

/**
 * Runs `fn` as a named step: its own Langfuse span, its own child context (so
 * concurrent steps never share a span), and a timing metric. Safe to call with
 * no active context (it just runs fn).
 */
export const withSpan = async <R>(name: string, input: any, fn: () => Promise<R>): Promise<R> => {
    const parent = storage.getStore();
    if (!parent) return fn();
    const host = parent.langfuseSpan || parent.langfuseTrace;
    const span = host ? host.span({ name, input }) : null;
    const child: AgentJobContext = { ...parent, langfuseSpan: span };
    const started = Date.now();
    try {
        const out = await storage.run(child, fn);
        span?.end({ output: summarizeForTrace(out) });
        parent.metrics?.push({ kind: 'step', name, ms: Date.now() - started, ok: true, at: started });
        return out;
    } catch (err: any) {
        span?.end({ output: { error: err?.message || String(err) }, level: 'ERROR' });
        parent.metrics?.push({ kind: 'step', name, ms: Date.now() - started, ok: false, at: started });
        throw err;
    }
};

/**
 * Runs `fn` in a child context that also counts as cancelled when
 * `isCancelled()` is true, so side work still in flight after a pipeline has
 * decided (e.g. refused a deck) stops at its next model call.
 */
export const withCancel = <R>(isCancelled: () => boolean, fn: () => Promise<R>): Promise<R> => {
    const parent = storage.getStore();
    if (!parent) return fn();
    const child: AgentJobContext = { ...parent, isCancelled: () => !!parent.isCancelled?.() || isCancelled() };
    return storage.run(child, fn);
};

/** Keeps trace payloads readable (no 50KB SVG strings). */
const summarizeForTrace = (value: any): any => {
    try {
        const s = JSON.stringify(value);
        if (!s) return value;
        return s.length > 6000 ? { preview: s.slice(0, 6000), truncated: true, length: s.length } : value;
    } catch {
        return '[unserializable]';
    }
};

const record = (ctx: AgentJobContext, usage: UsageReport, label: string) => {
    if (ctx.tokenTracker) {
        ctx.tokenTracker.promptTokens += usage.promptTokens;
        ctx.tokenTracker.completionTokens += usage.completionTokens;
        ctx.tokenTracker.totalTokens += usage.totalTokens;
        ctx.tokenTracker.cachedTokens += usage.cachedTokens;
        ctx.tokenTracker.costUsd = (ctx.tokenTracker.costUsd || 0) + usage.costUsd;
    }
    ctx.metrics?.push({
        kind: 'llm',
        name: label,
        ms: usage.ms,
        ok: usage.ok !== false,
        model: usage.model,
        role: usage.role,
        tokens: usage.totalTokens,
        costUsd: usage.costUsd,
        attempts: usage.attempts,
        at: Date.now() - usage.ms,
        reasoningTokens: usage.reasoningTokens || 0,
        firstTokenMs: usage.firstTokenMs,
        hedges: usage.hedges || 0,
        failures: usage.failures?.length ? usage.failures.slice(0, 6) : undefined,
    });
};

export const generateContentFromAgentServer = async (
    prompt: string | { systemPrompt?: string; prompt: string },
    responseSchema: any,
    options: AgentCallOptions = {},
) => {
    const ctx = storage.getStore();
    if (!ctx) {
        throw new Error('generateContentFromAgentServer called outside of runWithAgentContext — no job context available');
    }
    const role = options.role || 'planner';
    const label = options.label || role;
    if (ctx.isCancelled?.()) throw new Error(`Cancelled: job stopped before ${label}`);

    if (ctx.mockLLM) {
        const req: MockLLMRequest = {
            role,
            label,
            systemPrompt: typeof prompt === 'object' ? prompt.systemPrompt : undefined,
            prompt: typeof prompt === 'object' ? prompt.prompt : prompt,
            schema: responseSchema,
        };
        const started = Date.now();
        let raw: any;
        try {
            raw = await ctx.mockLLM(req);
        } catch (err) {
            record(ctx, { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, costUsd: 0, model: 'mock', role, ms: Date.now() - started, attempts: 1, repaired: false, ok: false, failures: [String((err as any)?.message || err).slice(0, 120)] }, label);
            throw err;
        }
        const value = responseSchema ? validateAndCoerce(unwrapEnvelope(raw, responseSchema), responseSchema).value : raw;
        record(ctx, { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, costUsd: 0, model: 'mock', role, ms: Date.now() - started, attempts: 1, repaired: false }, label);
        return value;
    }

    return generateContent({
        prompt,
        role,
        schema: responseSchema,
        temperature: options.temperature,
        label,
        systemKeys: {
            anthropic: process.env.CLAUDE_API_KEY,
            openrouter: process.env.OPENROUTER_API_KEY,
            groq: process.env.GROQ_API_KEY,
        },
        langfuseTrace: ctx.langfuseTrace,
        langfuseSpan: ctx.langfuseSpan,
        onTokenUsage: (usage) => record(ctx, usage, label),
    });
};

/** Compact per-step summary stored on the job result (for the UI and debugging). */
export const summarizeMetrics = (metrics: StepMetric[] = []) => {
    const steps = metrics.filter((m) => m.kind === 'step');
    const llm = metrics.filter((m) => m.kind === 'llm');
    const t0 = Math.min(...metrics.map((m) => m.at ?? Infinity));
    const rel = (m: StepMetric) => (Number.isFinite(t0) && m.at !== undefined ? m.at - t0 : undefined);
    return {
        steps: steps.map((s) => ({ name: s.name, ms: s.ms, ok: s.ok, start: rel(s) })),
        llmCalls: llm.length,
        llmMs: llm.reduce((a, m) => a + m.ms, 0),
        retries: llm.reduce((a, m) => a + Math.max(0, (m.attempts || 1) - 1), 0),
        hedges: llm.reduce((a, m) => a + (m.hedges || 0), 0),
        reasoningTokens: llm.reduce((a, m) => a + (m.reasoningTokens || 0), 0),
        costUsd: Number(llm.reduce((a, m) => a + (m.costUsd || 0), 0).toFixed(5)),
    };
};
