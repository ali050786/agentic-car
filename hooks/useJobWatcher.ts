/**
 * Applies background job updates to the live UI. Mounted once at the app
 * root (not per-carousel) so it keeps watching whatever job the user last
 * dispatched even as they navigate the app — that's what makes "start a
 * carousel, go look at another one, come back" safe: this hook only ever
 * writes into the store when the job's carousel still matches what's
 * currently on screen. If the user has moved on, the job simply finishes
 * quietly server-side and the carousel history sidebar's own subscription
 * (see CarouselHistorySidebar.tsx) is what surfaces the completion dot.
 */

import { useEffect } from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { subscribeToJob, GenerationJob } from '../services/jobService';
import { getCarouselById } from '../services/carouselService';

const markEventsDone = (events?: { label: string; done: boolean }[]) =>
    (events || []).map(e => ({ ...e, done: true }));

export const useJobWatcher = () => {
    const activeJobId = useCarouselStore(s => s.activeJobId);

    useEffect(() => {
        if (!activeJobId) return;

        const unsubscribe = subscribeToJob(activeJobId, (job: GenerationJob) => {
            const store = useCarouselStore.getState();

            // The user has navigated to a different carousel since this edit job
            // was dispatched — let it resolve silently, don't touch the live view.
            if (job.type === 'edit' && job.carouselId && job.carouselId !== store.activeCarouselId) {
                if (job.status === 'done' || job.status === 'error') store.setActiveJobId(null);
                return;
            }

            store.setGenerationStatus(job.statusMessage);
            store.setGenerationProgress(job.progress);

            if (job.status === 'queued' || job.status === 'running') {
                store.setGenerating(true);
                return;
            }

            const runningMsg = store.chatMessages.find(m => m.running);

            if (job.status === 'error') {
                store.setError(job.error || 'Generation failed.');
                if (runningMsg) {
                    store.updateChatMessage(runningMsg.id, {
                        running: false, error: true,
                        events: markEventsDone(runningMsg.events),
                        text: job.error || 'Generation failed.',
                    });
                }
                store.setGenerating(false);
                store.setActiveJobId(null);
                return;
            }

            // status === 'done'
            if (job.type === 'create') {
                if (job.carouselId && store.activeCarouselId === null) {
                    getCarouselById(job.carouselId).then(({ data }) => {
                        if (!data) return;
                        const s = useCarouselStore.getState();
                        s.setActiveCarouselId(data.$id);
                        s.setSlides(data.slides as any);
                        s.setTheme(data.theme);
                    });
                }
                if (runningMsg) {
                    store.updateChatMessage(runningMsg.id, {
                        running: false,
                        events: markEventsDone(runningMsg.events),
                        text: 'Done! Tell me what to refine: a slide, the tone, or the whole angle.',
                    });
                }
            } else {
                try {
                    const result = JSON.parse(job.resultSummary || '{}');
                    if (store.activeCarouselId === job.carouselId) {
                        if (Array.isArray(result.slides)) store.setSlides(result.slides);
                        if (Array.isArray(result.designActions)) {
                            for (const act of result.designActions) {
                                switch (act.action) {
                                    case 'set_template': store.setTemplate(act.value); break;
                                    case 'set_format': store.setFormat(act.value); break;
                                    case 'set_preset': store.setPresetId(act.value); store.setBrandMode('preset'); break;
                                    case 'set_pattern': store.setPattern(parseInt(act.value, 10) || 1); break;
                                    case 'set_signature_position': store.setSignaturePosition(act.value); break;
                                }
                            }
                        }
                    }
                    if (runningMsg) {
                        store.updateChatMessage(runningMsg.id, {
                            running: false,
                            events: markEventsDone(runningMsg.events),
                            text: result.reply || 'Done.',
                        });
                    }
                } catch {
                    if (runningMsg) {
                        store.updateChatMessage(runningMsg.id, {
                            running: false, error: true,
                            events: markEventsDone(runningMsg.events),
                            text: "That didn't work — try rephrasing.",
                        });
                    }
                }
            }

            store.setGenerating(false);
            store.setActiveJobId(null);
        });

        return unsubscribe;
    }, [activeJobId]);
};
