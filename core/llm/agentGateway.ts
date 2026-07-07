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
import { assertAndConsumeFreeTier } from '../../lib/freeTierServer';

export interface AgentJobContext {
    userId: string;
    selectedModel: string;
}

const storage = new AsyncLocalStorage<AgentJobContext>();

/** Wraps a job's execution so every generateContentFromAgent call inside sees this context. */
export const runWithAgentContext = <T>(ctx: AgentJobContext, fn: () => Promise<T>): Promise<T> => {
    return storage.run(ctx, fn);
};

export const generateContentFromAgentServer = async (prompt: string, _responseSchema: any) => {
    const ctx = storage.getStore();
    if (!ctx) {
        throw new Error('generateContentFromAgentServer called outside of runWithAgentContext — no job context available');
    }

    await assertAndConsumeFreeTier(ctx.userId);

    return generateContent({
        prompt,
        selectedModel: ctx.selectedModel,
        systemKeys: {
            anthropic: process.env.CLAUDE_API_KEY,
            openrouter: process.env.OPENROUTER_API_KEY,
            groq: process.env.GROQ_API_KEY,
        },
    });
};
