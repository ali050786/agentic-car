/**
 * One-time setup: creates the Appwrite collections the worker needs
 * (`generation_jobs`, and `chat_history` if it doesn't already exist from
 * the optional client-side feature it was originally built for) — safe to
 * re-run, skips whatever's already there.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *   APPWRITE_DATABASE_ID=... npx tsx scripts/setupGenerationJobsCollection.ts
 *
 * (Reuses the same env vars as the worker — see .env.example.)
 *
 * Note: large string attributes (100000+ chars) occasionally get stuck in
 * "processing" on Appwrite Cloud far longer than normal (minutes instead of
 * seconds) — if `npx tsx scripts/checkAttrs.ts`-style inspection shows one
 * stuck, deleting and recreating that one attribute has resolved it every
 * time so far.
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
            true // documentSecurity: required for the worker's per-document Permission.read/update(Role.user(userId))
        );
    }
};

const setupGenerationJobs = async () => {
    const id = serverConfig.generationJobsCollectionId;
    await ensureCollection(id, 'Generation Jobs');

    console.log('Ensuring generation_jobs attributes...');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'userId', 64, true), 'userId');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'carouselId', 64, false), 'carouselId');
    await attribute(() => databasesServer.createEnumAttribute(serverConfig.databaseId, id, 'type', ['create', 'edit'], true), 'type');
    await attribute(() => databasesServer.createEnumAttribute(serverConfig.databaseId, id, 'status', ['queued', 'running', 'done', 'error'], true), 'status');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'statusMessage', 256, false), 'statusMessage');
    await attribute(() => databasesServer.createIntegerAttribute(serverConfig.databaseId, id, 'progress', false, 0, 100), 'progress');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'payload', 100000, false), 'payload');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'resultSummary', 100000, false), 'resultSummary');
    await attribute(() => databasesServer.createBooleanAttribute(serverConfig.databaseId, id, 'seen', false, false), 'seen');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'error', 2000, false), 'error');

    console.log('Ensuring generation_jobs indexes...');
    await attribute(() => databasesServer.createIndex(serverConfig.databaseId, id, 'userId_idx', IndexType.Key, ['userId']), 'index on userId');
    await attribute(() => databasesServer.createIndex(serverConfig.databaseId, id, 'status_idx', IndexType.Key, ['status']), 'index on status');
};

const setupChatHistory = async () => {
    const id = serverConfig.chatHistoryCollectionId;
    await ensureCollection(id, 'Chat History');

    console.log('Ensuring chat_history attributes...');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'userId', 64, true), 'userId');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'messages', 1000000, false), 'messages');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, id, 'summary', 5000, false), 'summary');
    await attribute(() => databasesServer.createIntegerAttribute(serverConfig.databaseId, id, 'summarizedUpTo', false, 0, undefined, 0), 'summarizedUpTo');
};

const main = async () => {
    await setupGenerationJobs();
    await setupChatHistory();
    console.log('\nDone. Remember: document-level Permission.read/update(Role.user(userId)) is set per-document by the worker (or the client, for chat_history) at creation time.');
};

main().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
});
