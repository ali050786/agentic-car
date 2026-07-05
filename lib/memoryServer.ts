/**
 * Server-side port of services/memoryService.ts. Same storage location
 * (Appwrite user prefs, `carouselMemory` field) — reads/writes go through
 * the privileged Users API instead of the client-session Account API.
 */

import { usersServer } from './appwriteServer';

const MAX_NOTES = 15;

export const getUserMemory = async (userId: string): Promise<string[]> => {
    try {
        const user = await usersServer.get(userId);
        const notes = (user.prefs as any)?.carouselMemory;
        return Array.isArray(notes) ? notes.filter((n: any) => typeof n === 'string') : [];
    } catch {
        return [];
    }
};

export const rememberUserPreference = async (userId: string, note: string): Promise<void> => {
    const trimmed = note.trim();
    if (!trimmed) return;

    try {
        const user = await usersServer.get(userId);
        const existing = Array.isArray((user.prefs as any)?.carouselMemory) ? (user.prefs as any).carouselMemory : [];
        const lower = trimmed.toLowerCase();
        if (existing.some((n: string) => n.toLowerCase() === lower)) return;

        const updated = [...existing, trimmed].slice(-MAX_NOTES);
        await usersServer.updatePrefs(userId, { ...(user.prefs as any), carouselMemory: updated });
        console.log('[memoryServer] Remembered:', trimmed);
    } catch (e) {
        console.warn('[memoryServer] Failed to persist memory note:', e);
    }
};
