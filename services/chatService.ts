/**
 * Chat Service - reads the chat-driven editor's conversation history.
 *
 * A conversation belongs to a carousel (the library IS the thread list),
 * stored in Appwrite collection `chat_history` (one document per carousel:
 * { userId, messages, summary, summarizedUpTo }). The worker is the only
 * writer (see worker/chatStoreServer.ts) — it saves the conversation as part
 * of every create/edit job, so there's a single source of truth instead of
 * the client racing its own save against the worker's. This module only
 * reads, with a localStorage fallback for carousels that predate the
 * chat_history collection existing (see scripts/setupGenerationJobsCollection.ts).
 */

import { databases, config } from '../lib/appwriteClient';
import { Query } from 'appwrite';
import { ChatMessage } from '../types';

const COLLECTION_ID = 'chat_history';
const localKey = (carouselId: string) => `chat-history-${carouselId}`;

let appwriteAvailable: boolean | null = null;

export interface PersistedChat {
    messages: ChatMessage[];
    summary: string;
    /** How many of the oldest messages are already folded into `summary` (see MemoryAgent). */
    summarizedUpTo: number;
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
                    summary: doc.summary || '',
                    summarizedUpTo: doc.summarizedUpTo || 0,
                };
            }
            return { messages: [], summary: '', summarizedUpTo: 0 };
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
        if (raw) {
            const parsed = JSON.parse(raw);
            return { messages: parsed.messages || [], summary: parsed.summary || '', summarizedUpTo: parsed.summarizedUpTo || 0 };
        }
    } catch { /* corrupted entry — start fresh */ }
    return { messages: [], summary: '', summarizedUpTo: 0 };
};
