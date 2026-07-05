/**
 * In-process FIFO job queue. Durability comes from Appwrite (every job's
 * status/progress is persisted there), not from this queue — on boot it
 * re-enqueues anything left `queued` and fails anything stuck `running`
 * past the staleness window (the worker that owned it presumably crashed).
 *
 * The staleness check also re-runs periodically (see startStalenessWatcher),
 * not just at boot — a job orphaned by a mid-flight restart would otherwise
 * sit at "running" forever until the *next* restart, since nothing else
 * would ever re-check it.
 */

import { GenerationJob, listQueuedJobs, listStaleRunningJobs, updateJob } from './jobStore';

const STALE_RUNNING_MS = 10 * 60 * 1000; // 10 minutes
const CONCURRENCY = 2;

type JobHandler = (job: GenerationJob) => Promise<void>;

const pending: string[] = [];
let active = 0;
let handler: JobHandler | null = null;

const runNext = () => {
    if (active >= CONCURRENCY || pending.length === 0 || !handler) return;
    const jobId = pending.shift()!;
    active++;

    (async () => {
        try {
            const { getJob } = await import('./jobStore');
            const job = await getJob(jobId);
            if (job.status !== 'queued') return; // already handled (e.g. resumed twice)
            await handler!(job);
        } catch (err: any) {
            console.error(`[queue] Job ${jobId} failed:`, err);
            await updateJob(jobId, { status: 'error', error: err?.message || String(err) }).catch(() => {});
        } finally {
            active--;
            runNext();
        }
    })();
};

export const enqueue = (jobId: string) => {
    pending.push(jobId);
    runNext();
};

export const setHandler = (fn: JobHandler) => {
    handler = fn;
};

const checkStaleJobs = async () => {
    const stale = await listStaleRunningJobs(STALE_RUNNING_MS);
    for (const job of stale) {
        console.warn(`[queue] Marking stale running job ${job.$id} as error (no update for >${STALE_RUNNING_MS / 60000}m)`);
        await updateJob(job.$id, { status: 'error', error: 'Worker restarted mid-job — please retry.' }).catch(() => {});
    }
};

/** Call once at startup: resume anything left queued, fail anything stuck running. */
export const resumeOnBoot = async () => {
    await checkStaleJobs();

    const queued = await listQueuedJobs();
    console.log(`[queue] Resuming ${queued.length} queued job(s) from a previous run`);
    for (const job of queued) enqueue(job.$id);
};

/** Re-runs the staleness check periodically so a job orphaned by a mid-flight
 * restart gets marked error without needing another restart to notice it. */
export const startStalenessWatcher = (intervalMs = 2 * 60 * 1000) => {
    setInterval(() => {
        checkStaleJobs().catch(err => console.error('[queue] Staleness check failed:', err));
    }, intervalMs);
};
