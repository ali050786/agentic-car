/**
 * Background worker: a small persistent Express service (meant to run on
 * Coolify) that owns the carousel create/edit pipeline so it survives the
 * browser tab closing or navigating away. See docs/coolify-deployment.md
 * for how this gets deployed.
 */

import './loadEnv';
import express from 'express';
import cors from 'cors';
import dns from 'dns';

if (dns && typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}
import { requireUser, UnauthorizedError } from './auth';
import { createJob } from './jobStore';
import { enqueue, setHandler, resumeOnBoot, startStalenessWatcher } from './queue';
import { runCreateCarouselJob } from './jobs/createCarouselJob';
import { runEditCarouselJob } from './jobs/editCarouselJob';
import { assertOwnsCarousel, ForbiddenError } from './carouselStoreServer';
import { isBackedOff } from './abuseGuard';

const app = express();
const PORT = Number(process.env.WORKER_PORT) || 4000;
const ALLOWED_ORIGIN = process.env.APP_ORIGIN || '*';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '15mb' }));

setHandler(async (job) => {
    if (job.type === 'create') return runCreateCarouselJob(job);
    if (job.type === 'edit') return runEditCarouselJob(job);
    throw new Error(`Unknown job type: ${job.type}`);
});

// Simple per-user rate limit on job creation: 20 requests / 5 minutes.
const rateWindow = new Map<string, number[]>();
const rateLimited = (userId: string): boolean => {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const hits = (rateWindow.get(userId) || []).filter(t => now - t < windowMs);
    hits.push(now);
    rateWindow.set(userId, hits);
    return hits.length > 20;
};

app.post('/jobs', async (req, res) => {
    try {
        const { userId } = await requireUser(req);
        if (rateLimited(userId)) {
            return res.status(429).json({ error: 'Too many requests — please slow down.' });
        }
        // Guardrail: back off users who keep tripping the content gate.
        if (isBackedOff(userId)) {
            return res.status(429).json({ error: "Too many requests were declined. Please wait a few minutes, then try a carousel topic." });
        }

        const { type, carouselId, payload } = req.body;
        if (type !== 'create' && type !== 'edit') {
            return res.status(400).json({ error: 'type must be "create" or "edit"' });
        }
        if (type === 'edit' && !carouselId) {
            return res.status(400).json({ error: 'carouselId is required for edit jobs' });
        }
        if (type === 'edit') {
            await assertOwnsCarousel(carouselId, userId);
        }

        const job = await createJob({ userId, type, carouselId, payload });
        enqueue(job.$id);
        return res.status(202).json({ jobId: job.$id, carouselId: job.carouselId });
    } catch (err: any) {
        if (err instanceof UnauthorizedError) return res.status(401).json({ error: err.message });
        if (err instanceof ForbiddenError) return res.status(403).json({ error: err.message });
        console.error('[worker] POST /jobs error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to create job' });
    }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, async () => {
    console.log(`🧵 Background worker running on http://localhost:${PORT}`);
    await resumeOnBoot();
    startStalenessWatcher();
});
