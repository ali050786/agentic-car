import { usersServer } from './appwriteServer';
import { StructuredMemory } from '../types';
import { migrateMemory } from '../services/memoryService';

const MAX_BUCKET_NOTES = 10;

export const getUserMemory = async (userId: string): Promise<StructuredMemory> => {
  try {
    const user = await usersServer.get(userId);
    const raw = (user.prefs as any)?.carouselMemory;
    return migrateMemory(raw);
  } catch {
    return {
      brandRules: [],
      bannedWords: [],
      tonePrefs: [],
      pastDecisions: [],
    };
  }
};

export const rememberUserPreference = async (
  userId: string,
  note: string,
  category: keyof StructuredMemory = 'pastDecisions'
): Promise<void> => {
  const trimmed = note.trim();
  if (!trimmed) return;

  try {
    const user = await usersServer.get(userId);
    const existing = migrateMemory((user.prefs as any)?.carouselMemory);
    const bucket = existing[category] || [];
    const lower = trimmed.toLowerCase();
    if (bucket.some((n) => n.toLowerCase() === lower)) return;

    const updatedBucket = [...bucket, trimmed].slice(-MAX_BUCKET_NOTES);
    const updatedMemory: StructuredMemory = {
      ...existing,
      [category]: updatedBucket,
    };

    await usersServer.updatePrefs(userId, { ...(user.prefs as any), carouselMemory: updatedMemory });
    console.log(`[memoryServer] Remembered in ${category}:`, trimmed);
  } catch (e) {
    console.warn('[memoryServer] Failed to persist memory note:', e);
  }
};
