/**
 * Client-side interface to the background worker: dispatch a job, then watch
 * it via Appwrite Realtime (no polling, no dependency on the worker being
 * reachable again after the initial POST).
 */

import client, { account, databases, config } from '../lib/appwriteClient';

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined;
const JOBS_COLLECTION_ID = 'generation_jobs';

/**
 * Was going to be a verified Appwrite JWT, but account.createJWT() reliably
 * 501s on this Appwrite Cloud project even with a valid session (looks like a
 * platform-side issue, not this app's config — see worker/auth.ts for
 * details and the rollback path). Falls back to the same client-trusted
 * x-user-id header api/generate.ts already uses. Guests previously had no
 * Appwrite session at all — give them a lightweight anonymous one so they
 * still have a $id to send.
 */
const getUserId = async (): Promise<string> => {
    try {
        return (await account.get()).$id;
    } catch {
        return (await account.createAnonymousSession()).userId;
    }
};

export interface GenerationJob {
    $id: string;
    $updatedAt: string;
    userId: string;
    carouselId: string | null;
    type: 'create' | 'edit';
    status: 'queued' | 'running' | 'done' | 'error';
    statusMessage: string;
    progress: number;
    payload: string;
    resultSummary: string;
    seen: boolean;
    error: string;
}

export class WorkerUnavailableError extends Error {
    constructor(message = 'Background worker is not configured or unreachable') {
        super(message);
        this.name = 'WorkerUnavailableError';
    }
}

/** Dispatches a job to the worker; the worker owns everything from here on. */
export const createJob = async (params: {
    type: 'create' | 'edit';
    carouselId?: string | null;
    payload: unknown;
}): Promise<{ jobId: string; carouselId: string | null }> => {
    if (!WORKER_URL) throw new WorkerUnavailableError();

    const userId = await getUserId();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-id': userId,
    };

    try {
        const { getClientJwt } = await import('../lib/appwriteClient');
        const jwt = await getClientJwt();
        headers['Authorization'] = `Bearer ${jwt}`;
    } catch (err) {
        console.error('[jobService] Failed to fetch auth token for job:', err);
    }

    const res = await fetch(`${WORKER_URL}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: params.type, carouselId: params.carouselId, payload: params.payload }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to create job (${res.status})`);
    }

    return res.json();
};

export const getJob = async (jobId: string): Promise<GenerationJob> => {
    return databases.getDocument(config.databaseId, JOBS_COLLECTION_ID, jobId) as unknown as Promise<GenerationJob>;
};

export const markJobSeen = async (jobId: string): Promise<void> => {
    await databases.updateDocument(config.databaseId, JOBS_COLLECTION_ID, jobId, { seen: true });
};

export const cancelJob = async (jobId: string): Promise<void> => {
    await databases.updateDocument(config.databaseId, JOBS_COLLECTION_ID, jobId, {
        status: 'error',
        statusMessage: 'Cancelled.',
        error: 'Cancelled by user'
    });
};

import { Query } from 'appwrite';

export const getActiveJobForCarousel = async (carouselId: string): Promise<GenerationJob | null> => {
    try {
        const response = await databases.listDocuments(
            config.databaseId,
            JOBS_COLLECTION_ID,
            [
                Query.equal('carouselId', carouselId),
                Query.orderDesc('$updatedAt'),
                Query.limit(1)
            ]
        );
        if (response.documents.length > 0) {
            const job = response.documents[0] as unknown as GenerationJob;
            if (job.status === 'queued' || job.status === 'running') {
                return job;
            }
        }
        return null;
    } catch (err) {
        console.error('[jobService] getActiveJobForCarousel error:', err);
        return null;
    }
};

/** Fires immediately with the current state, then on every subsequent update. Returns an unsubscribe function. */
export const subscribeToJob = (jobId: string, onUpdate: (job: GenerationJob) => void): (() => void) => {
    getJob(jobId).then(onUpdate).catch(() => {});
    const channel = `databases.${config.databaseId}.collections.${JOBS_COLLECTION_ID}.documents.${jobId}`;
    return client.subscribe(channel, (event) => onUpdate(event.payload as GenerationJob));
};

/** Watches every job event for this user's collection — used by the sidebar to badge carousels. */
export const subscribeToUserJobs = (userId: string, onEvent: (job: GenerationJob) => void): (() => void) => {
    const channel = `databases.${config.databaseId}.collections.${JOBS_COLLECTION_ID}.documents`;
    return client.subscribe(channel, (event) => {
        const job = event.payload as GenerationJob;
        if (job.userId === userId) onEvent(job);
    });
};
