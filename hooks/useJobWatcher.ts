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
        // The last draft preview shown, so progress ticks don't re-apply it.
        let shownPreview = '';

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
                // A create job sends its first draft while it keeps polishing: show it
                // (read-only) unless the user has opened another carousel meanwhile.
                if (job.type === 'create' && job.resultSummary && job.resultSummary !== shownPreview && store.activeCarouselId === null) {
                    try {
                        const pv = JSON.parse(job.resultSummary)?.preview;
                        if (pv && Array.isArray(pv.slides) && pv.slides.length && (!pv.templateId || pv.templateId === store.selectedTemplate)) {
                            shownPreview = job.resultSummary;
                            store.showDraftPreview(pv.slides, pv.theme);
                        }
                    } catch { /* not a preview */ }
                }
                return;
            }

            const runningMsg = store.chatMessages.find(m => m.running);

            if (job.status === 'error') {
                if (job.type === 'create') store.clearDraftPreview();
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
                let reply = 'Done! Tell me what to refine: a slide, the tone, or the whole angle.';
                let tokenUsage = undefined;
                let refused = false;
                // The first reply's restore point (the deck as created) and its id in the saved thread.
                let versionId: string | undefined;
                let messageId: string | undefined;
                try {
                    const result = JSON.parse(job.resultSummary || '{}');
                    if (result.reply) reply = result.reply;
                    if (result.tokenUsage) tokenUsage = result.tokenUsage;
                    refused = result.refused === true;
                    if (typeof result.versionId === 'string') versionId = result.versionId;
                    if (typeof result.messageId === 'string') messageId = result.messageId;
                } catch {
                    if (job.resultSummary) reply = job.resultSummary;
                }

                // A guardrail refusal: show the friendly reply, drop any draft, load nothing.
                if (refused) store.clearDraftPreview();
                if (!refused && job.carouselId && store.activeCarouselId === null) {
                    getCarouselById(job.carouselId).then(({ data }) => {
                        if (!data) return;
                        const s = useCarouselStore.getState();
                        // The user may have opened another carousel while this loaded.
                        if (s.activeCarouselId !== null) return;
                        // One update: the draft becomes the saved deck without an autosave in between.
                        s.applyFinalDeck(data.$id, data.slides as any, data.theme);
                    });
                }
                if (runningMsg) {
                    store.updateChatMessage(runningMsg.id, {
                        running: false,
                        events: markEventsDone(runningMsg.events),
                        text: reply,
                        tokenUsage,
                        ...(versionId ? { versionId } : {}),
                        // Same id as the saved thread, so restoring to it later is understood by the worker.
                        ...(messageId ? { id: messageId } : {}),
                    });
                }
            } else {
                try {
                    const result = JSON.parse(job.resultSummary || '{}');
                    if (store.activeCarouselId === job.carouselId) {
                        if (Array.isArray(result.slides)) store.setSlides(result.slides);
                        else if (result.reload && job.carouselId) {
                            // Too large to ship in the job result: read the saved deck.
                            const id = job.carouselId;
                            getCarouselById(id).then(({ data }) => {
                                const s = useCarouselStore.getState();
                                if (data && s.activeCarouselId === id) s.setSlides(data.slides as any);
                            });
                        }
                        if (Array.isArray(result.designActions)) {
                            for (const act of result.designActions) {
                                switch (act.action) {
                                    case 'set_template': store.setTemplate(act.value); break;
                                    case 'set_format': store.setFormat(act.value); break;
                                    case 'set_preset': store.setPresetId(act.value); store.setBrandMode('preset'); break;
                                    case 'set_pattern': store.setPattern(parseInt(act.value, 10) || 1); break;
                                    case 'set_signature_position': store.setSignaturePosition(act.value); break;
                                    case 'set_brand_mode': store.setBrandMode(act.value); break;
                                }
                            }
                        }
                    }
                    if (runningMsg) {
                        store.updateChatMessage(runningMsg.id, {
                            running: false,
                            events: markEventsDone(runningMsg.events),
                            text: result.reply || 'Done.',
                            tokenUsage: result.tokenUsage,
                            undoable: result.undoable === true,
                            ...(typeof result.versionId === 'string' ? { versionId: result.versionId } : {}),
                            ...(typeof result.messageId === 'string' && result.messageId !== runningMsg.id ? { id: result.messageId } : {}),
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
