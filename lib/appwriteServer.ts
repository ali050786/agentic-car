/**
 * Server-side Appwrite client — used only by the background worker (worker/)
 * and the shared agent gateway (core/llm/agentGateway.ts). Reads process.env,
 * never import.meta.env, so it's safe to import under plain Node (tsx), not
 * just under Vite.
 *
 * Requires a privileged Appwrite API key (Console → Settings → API Keys →
 * the key → Scopes) with every checkbox enabled under Databases (collections,
 * attributes, indexes, documents — "databases.read/write" alone only covers
 * documents, not schema changes like creating the generation_jobs collection),
 * Users, and Storage. Set it as APPWRITE_API_KEY — deliberately NOT
 * VITE_-prefixed, since a VITE_ prefix would make Vite inline it into the
 * client bundle.
 */

import { Client, Databases, Storage, Users, Account, ID, Query, Permission, Role } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
    throw new Error(
        'Missing server Appwrite configuration. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID ' +
        'and APPWRITE_API_KEY (a privileged server API key, not the VITE_-prefixed client one).'
    );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

export const databasesServer = new Databases(client);
export const storageServer = new Storage(client);
export const usersServer = new Users(client);

/** Verifies a client-supplied Appwrite JWT and returns the authenticated user. */
export const getUserFromJwt = async (jwt: string) => {
    const jwtClient = new Client().setEndpoint(endpoint!).setProject(projectId!).setJWT(jwt);
    return new Account(jwtClient).get();
};

export { ID, Query, Permission, Role };

export const serverConfig = {
    endpoint,
    projectId,
    databaseId: process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || 'main',
    carouselsCollectionId: process.env.APPWRITE_CAROUSELS_COLLECTION_ID || process.env.VITE_APPWRITE_CAROUSELS_COLLECTION_ID || 'carousels',
    analyticsCollectionId: process.env.APPWRITE_ANALYTICS_COLLECTION_ID || process.env.VITE_APPWRITE_ANALYTICS_COLLECTION_ID || 'user_analytics',
    profilesCollectionId: process.env.APPWRITE_PROFILES_COLLECTION_ID || process.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || 'profiles',
    storageBucketId: process.env.APPWRITE_STORAGE_BUCKET_ID || process.env.VITE_APPWRITE_STORAGE_BUCKET_ID || '',
    chatHistoryCollectionId: 'chat_history',
    generationJobsCollectionId: process.env.APPWRITE_GENERATION_JOBS_COLLECTION_ID || 'generation_jobs',
};
