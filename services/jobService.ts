/**
 * Client-side interface to the background worker: dispatch a job, then watch
 * it via Appwrite Realtime (no polling, no dependency on the worker being
 * reachable again after the initial POST).
 */

import client, { account, databases, config } from '../lib/appwriteClient';
import { FreeLimitError } from './aiService';

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined;
const JOBS_COLLECTION_ID = 'generation_jobs';

/**
 * Was going to be a verified Appwrite JWT, but account.createJWT() reliably
 * 501s on this Appwrite Cloud project even with a valid session (looks like a
 * platform-side issue, not this app's config — see worker/auth.ts for
 * details and the rollback path). Falls back to the same client-trusted
 * x-user-id header api/generate.ts already uses. Guests previously had no
 * Appwrite session at all — give them a lightweight anonymous one so their
 * one free trial (still capped client-side in Application.tsx's
 * checkGuestLimit) still has a $id to send.
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

    const res = await fetch(`${WORKER_URL}/jobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
        },
        body: JSON.stringify({ type: params.type, carouselId: params.carouselId, payload: params.payload }),
    });

    if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        throw new FreeLimitError(body?.error || 'Free trial exhausted. Please add your API key to continue.', body?.usageCount);
    }

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
