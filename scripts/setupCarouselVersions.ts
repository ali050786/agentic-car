/**
 * One-time setup for restore points in the studio chat: creates the
 * `carousel_versions` collection (one snapshot per reply that changed the
 * carousel) and adds `versionId` to `chat_messages` (which reply points at
 * which snapshot). Safe to re-run; skips whatever exists.
 *
 * Talks to the Appwrite REST API with Node's own fetch instead of the
 * node-appwrite SDK: SDK 14 passes an undici 5 dispatcher to Node's built-in
 * fetch, which newer Node versions reject ("fetch failed", cause
 * UND_ERR_INVALID_ARG "invalid onError method").
 *
 * Usage (same env vars as the worker, read from .env):
 *   npm run setup:versions
 */
import 'dotenv/config';

const endpoint = (process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || '').replace(/\/+$/, '');
const project = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';
const db = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || 'main';
const id = process.env.APPWRITE_CAROUSEL_VERSIONS_COLLECTION_ID || 'carousel_versions';
const chatId = process.env.APPWRITE_CHAT_MESSAGES_COLLECTION_ID || 'chat_messages';

class ApiError extends Error {
    constructor(message: string, public code: number) { super(message); }
}

const api = async (method: string, path: string, body?: unknown): Promise<any> => {
    const res = await fetch(`${endpoint}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': project, 'X-Appwrite-Key': apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(`${method} ${path} → ${res.status} ${data?.message || text}`, res.status);
    return data;
};

const step = async (fn: () => Promise<any>, label: string) => {
    try {
        await fn();
        console.log(`  ✓ ${label}`);
    } catch (e: any) {
        if (e?.code === 409) console.log(`  = ${label} (already exists)`);
        else throw e;
    }
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const col = `/databases/${db}/collections/${id}`;

const main = async () => {
    if (!endpoint || !project || !apiKey) throw new Error('Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY in .env');

    try {
        await api('GET', col);
        console.log(`Collection "${id}" exists, adding anything missing...`);
    } catch (e: any) {
        if (e?.code !== 404) throw e;
        console.log(`Creating collection "${id}"...`);
        // documentSecurity on: each snapshot is readable/deletable only by its owner.
        await api('POST', `/databases/${db}/collections`, { collectionId: id, name: 'Carousel Versions', permissions: [], documentSecurity: true });
    }

    console.log('Attributes...');
    const str = (key: string, size: number, required: boolean) => api('POST', `${col}/attributes/string`, { key, size, required });
    await step(() => str('carouselId', 64, true), 'carouselId');
    await step(() => str('userId', 64, true), 'userId');
    await step(() => str('label', 200, false), 'label');
    await step(() => str('snapshot', 1000000, true), 'snapshot');
    await step(() => str('createdAt', 40, true), 'createdAt');

    // Attributes are created asynchronously; indexes fail until they're "available".
    for (let i = 0; i < 30; i++) {
        const { attributes } = await api('GET', `${col}/attributes`);
        const pending = (attributes as any[]).filter((a) => a.status !== 'available');
        if (!pending.length) break;
        console.log(`  waiting for ${pending.map((a) => a.key).join(', ')}...`);
        await wait(2000);
    }

    console.log('Indexes...');
    await step(() => api('POST', `${col}/indexes`, { key: 'carousel_created_idx', type: 'key', attributes: ['carouselId', 'createdAt'] }), 'carouselId + createdAt');

    console.log(`Restore points on "${chatId}"...`);
    try {
        await step(() => api('POST', `/databases/${db}/collections/${chatId}/attributes/string`, { key: 'versionId', size: 64, required: false }), 'chat_messages.versionId');
    } catch (e: any) {
        if (e?.code === 404) console.log(`  ! "${chatId}" not found: run scripts/setupChatMessagesCollection.ts first, then this again.`);
        else throw e;
    }
    console.log('Done. Restore points are enabled.');
};

main().catch((e) => {
    console.error('Setup failed:', e?.message || e);
    if (e?.cause) console.error('Cause:', e.cause?.code || '', e.cause?.message || e.cause);
    process.exit(1);
});
