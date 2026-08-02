import { generateContentFromAgent } from '../../services/aiService';
import { ChatMessage, StructuredMemory } from '../../types';

const COMPACT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'The updated, still-compact running summary.' },
  },
  required: ['summary'],
};

const DISTILL_SCHEMA = {
  type: 'object',
  properties: {
    brandRules: { type: 'array', items: { type: 'string' } },
    bannedWords: { type: 'array', items: { type: 'string' } },
    tonePrefs: { type: 'array', items: { type: 'string' } },
    pastDecisions: { type: 'array', items: { type: 'string' } },
  },
  required: ['brandRules', 'bannedWords', 'tonePrefs', 'pastDecisions'],
};

const MAX_SUMMARY_CHARS = 4000;

const capLength = (s: string): string => (s.length > MAX_SUMMARY_CHARS ? s.slice(-MAX_SUMMARY_CHARS) : s);

const deterministicFallback = (existingSummary: string, messages: ChatMessage[]): string => {
  const lines = messages.map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${(m.text || '').slice(0, 200)}`);
  const combined = [existingSummary, ...lines].filter(Boolean).join('\n');
  return capLength(combined);
};

export const MemoryAgent = {
  compactHistory: async (existingSummary: string, messagesToFold: ChatMessage[]): Promise<string> => {
    if (messagesToFold.length === 0) return existingSummary;

    try {
      const transcript = messagesToFold
        .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${(m.text || '').slice(0, 300)}`)
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

  distillStructuredFacts: async (transcript: string): Promise<StructuredMemory> => {
    if (!transcript) {
      return { brandRules: [], bannedWords: [], tonePrefs: [], pastDecisions: [] };
    }

    try {
      const prompt = `
        Analyze the conversation transcript below and distill durable user facts into structured categories.

        TRANSCRIPT:
        ${transcript}

        Categories:
        - brandRules: Explicit brand guidelines (e.g. "always use high contrast background").
        - bannedWords: Words, phrases, or symbols the user explicitly prohibits (e.g. "never use emojis", "banned: synergy").
        - tonePrefs: Voice/tone preferences (e.g. "prefers direct contrarian tone").
        - pastDecisions: Durable decisions or topic preferences made during generation.
      `;

      const result = await generateContentFromAgent(prompt, DISTILL_SCHEMA);
      return {
        brandRules: Array.isArray(result?.brandRules) ? result.brandRules : [],
        bannedWords: Array.isArray(result?.bannedWords) ? result.bannedWords : [],
        tonePrefs: Array.isArray(result?.tonePrefs) ? result.tonePrefs : [],
        pastDecisions: Array.isArray(result?.pastDecisions) ? result.pastDecisions : [],
      };
    } catch (err) {
      console.warn('[MemoryAgent] Distill structured facts failed:', err);
      return { brandRules: [], bannedWords: [], tonePrefs: [], pastDecisions: [] };
    }
  },
};
