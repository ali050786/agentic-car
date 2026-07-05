/**
 * CRUD for the `generation_jobs` Appwrite collection — the durable record of
 * every background job, read directly by the browser via Realtime and
 * written here by the worker. See scripts/setupGenerationJobsCollection.ts
 * for the schema this expects.
 */

import { databasesServer, serverConfig, ID, Query, Permission, Role } from '../lib/appwriteServer';

export type JobType = 'create' | 'edit';
export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface GenerationJob {
    $id: string;
    userId: string;
    carouselId: string | null;
    type: JobType;
    status: JobStatus;
    statusMessage: string;
    progress: number;
    payload: string; // JSON
    resultSummary: string;
    seen: boolean;
    error: string;
    $updatedAt: string;
}

const COLLECTION = serverConfig.generationJobsCollectionId;

export const createJob = async (params: {
    userId: string;
    type: JobType;
    carouselId?: string | null;
    payload: unknown;
}): Promise<GenerationJob> => {
    const doc = await databasesServer.createDocument(
        serverConfig.databaseId,
        COLLECTION,
        ID.unique(),
        {
            userId: params.userId,
            carouselId: params.carouselId ?? null,
            type: params.type,
            status: 'queued' as JobStatus,
            statusMessage: 'Queued...',
            progress: 0,
            payload: JSON.stringify(params.payload),
            resultSummary: '',
            seen: false,
            error: '',
        },
        [
            Permission.read(Role.user(params.userId)),
            Permission.update(Role.user(params.userId)),
        ]
    );
    return doc as unknown as GenerationJob;
};

export const updateJob = async (jobId: string, patch: Partial<GenerationJob>): Promise<void> => {
    await databasesServer.updateDocument(serverConfig.databaseId, COLLECTION, jobId, patch as any);
};

export const getJob = async (jobId: string): Promise<GenerationJob> => {
    return databasesServer.getDocument(serverConfig.databaseId, COLLECTION, jobId) as unknown as Promise<GenerationJob>;
};

/** Jobs left `queued` (e.g. the worker crashed before picking them up). */
export const listQueuedJobs = async (): Promise<GenerationJob[]> => {
    const res = await databasesServer.listDocuments(serverConfig.databaseId, COLLECTION, [
        Query.equal('status', 'queued'),
        Query.limit(100),
    ]);
    return res.documents as unknown as GenerationJob[];
};

/** Jobs stuck `running` with no update for longer than staleMs — treated as crashed. */
export const listStaleRunningJobs = async (staleMs: number): Promise<GenerationJob[]> => {
    const res = await databasesServer.listDocuments(serverConfig.databaseId, COLLECTION, [
        Query.equal('status', 'running'),
        Query.limit(100),
    ]);
    const cutoff = Date.now() - staleMs;
    return (res.documents as unknown as GenerationJob[]).filter(j => new Date(j.$updatedAt).getTime() < cutoff);
};
