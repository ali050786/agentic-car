/**
 * One-time setup (Phase 6.1): creates the `chat_messages` collection — one
 * document per conversation message, ordered by `seq` — used by the unified
 * thread-aware carousel agent. Safe to re-run; skips whatever already exists.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *   APPWRITE_DATABASE_ID=... npx tsx scripts/setupChatMessagesCollection.ts
 *
 * (Reuses the same env vars as the worker — see .env.example.)
 *
 * Note: the large `text` attribute (100000 chars) can sit in "processing" on
 * Appwrite Cloud longer than usual; if it gets stuck, deleting and recreating
 * just that one attribute has resolved it reliably.
 */
import 'dotenv/config';
import { IndexType } from 'node-appwrite';
import { databasesServer, serverConfig } from '../lib/appwriteServer';

const attribute = async (fn: () => Promise<any>, label: string) => {
    try {
        await fn();
        console.log(`  ✓ ${label}`);
    } catch (e: any) {
        if (e?.code === 409) {
            console.log(`  = ${label} (already exists)`);
        } else {
            throw e;
        }
    }
};

const ensureCollection = async (collectionId: string, name: string) => {
    try {
        await databasesServer.getCollection(serverConfig.databaseId, collectionId);
        console.log(`Collection "${collectionId}" already exists — skipping creation, only adding any missing attributes/indexes.`);
    } catch (e: any) {
        if (e?.code !== 404) throw e;
        console.log(`Creating collection "${collectionId}"...`);
        await databasesServer.createCollection(
            serverConfig.databaseId,
            collectionId,
            name,
            [], // no collection-level permissions — access is per-document only
            true // documentSecurity: per-document Permission.read/update(Role.user(userId))
        );
    }
};

const setupChatMessages = async () => {
    const id = serverConfig.chatMessagesCollectionId;
    await ensureCollection(id, 'Chat Messages');

    console.log('Ensuring chat_messages attributes...');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'carouselId', 64, true), 'carouselId');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'userId', 64, true), 'userId');
    await attribute(() => databasesServer.createEnumAttribute(serverConfig.databaseId, id, 'role', ['user', 'assistant'], true), 'role');
    await attribute(() => databasesServer.createIntegerAttribute(serverConfig.databaseId, id, 'seq', true), 'seq');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'text', 100000, false), 'text');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'events', 100000, false), 'events');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'tokenUsage', 2000, false), 'tokenUsage');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'intent', 32, false), 'intent');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'messageId', 64, false), 'messageId');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'createdAt', 40, false), 'createdAt');

    console.log('Ensuring chat_messages indexes...');
    // Ordered read of a carousel's thread (carouselId filter + seq order).
    await attribute(() => databasesServer.createIndex(serverConfig.databaseId, id, 'carousel_seq_idx', IndexType.Key, ['carouselId', 'seq']), 'index on carouselId+seq');
    await attribute(() => databasesServer.createIndex(serverConfig.databaseId, id, 'carousel_idx', IndexType.Key, ['carouselId']), 'index on carouselId');
};

setupChatMessages()
    .then(() => console.log('\nDone. Per-document Permission.read/update/delete(Role.user(userId)) is set by the worker at message-creation time.'))
    .catch(err => {
        console.error('Setup failed:', err);
        process.exit(1);
    });
