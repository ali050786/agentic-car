/**
 * One-time setup: creates the `carousel_briefs` collection — one document per
 * carousel (doc id = carouselId), holding the per-carousel living brief
 * (premise / audience / voice / key points) as JSON. The brief is the persisted
 * source of truth, authored at creation and injected into every edit turn so
 * edits stay on-strategy.
 *
 * A separate collection (rather than a column on `carousels`) because that
 * collection has already hit Appwrite's per-row attribute-size limit.
 *
 * Non-destructive + idempotent: skips whatever already exists (409 / existing
 * collection).
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *   APPWRITE_DATABASE_ID=... npx tsx scripts/setupCarouselBriefAttribute.ts
 */
import 'dotenv/config';
import { databasesServer, serverConfig } from '../lib/appwriteServer';

const COLLECTION = 'carousel_briefs';

const attribute = async (fn: () => Promise<any>, label: string) => {
    try {
        await fn();
        console.log(`  ✓ ${label}`);
    } catch (e: any) {
        if (e?.code === 409) console.log(`  = ${label} (already exists)`);
        else throw e;
    }
};

const run = async () => {
    try {
        await databasesServer.getCollection(serverConfig.databaseId, COLLECTION);
        console.log(`Collection "${COLLECTION}" already exists — ensuring attributes only.`);
    } catch (e: any) {
        if (e?.code !== 404) throw e;
        console.log(`Creating collection "${COLLECTION}"...`);
        await databasesServer.createCollection(
            serverConfig.databaseId,
            COLLECTION,
            'Carousel Briefs',
            [],   // no collection-level permissions — per-document only
            true, // documentSecurity
        );
    }

    console.log('Ensuring carousel_briefs attributes...');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, COLLECTION, 'userId', 64, true), 'userId');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, COLLECTION, 'brief', 8000, true), 'brief');
    await attribute(() => databasesServer.createStringAttribute(serverConfig.databaseId, COLLECTION, 'updatedAt', 40, false), 'updatedAt');
};

run()
    .then(() => console.log('\nDone. Per-document Permission.read/update(Role.user(userId)) is set by the worker on write.'))
    .catch(err => {
        console.error('Setup failed:', err);
        process.exit(1);
    });
