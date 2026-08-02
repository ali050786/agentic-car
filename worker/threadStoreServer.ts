/**
 * Per-message conversation thread store (Phase 6.1).
 *
 * Replaces the single JSON-blob-per-carousel `chat_history` document with a
 * proper `chat_messages` collection — one document per message, ordered by a
 * monotonic `seq`, so the unified thread-aware planner can load an ordered
 * thread and append turns cheaply.
 *
 * `migrateThreadIfNeeded` is a one-time, non-destructive backfill from the
 * legacy `chat_history` blob; the old collection is left untouched.
 */

import { databasesServer, serverConfig, ID, Query, Permission, Role } from '../lib/appwriteServer';
import { ChatMessage } from '../types';
import { loadChatServer } from './chatStoreServer';

const COLLECTION = serverConfig.chatMessagesCollectionId;

/** A stored message row → a ChatMessage the agents understand. */
export const rowToMessage = (doc: any): ChatMessage => ({
    id: doc.messageId || doc.$id,
    role: doc.role,
    text: doc.text || '',
    events: doc.events ? safeJson(doc.events, []) : undefined,
    tokenUsage: doc.tokenUsage ? safeJson(doc.tokenUsage, undefined) : undefined,
});

const safeJson = <T>(raw: string, fallback: T): T => {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
};

/** Highest `seq` currently stored for a carousel (‑1 when the thread is empty). */
const maxSeq = async (carouselId: string): Promise<number> => {
    const res = await databasesServer.listDocuments(serverConfig.databaseId, COLLECTION, [
        Query.equal('carouselId', carouselId),
        Query.orderDesc('seq'),
        Query.limit(1),
    ]);
    return res.documents.length ? (res.documents[0] as any).seq : -1;
};

/** Load the full thread for a carousel, ordered oldest → newest. */
export const loadThread = async (carouselId: string, limit = 200): Promise<ChatMessage[]> => {
    try {
        const res = await databasesServer.listDocuments(serverConfig.databaseId, COLLECTION, [
            Query.equal('carouselId', carouselId),
            Query.orderAsc('seq'),
            Query.limit(limit),
        ]);
        return res.documents.map(rowToMessage);
    } catch {
        return [];
    }
};

/** Append one message to a carousel's thread, assigning the next `seq`. */
export const appendMessage = async (
    carouselId: string,
    userId: string,
    msg: ChatMessage,
): Promise<void> => {
    const seq = (await maxSeq(carouselId)) + 1;
    await databasesServer.createDocument(
        serverConfig.databaseId,
        COLLECTION,
        ID.unique(),
        {
            carouselId,
            userId,
            role: msg.role,
            seq,
            text: msg.text || '',
            events: msg.events ? JSON.stringify(msg.events) : undefined,
            tokenUsage: msg.tokenUsage ? JSON.stringify(msg.tokenUsage) : undefined,
            messageId: msg.id,
            createdAt: new Date().toISOString(),
        },
        [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ],
    );
};

/**
 * One-time, idempotent, non-destructive migration: if this carousel has no
 * rows in `chat_messages` yet but a legacy `chat_history` blob exists, backfill
 * every legacy message as a row (preserving order). Safe to call on every turn
 * — it no-ops once the table has any rows for the carousel.
 */
export const migrateThreadIfNeeded = async (carouselId: string, userId: string): Promise<void> => {
    let alreadyMigrated = false;
    try {
        const existing = await databasesServer.listDocuments(serverConfig.databaseId, COLLECTION, [
            Query.equal('carouselId', carouselId),
            Query.limit(1),
        ]);
        alreadyMigrated = existing.documents.length > 0;
    } catch {
        // Collection missing / query failed — treat as not migrated; append will surface real errors.
    }
    if (alreadyMigrated) return;

    const legacy = await loadChatServer(carouselId);
    if (!legacy.messages.length) return;

    let seq = 0;
    for (const msg of legacy.messages) {
        await databasesServer.createDocument(
            serverConfig.databaseId,
            COLLECTION,
            ID.unique(),
            {
                carouselId,
                userId,
                role: msg.role,
                seq: seq++,
                text: msg.text || '',
                events: msg.events ? JSON.stringify(msg.events) : undefined,
                tokenUsage: msg.tokenUsage ? JSON.stringify(msg.tokenUsage) : undefined,
                messageId: msg.id,
                createdAt: new Date().toISOString(),
            },
            [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ],
        );
    }
    console.log(`[threadStore] Migrated ${legacy.messages.length} legacy messages for carousel ${carouselId}.`);
};
