/**
 * Chat Service - reads the chat-driven editor's conversation history.
 *
 * A conversation belongs to a carousel (the library IS the thread list). The
 * worker is the only writer: it appends one row per message to the ordered
 * `chat_messages` collection on every create/edit turn (see
 * worker/threadStoreServer.ts), so there's a single source of truth instead of
 * the client racing its own save. This module only reads — the `chat_messages`
 * thread first, then falling back to the legacy `chat_history` blob for old
 * carousels not yet migrated, then localStorage.
 */

import { databases, config } from '../lib/appwriteClient';
import { Query } from 'appwrite';
import { ChatMessage } from '../types';

const COLLECTION_ID = 'chat_history';
const MESSAGES_COLLECTION_ID = 'chat_messages';
const localKey = (carouselId: string) => `chat-history-${carouselId}`;

let appwriteAvailable: boolean | null = null;

/** A stored chat_messages row → a ChatMessage (mirrors worker/threadStoreServer.rowToMessage). */
const rowToMessage = (doc: any): ChatMessage => {
    const safe = <T>(raw: string, fb: T): T => { try { return JSON.parse(raw) as T; } catch { return fb; } };
    return {
        id: doc.messageId || doc.$id,
        role: doc.role,
        text: doc.text || '',
        events: doc.events ? safe(doc.events, undefined) : undefined,
        tokenUsage: doc.tokenUsage ? safe(doc.tokenUsage, undefined) : undefined,
    };
};

/**
 * Load the ordered per-message thread the worker now writes (`chat_messages`).
 * Returns null when the table has no rows for this carousel (e.g. an old
 * carousel whose thread still lives in the legacy `chat_history` blob and
 * hasn't been migrated by an edit yet) so the caller can fall back.
 */
const loadThreadMessages = async (carouselId: string): Promise<ChatMessage[] | null> => {
    try {
        const res = await databases.listDocuments(config.databaseId, MESSAGES_COLLECTION_ID, [
            Query.equal('carouselId', carouselId),
            Query.orderAsc('seq'),
            Query.limit(200),
        ]);
        if (res.documents.length === 0) return null;
        return res.documents.map(rowToMessage);
    } catch {
        // Collection missing / query failed — let the caller use the legacy blob.
        return null;
    }
};

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
    // Source of truth: the ordered `chat_messages` thread the worker appends to
    // on every create/edit turn. Only fall through to the legacy blob when this
    // carousel has no rows there yet (pre-migration).
    const thread = await loadThreadMessages(carouselId);
    if (thread) {
        return { messages: thread, summary: '', summarizedUpTo: 0 };
    }

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
