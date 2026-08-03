/**
 * Server-authoritative continuation-turn handler.
 *
 * Every turn after creation flows through here. Unlike the old fork, the client
 * ships only { message, selectedSlideIndex } — the worker loads the deck, the
 * conversation thread, and user memory from Appwrite by id (source of truth),
 * runs the unified planner's edit turn (classify → guard-backed execution), and
 * appends the turn to the per-message `chat_messages` thread.
 */

import { runEditTurn, CreateJobPayload } from '../../core/agents/CarouselPlanner';
import { runWithAgentContext } from '../../core/llm/agentGateway';
import { langfuse } from '../../core/llm/langfuse';
import { loadCarouselServer, assertOwnsCarousel } from '../carouselStoreServer';
import { loadThread, appendMessage, migrateThreadIfNeeded } from '../threadStoreServer';
import { loadCarouselBriefServer } from '../briefStoreServer';
import { rememberUserPreference } from '../../lib/memoryServer';
import { GenerationJob, updateJob } from '../jobStore';
import { GatekeeperAgent } from '../../core/agents/GatekeeperAgent';
import { recordRefusal } from '../abuseGuard';

export interface EditJobPayload {
    message: string;
    selectedSlideIndex: number | null;
    selectedSlideIndices?: number[];
}

export const runEditCarouselJob = async (job: GenerationJob): Promise<void> => {
    const payload: EditJobPayload = JSON.parse(job.payload);
    const { userId, carouselId } = job;
    if (!carouselId) throw new Error('Edit job is missing carouselId');

    await assertOwnsCarousel(carouselId, userId);

    // Guardrail: cheap deterministic check on the edit message. Scope/safety
    // classification isn't needed here (the subject was already vetted at
    // creation) — this just blocks blatant instruction-override / empty input.
    const pre = GatekeeperAgent.preScreen(payload.message);
    if (pre && !pre.allowed) {
        console.warn(`[editCarouselJob] Gatekeeper blocked edit from user ${userId}: ${pre.category}`);
        recordRefusal(userId, pre.category);
        await updateJob(job.$id, {
            status: 'done',
            statusMessage: 'Request declined',
            progress: 100,
            resultSummary: JSON.stringify({ reply: pre.reason, refused: true, intent: 'answer', category: pre.category }),
        });
        return;
    }

    const events: { label: string; done: boolean }[] = [];
    const progress = async (statusMessage: string, progressPct: number) => {
        const { getJob } = await import('../jobStore');
        const currentJob = await getJob(job.$id);
        if (currentJob.status === 'error' && (currentJob.error === 'Cancelled' || currentJob.error === 'Cancelled by user' || currentJob.statusMessage === 'Cancelled.' || currentJob.statusMessage === 'Cancelled by user')) {
            throw new Error('Cancelled by user');
        }

        for (const ev of events) {
            ev.done = true;
        }
        events.push({ label: statusMessage, done: false });
        await updateJob(job.$id, { status: 'running', statusMessage, progress: progressPct });
    };

    const tokenTracker = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cachedTokens: 0
    };

    const trace = langfuse?.trace({
        name: 'edit-carousel',
        userId,
        metadata: {
            carouselId,
            message: payload.message,
            selectedModel: 'openrouter/deepseek-v4-flash',
        }
    });

    const ctx = {
        userId,
        selectedModel: 'openrouter/deepseek-v4-flash',
        tokenTracker,
        langfuseTrace: trace,
        langfuseSpan: undefined as any,
    };

    await runWithAgentContext(
        ctx,
        async () => {
            const runAgentSpan = async <R>(name: string, input: any, fn: () => Promise<R>): Promise<R> => {
                const span = trace ? trace.span({ name, input }) : null;
                ctx.langfuseSpan = span;
                try {
                    const output = await fn();
                    span?.end({ output });
                    return output;
                } catch (err: any) {
                    span?.end({ output: { error: err.message || String(err) } });
                    throw err;
                } finally {
                    ctx.langfuseSpan = undefined;
                }
            };

            await progress('Thinking...', 15);

            // ── Server-authoritative load: deck + thread from Appwrite by id ──────
            // Backfill any legacy chat_history blob into chat_messages once, so a
            // pre-existing carousel's history is visible to this (and every) turn.
            await migrateThreadIfNeeded(carouselId, userId);
            const deck = await loadCarouselServer(carouselId);
            const thread = await loadThread(carouselId);
            const carouselBrief = await loadCarouselBriefServer(carouselId);

            // The planner's edit turn owns intent classification, guard-backed
            // execution, doodle regen, the honesty guard, and deck persistence.
            const editPayload = {
                isEditTurn: true,
                carouselId,
                message: payload.message,
                existingSlides: deck.slides,
                existingTheme: deck.theme,
                selectedTemplate: deck.templateId,
                format: deck.format,
                presetId: deck.presetId,
                selectedSlideIndex: payload.selectedSlideIndex ?? null,
                selectedSlideIndices: payload.selectedSlideIndices ?? [],
                conversationThread: thread,
                conversationSummary: '',
                carouselBrief: carouselBrief ?? undefined,
                selectedModel: 'openrouter/deepseek-v4-flash',
            } as unknown as CreateJobPayload;

            const result = await runEditTurn({ userId, payload: editPayload, progress, runAgentSpan });

            // ── Persist the turn onto the ordered thread (user + assistant) ───────
            const cleanEvents = events.map(e => ({ ...e, done: true }));
            try {
                await appendMessage(carouselId, userId, {
                    id: `msg-${Date.now()}-u`, role: 'user', text: payload.message,
                });
                await appendMessage(carouselId, userId, {
                    id: `msg-${Date.now()}-a`, role: 'assistant', text: result.reply,
                    events: cleanEvents, tokenUsage: tokenTracker,
                });
            } catch (err) {
                // The edit itself is already saved (runEditTurn persisted the deck);
                // losing the chat log must not fail an otherwise-successful turn.
                console.warn('[editCarouselJob] Failed to persist thread turn (non-fatal):', err);
            }

            if (result.memoryNote) {
                await rememberUserPreference(userId, result.memoryNote);
            }

            await updateJob(job.$id, {
                status: 'done',
                statusMessage: 'Done!',
                progress: 100,
                resultSummary: JSON.stringify({
                    reply: result.reply,
                    intent: result.intent,
                    slides: result.intent === 'copy' || result.intent === 'structure' || result.intent === 'image' || result.intent === 'regenerate' ? result.slides : undefined,
                    changedIndices: result.changedIndices,
                    designActions: result.designActions,
                    tokenUsage: tokenTracker,
                }),
            });
        }
    );
};
