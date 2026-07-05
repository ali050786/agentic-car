/**
 * Server-side port of services/chatService.ts. No localStorage fallback here
 * (the worker has no browser) — Appwrite is the only store, using the
 * carousel's own id as the chat document id, same as the client does.
 */

import { databasesServer, serverConfig, Permission, Role } from '../lib/appwriteServer';
import { ChatMessage } from '../types';

const COLLECTION_ID = serverConfig.chatHistoryCollectionId;

export const loadChatServer = async (carouselId: string): Promise<{ messages: ChatMessage[]; summary: string; summarizedUpTo: number }> => {
    try {
        const doc: any = await databasesServer.getDocument(serverConfig.databaseId, COLLECTION_ID, carouselId);
        return {
            messages: JSON.parse(doc.messages || '[]'),
            summary: doc.summary || '',
            summarizedUpTo: doc.summarizedUpTo || 0,
        };
    } catch {
        return { messages: [], summary: '', summarizedUpTo: 0 };
    }
};

export const saveChatServer = async (
    carouselId: string,
    userId: string,
    messages: ChatMessage[],
    summary: string,
    summarizedUpTo: number = 0
): Promise<void> => {
    const clean = messages.map(m => ({ ...m, running: false }));
    const body = { userId, messages: JSON.stringify(clean), summary, summarizedUpTo };

    try {
        await databasesServer.updateDocument(serverConfig.databaseId, COLLECTION_ID, carouselId, body);
    } catch (e: any) {
        if (e?.code === 404) {
            await databasesServer.createDocument(serverConfig.databaseId, COLLECTION_ID, carouselId, body, [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ]);
        } else {
            throw e;
        }
    }
};
