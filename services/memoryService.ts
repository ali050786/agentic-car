/**
 * Memory Service - long-term, cross-carousel user memory.
 *
 * Durable preferences ("prefers contrarian tone", "never use emojis")
 * extracted by the orchestrator are stored in Appwrite account prefs —
 * no collection or schema required. Injected into generation and chat
 * prompts so every new carousel starts already knowing the user.
 */

import { account } from '../lib/appwriteClient';
import { useAuthStore } from '../store/useAuthStore';
import { StructuredMemory } from '../types';

const MAX_BUCKET_NOTES = 10;

/**
 * Migration helper from legacy string[] to StructuredMemory
 */
export const migrateMemory = (raw: any): StructuredMemory => {
  const result: StructuredMemory = {
    brandRules: [],
    bannedWords: [],
    tonePrefs: [],
    pastDecisions: [],
  };

  if (!raw) return result;

  if (Array.isArray(raw)) {
    for (const note of raw) {
      if (typeof note !== 'string') continue;
      const lower = note.toLowerCase();
      if (
        lower.includes('banned') ||
        lower.includes('never use') ||
        lower.includes('do not use') ||
        lower.includes('no emoji') ||
        lower.includes('avoid')
      ) {
        result.bannedWords.push(note);
      } else if (
        lower.includes('brand') ||
        lower.includes('color') ||
        lower.includes('logo') ||
        lower.includes('font')
      ) {
        result.brandRules.push(note);
      } else if (
        lower.includes('tone') ||
        lower.includes('style') ||
        lower.includes('voice') ||
        lower.includes('contrarian') ||
        lower.includes('casual')
      ) {
        result.tonePrefs.push(note);
      } else {
        result.pastDecisions.push(note);
      }
    }
    return result;
  }

  if (typeof raw === 'object') {
    return {
      brandRules: Array.isArray(raw.brandRules) ? raw.brandRules.filter((s: any) => typeof s === 'string') : [],
      bannedWords: Array.isArray(raw.bannedWords) ? raw.bannedWords.filter((s: any) => typeof s === 'string') : [],
      tonePrefs: Array.isArray(raw.tonePrefs) ? raw.tonePrefs.filter((s: any) => typeof s === 'string') : [],
      pastDecisions: Array.isArray(raw.pastDecisions) ? raw.pastDecisions.filter((s: any) => typeof s === 'string') : [],
    };
  }

  return result;
};

/**
 * Read memory notes from the signed-in user's prefs (no network call).
 */
export const getUserMemory = (): StructuredMemory => {
  const user = useAuthStore.getState().user;
  const raw = (user?.prefs as any)?.carouselMemory;
  return migrateMemory(raw);
};

/**
 * Append a memory note into the target bucket (deduped, capped). Fire-and-forget.
 */
export const rememberUserPreference = async (
  note: string,
  category: keyof StructuredMemory = 'pastDecisions'
): Promise<void> => {
  const trimmed = note.trim();
  if (!trimmed) return;

  const user = useAuthStore.getState().user;
  if (!user) return;

  const existing = getUserMemory();
  const bucket = existing[category] || [];
  const lower = trimmed.toLowerCase();
  if (bucket.some((n) => n.toLowerCase() === lower)) return;

  const updatedBucket = [...bucket, trimmed].slice(-MAX_BUCKET_NOTES);
  const updatedMemory: StructuredMemory = {
    ...existing,
    [category]: updatedBucket,
  };

  try {
    const merged = { ...(user.prefs as any), carouselMemory: updatedMemory };
    const refreshed = await account.updatePrefs(merged);
    useAuthStore.setState({ user: refreshed });
    console.log(`[memoryService] Remembered in ${category}:`, trimmed);
  } catch (e) {
    console.warn('[memoryService] Failed to persist memory note:', e);
  }
};
