/**
 * Chat Service - persistence for the chat-driven editor.
 *
 * A conversation belongs to a carousel (the library IS the thread list).
 * Primary store: Appwrite collection `chat_history` (one document per
 * carousel: { userId, messages, summary }). If the collection does not
 * exist yet, everything transparently falls back to localStorage so the
 * feature works before any console setup — create the collection later
 * and syncing goes cross-device with zero code changes.
 *
 * Appwrite setup (optional, for cross-device sync):
 *   Collection id: chat_history
 *   Attributes: userId (string 64), messages (string 1000000), summary (string 5000)
 *   Permissions: document-level, users can create/read/update their own
 */

import { databases, config, ID } from '../lib/appwriteClient';
import { Permission, Role, Query } from 'appwrite';
import { ChatMessage } from '../types';

const COLLECTION_ID = 'chat_history';
const localKey = (carouselId: string) => `chat-history-${carouselId}`;

let appwriteAvailable: boolean | null = null;

export interface PersistedChat {
    messages: ChatMessage[];
    summary: string;
}

/**
 * Load the conversation for a carousel. Appwrite first, localStorage fallback.
 */
export const loadChat = async (carouselId: string, userId: string): Promise<PersistedChat> => {
    if (appwriteAvailable !== false) {
        try {
            const res = await databases.listDocuments(config.databaseId, COLLECTION_ID, [
                Query.equal('$id', carouselId),
                Query.limit(1)
            ]);
            appwriteAvailable = true;
            if (res.documents.length > 0) {
                const doc: any = res.documents[0];
                return {
                    messages: JSON.parse(doc.messages || '[]'),
                    summary: doc.summary || ''
                };
            }
            return { messages: [], summary: '' };
        } catch (e: any) {
            if (e?.code === 404) {
                appwriteAvailable = false;
                console.warn('[chatService] chat_history collection missing — using localStorage fallback');
            } else {
                console.warn('[chatService] load failed, trying localStorage:', e?.message);
            }
        }
    }

    try {
        const raw = localStorage.getItem(localKey(carouselId));
        if (raw) return JSON.parse(raw);
    } catch { /* corrupted entry — start fresh */ }
    return { messages: [], summary: '' };
};

/**
 * Save the conversation. Fire-and-forget; never blocks the UI.
 */
export const saveChat = async (
    carouselId: string,
    userId: string,
    messages: ChatMessage[],
    summary: string
): Promise<void> => {
    // Strip transient flags before persisting
    const clean = messages.map(m => ({ ...m, running: false }));
    const payload: PersistedChat = { messages: clean, summary };

    try {
        localStorage.setItem(localKey(carouselId), JSON.stringify(payload));
    } catch { /* storage full — Appwrite may still work */ }

    if (appwriteAvailable === false) return;

    try {
        const body = { userId, messages: JSON.stringify(clean), summary };
        try {
            await databases.updateDocument(config.databaseId, COLLECTION_ID, carouselId, body);
        } catch (e: any) {
            if (e?.code === 404 && e?.type !== 'collection_not_found') {
                // Document missing — create it with the carousel's id so lookups are O(1)
                await databases.createDocument(config.databaseId, COLLECTION_ID, carouselId, body, [
                    Permission.read(Role.user(userId)),
                    Permission.update(Role.user(userId)),
                    Permission.delete(Role.user(userId)),
                ]);
            } else {
                throw e;
            }
        }
        appwriteAvailable = true;
    } catch (e: any) {
        if (e?.code === 404) {
            appwriteAvailable = false;
        } else {
            console.warn('[chatService] Appwrite save failed (localStorage copy kept):', e?.message);
        }
    }
};
