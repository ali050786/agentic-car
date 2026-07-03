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

const MAX_NOTES = 15;

/**
 * Read memory notes from the signed-in user's prefs (no network call).
 */
export const getUserMemory = (): string[] => {
    const user = useAuthStore.getState().user;
    const notes = (user?.prefs as any)?.carouselMemory;
    return Array.isArray(notes) ? notes.filter(n => typeof n === 'string') : [];
};

/**
 * Append a memory note (deduped, capped). Fire-and-forget.
 */
export const rememberUserPreference = async (note: string): Promise<void> => {
    const trimmed = note.trim();
    if (!trimmed) return;

    const user = useAuthStore.getState().user;
    if (!user) return;

    const existing = getUserMemory();
    const lower = trimmed.toLowerCase();
    if (existing.some(n => n.toLowerCase() === lower)) return;

    const updated = [...existing, trimmed].slice(-MAX_NOTES);

    try {
        // updatePrefs replaces the whole object — preserve any other prefs
        const merged = { ...(user.prefs as any), carouselMemory: updated };
        const refreshed = await account.updatePrefs(merged);
        useAuthStore.setState({ user: refreshed });
        console.log('[memoryService] Remembered:', trimmed);
    } catch (e) {
        console.warn('[memoryService] Failed to persist memory note:', e);
    }
};
