/**
 * Lightweight in-memory abuse tracking for the guardrail.
 *
 * When the Gatekeeper refuses a request, we record it against the user. A user
 * who keeps tripping the guardrail is temporarily backed off at the /jobs entry
 * point (see worker/index.ts) so the platform isn't a free probing ground.
 *
 * In-memory on purpose: it resets on restart, needs no DB collection, and the
 * rate limiter next to it works the same way. Swap the Map for a shared store
 * if the worker is ever horizontally scaled.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BACKOFF_THRESHOLD = 5; // refusals within the window before backing a user off

const refusals = new Map<string, number[]>();

const recent = (userId: string): number[] => {
    const now = Date.now();
    const hits = (refusals.get(userId) || []).filter(t => now - t < WINDOW_MS);
    refusals.set(userId, hits);
    return hits;
};

/** Record a guardrail refusal for a user and log it. */
export const recordRefusal = (userId: string, category: string): void => {
    const hits = recent(userId);
    hits.push(Date.now());
    refusals.set(userId, hits);
    console.warn(`[abuseGuard] Refusal for user ${userId} (category: ${category}). ${hits.length} in the last ${WINDOW_MS / 60000}m.`);
};

/** True once a user has tripped the guardrail too many times in the window. */
export const isBackedOff = (userId: string): boolean => recent(userId).length >= BACKOFF_THRESHOLD;
