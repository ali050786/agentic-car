/**
 * Server-side edit/refine job handler. OrchestratorAgent.ts runs completely
 * unchanged (it has no browser dependencies) — this just supplies the job
 * context, executes the returned design actions, and persists the result.
 */

import { OrchestratorAgent } from '../../core/agents/OrchestratorAgent';
import { generateAndPersistDoodle } from '../doodleGen';
import { runWithAgentContext } from '../../core/llm/agentGateway';
import { updateCarouselContentServer, assertOwnsCarousel } from '../carouselStoreServer';
import { loadChatServer, saveChatServer } from '../chatStoreServer';
import { rememberUserPreference } from '../../lib/memoryServer';
import { getUserMemory } from '../../lib/memoryServer';
import { GenerationJob, updateJob } from '../jobStore';
import { SlideContent, CarouselTheme, ChatMessage } from '../../types';

export interface EditJobPayload {
    message: string;
    slides: SlideContent[];
    theme: CarouselTheme;
    templateId: string;
    selectedSlideIndex: number | null;
    selectedModel: string;
}

export const runEditCarouselJob = async (job: GenerationJob): Promise<void> => {
    const payload: EditJobPayload = JSON.parse(job.payload);
    const { userId, carouselId } = job;
    if (!carouselId) throw new Error('Edit job is missing carouselId');

    await assertOwnsCarousel(carouselId, userId);

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

    await runWithAgentContext(
        { userId, selectedModel: payload.selectedModel },
        async () => {
            await progress('Thinking...', 20);

            const { messages: recentMessages, summary: conversationSummary } = await loadChatServer(carouselId);
            const userMemory = await getUserMemory(userId);

            const result = await OrchestratorAgent.handle({
                message: payload.message,
                slides: payload.slides,
                templateId: payload.templateId,
                selectedSlideIndex: payload.selectedSlideIndex,
                recentMessages: recentMessages.filter(m => !m.running),
                conversationSummary,
                userMemory,
            });

            let slides = payload.slides;

            if (result.intent === 'copy' && result.slides) {
                slides = result.slides;
            } else if (result.intent === 'image' && result.imageBrief !== null && result.imageSlideIndex !== null) {
                await progress(`Sketching a new image for slide ${result.imageSlideIndex + 1}...`, 60);
                // Derive a stable seed from the carousel ID so this newly generated
                // doodle matches the visual style of the existing slides in the carousel.
                const carouselSeed = Math.abs(
                    Array.from(carouselId).reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 0)
                ) % 2_147_483_647;
                const doodleUrl = await generateAndPersistDoodle(result.imageBrief, '2:3', carouselSeed);
                slides = slides.map((s, i) => (i === result.imageSlideIndex ? { ...s, doodleUrl, doodlePrompt: result.imageBrief! } : s));
            }
            // "design" intents (template/preset/format/pattern/signature) are applied
            // client-side once the job completes — they're free, local UI state
            // changes with no LLM-derived content to persist beyond the reply.

            await progress('Saving...', 85);
            if (result.intent === 'copy' || result.intent === 'structure' || result.intent === 'image') {
                await updateCarouselContentServer(carouselId, { theme: payload.theme, slides });
            }


            const cleanEvents = events.map(e => ({ ...e, done: true }));
            const newMessages: ChatMessage[] = [
                ...recentMessages,
                { id: `msg-${Date.now()}-u`, role: 'user', text: payload.message },
                { id: `msg-${Date.now()}-a`, role: 'assistant', text: result.reply, events: cleanEvents },
            ];
            // Best-effort — the edit itself is already saved above; losing the
            // chat log shouldn't fail a job that otherwise succeeded.
            try {
                await saveChatServer(carouselId, userId, newMessages, conversationSummary, 0);
            } catch (err) {
                console.warn('[editCarouselJob] Failed to persist chat history (non-fatal):', err);
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
                    slides: result.intent === 'copy' || result.intent === 'structure' || result.intent === 'image' ? slides : undefined,
                    changedIndices: result.changedIndices,
                    designActions: result.designActions,
                }),

            });
        }
    );
};
