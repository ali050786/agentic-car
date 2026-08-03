/**
 * Node-side replacement for services/aiService.ts's generateContentFromAgent,
 * used when core/agents/*.ts run inside the background worker instead of the
 * browser. The agent files themselves are unmodified — they only ever call
 * generateContentFromAgent(prompt, schema) — so the per-call context (which
 * user, which model, BYOK or system keys) is threaded through AsyncLocalStorage
 * instead of being read from a Zustand store.
 *
 * services/aiService.ts checks `typeof window === 'undefined'` and delegates
 * here so this module is only ever imported under Node.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { generateContent } from './generateContent';
import { langfuse } from './langfuse';

export interface AgentJobContext {
    userId: string;
    selectedModel: string;
    tokenTracker?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cachedTokens: number;
    };
    langfuseTrace?: any;
    langfuseSpan?: any;
}

const storage = new AsyncLocalStorage<AgentJobContext>();

/** Wraps a job's execution so every generateContentFromAgent call inside sees this context. */
export const runWithAgentContext = <T>(ctx: AgentJobContext, fn: () => Promise<T>): Promise<T> => {
    return storage.run(ctx, async () => {
        try {
            const result = await fn();
            return result;
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

export const generateContentFromAgentServer = async (prompt: string | { systemPrompt?: string; prompt: string }, _responseSchema: any) => {
    const ctx = storage.getStore();
    if (!ctx) {
        throw new Error('generateContentFromAgentServer called outside of runWithAgentContext — no job context available');
    }

    return generateContent({
        prompt,
        selectedModel: ctx.selectedModel,
        systemKeys: {
            anthropic: process.env.CLAUDE_API_KEY,
            openrouter: process.env.OPENROUTER_API_KEY,
            groq: process.env.GROQ_API_KEY,
        },
        langfuseTrace: ctx.langfuseTrace,
        langfuseSpan: ctx.langfuseSpan,
        onTokenUsage: (usage) => {
            if (ctx.tokenTracker) {
                ctx.tokenTracker.promptTokens += usage.promptTokens;
                ctx.tokenTracker.completionTokens += usage.completionTokens;
                ctx.tokenTracker.totalTokens += usage.totalTokens;
                ctx.tokenTracker.cachedTokens += usage.cachedTokens;
            }
        }
    });
};
