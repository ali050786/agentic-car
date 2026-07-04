/**
 * Conversation compaction — keeps long chat sessions coherent without an
 * unbounded transcript. The orchestrator only ever sees the last ~10 raw
 * messages (see OrchestratorAgent's recentMessages slice); once a
 * conversation grows past that window, this folds the messages about to
 * scroll out into the rolling per-carousel summary instead of just
 * dropping them — a running "what's happened" account, not just the
 * durable-preference notes memoryNote already captures.
 *
 * Never blocks or breaks the chat: a failed compaction falls back to a
 * deterministic (non-LLM) fold so nothing is silently lost, and the result
 * is hard-capped so it can never grow past what a persisted field can hold.
 */

import { generateContentFromAgent } from '../../services/aiService';
import { ChatMessage } from '../../types';

const COMPACT_SCHEMA = {
    type: 'object',
    properties: {
        summary: { type: 'string', description: 'The updated, still-compact running summary.' },
    },
    required: ['summary'],
};

const MAX_SUMMARY_CHARS = 4000;

const capLength = (s: string): string => (s.length > MAX_SUMMARY_CHARS ? s.slice(-MAX_SUMMARY_CHARS) : s);

const deterministicFallback = (existingSummary: string, messages: ChatMessage[]): string => {
    const lines = messages.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${(m.text || '').slice(0, 200)}`);
    const combined = [existingSummary, ...lines].filter(Boolean).join('\n');
    return capLength(combined);
};

export const MemoryAgent = {
    /**
     * Folds `messagesToFold` (older messages about to leave the raw-history
     * window) into `existingSummary`, returning an updated, still-compact
     * summary — merged and condensed, not just appended.
     */
    compactHistory: async (existingSummary: string, messagesToFold: ChatMessage[]): Promise<string> => {
        if (messagesToFold.length === 0) return existingSummary;

        try {
            const transcript = messagesToFold
                .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${(m.text || '').slice(0, 300)}`)
                .join('\n');

            const prompt = `
        You maintain a compact running summary of an ongoing carousel-editing conversation
        between a user and an AI design partner. The messages below are about to scroll out
        of the visible window — fold anything worth remembering into the summary.

        EXISTING SUMMARY (may be empty):
        ${existingSummary || '(none yet)'}

        OLDER MESSAGES TO FOLD IN:
        ${transcript}

        Rewrite the summary to include what's worth keeping from these messages — edits made,
        decisions taken, angles tried, preferences expressed. Do NOT just append: merge and
        condense so the whole thing stays under ~150 words. Drop anything superseded by a later
        message (e.g. if the user changed their mind, keep the final answer, not the reversed one).
        Return ONLY the updated summary text.
      `;

            const result = await generateContentFromAgent(prompt, COMPACT_SCHEMA);
            const summary = typeof result?.summary === 'string' ? result.summary.trim() : '';

            if (!summary) {
                console.warn('[MemoryAgent] Empty summary returned — using deterministic fallback');
                return deterministicFallback(existingSummary, messagesToFold);
            }

            return capLength(summary);
        } catch (err) {
            console.warn('[MemoryAgent] Compaction failed, using deterministic fallback:', err);
            return deterministicFallback(existingSummary, messagesToFold);
        }
    },
};
