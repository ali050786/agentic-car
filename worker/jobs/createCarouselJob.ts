/**
 * Server-side re-implementation of core/agents/MainAgent.ts's runAgentWorkflow
 * orchestration shape. The sub-agents it calls (Research/Strategist/Template/
 * Proofreader/ArtDirector) are imported and run completely unchanged — only
 * the glue is different: progress goes to the job doc instead of the Zustand
 * store, and the doodle/persistence steps use worker/doodleGen.ts +
 * worker/carouselStoreServer.ts instead of the browser's Appwrite client.
 */

import { ResearchAgent } from '../../core/agents/ResearchAgent';
import { StrategistAgent } from '../../core/agents/StrategistAgent';
import { TemplateAgent } from '../../core/agents/TemplateAgent';
import { ProofreaderAgent } from '../../core/agents/ProofreaderAgent';
import { ArtDirectorAgent } from '../../core/agents/ArtDirectorAgent';
import type { AgentContext } from '../../core/agents/agentContext';
import { polishSlides } from '../../utils/contentPolish';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { runWithAgentContext } from '../../core/llm/agentGateway';
import { generateAndPersistDoodle } from '../doodleGen';
import { createCarouselServer } from '../carouselStoreServer';
import { saveChatServer } from '../chatStoreServer';
import { getUserMemory } from '../../lib/memoryServer';
import { GenerationJob, updateJob } from '../jobStore';
import { BrandKit, BrandMode, SignaturePosition, TemplateId, CarouselFormat, CreativeBrief } from '../../types';


export interface CreateJobPayload {
    topic: string;
    inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf';
    sourceContent: string;
    customInstructions: string;
    outputLanguage: string;
    slideCount: number;
    selectedModel: string;
    selectedTemplate: TemplateId;
    presetId: string;
    brandMode: BrandMode;
    brandKit: BrandKit;
    signaturePosition: SignaturePosition;
    format: CarouselFormat;
    selectedPattern: number;
    patternOpacity: number;
    /** Resolved by the Creative Director Agent in the client before job dispatch */
    creativeBrief?: CreativeBrief;

}

const progress = (jobId: string, statusMessage: string, progressPct: number) =>
    updateJob(jobId, { status: 'running', statusMessage, progress: progressPct });

export const runCreateCarouselJob = async (job: GenerationJob): Promise<void> => {
    const payload: CreateJobPayload = JSON.parse(job.payload);
    const { userId } = job;

    const events: { label: string; done: boolean }[] = [];
    
    // Prepopulate based on client input mode activity
    if (payload.inputMode === 'url') {
        events.push({ label: 'Article fetched', done: true });
    } else if (payload.inputMode === 'video') {
        events.push({ label: 'Transcript fetched', done: true });
    } else if (payload.inputMode === 'pdf') {
        events.push({ label: 'Document content parsed', done: true });
    }

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

    await runWithAgentContext(
        { userId, selectedModel: payload.selectedModel, tokenTracker },
        async () => {
            await progress('Initializing AI agents...', 10);

            const effectiveInput = payload.sourceContent || payload.topic;
            const inputType = effectiveInput.length > 500 ? 'CONTEXT' : 'TOPIC';

            await progress('Analyzing content density & needs...', 20);
            let researchAnalysis;
            try {
                researchAnalysis = await ResearchAgent.analyzeInputNeeds(effectiveInput);
            } catch (err) {
                console.error('[createCarouselJob] Research analysis failed:', err);
                researchAnalysis = { strategy: 'NONE' as const, reasoning: 'Research analysis failed, skipping.', searchQueries: [] };
            }

            let finalContent = effectiveInput;
            if (researchAnalysis.strategy !== 'NONE') {
                await progress('Researching for trends & data...', 30);
                const researchData = await ResearchAgent.performResearch(researchAnalysis.searchQueries);
                finalContent += researchData;
            }

            const strategyLabel = payload.creativeBrief
                ? `Strategist: building ${payload.creativeBrief.contentStrategy.approachMode.toLowerCase().replace(/_/g, ' ')}...`
                : 'Strategist Agent: identifying viral angles...';
            await progress(strategyLabel, 40);
            let viralAngle = '';
            try {
                viralAngle = await StrategistAgent.generateViralAngle(
                    finalContent,
                    inputType,
                    payload.customInstructions || '',
                    payload.creativeBrief
                );
            } catch (err) {
                console.error('[createCarouselJob] Strategist Agent failed, falling back to raw input:', err);
                viralAngle = `Topic/Context: ${effectiveInput}`;
            }

            const userMemory = await getUserMemory(userId);
            // Hard guardrails: slide count must be between 2 and 20 regardless of source
            const rawSlideCount = payload.creativeBrief?.suggestedSlideCount ?? payload.slideCount;
            const clampedSlideCount = Math.max(2, Math.min(20, rawSlideCount));
            const context: AgentContext = {
                inputMode: payload.inputMode,
                sourceContent: payload.sourceContent || payload.topic,
                customInstructions: payload.customInstructions,
                outputLanguage: payload.creativeBrief?.outputLanguage ?? payload.outputLanguage,
                slideCount: clampedSlideCount,
                viralAngle,
                userMemory,
                creativeBrief: payload.creativeBrief,
            };




            await progress('Designing slides & writing copy...', 60);
            const result = await TemplateAgent.generate(context, payload.selectedTemplate || 'template-1');

            result.slides = polishSlides(result.slides);
            await progress('Proofreading copy...', 75);
            result.slides = await ProofreaderAgent.proofread(result.slides, payload.creativeBrief);
            result.slides = polishSlides(result.slides);


            const preset = getPresetById(payload.presetId || 'ocean-tech');
            if (preset) {
                result.theme = resolveTheme(preset.seeds, payload.selectedTemplate);
            }

            if (result.slides.length > 0 && payload.selectedTemplate === 'template-3') {
                await progress('Art Director: designing sketches...', 82);
                let fluxPrompts: string[];
                try {
                    fluxPrompts = await ArtDirectorAgent.generatePrompts(result.slides, viralAngle || context.sourceContent);
                } catch (err) {
                    console.error('[createCarouselJob] Art Director failed, falling back to topic prompts:', err);
                    fluxPrompts = result.slides.map(s => s.doodlePrompt || '');
                }

                // Concurrency-limited parallel doodle generator to cut down generation wait times
                const concurrencyLimit = 3;

                // Derive a stable integer seed from the job ID so every Replicate call in this
                // batch shares the same style fingerprint (line weight, stroke confidence,
                // compositional density). A hash of job.$id is deterministic — re-running the
                // same job always produces the same seed, which also makes regeneration
                // reproducible for debugging.
                const jobSeed = Math.abs(
                    Array.from(job.$id as string).reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 0)
                ) % 2_147_483_647; // Replicate accepts seeds in the int32 range
                console.log(`[createCarouselJob] Using visual consistency seed ${jobSeed} for job ${job.$id}`);

                const slidesWithPrompts = result.slides.map((slide, i) => ({
                    slide,
                    index: i,
                    fluxPrompt: fluxPrompts[i]
                })).filter(item => !!item.fluxPrompt);

                let completedCount = 0;
                
                // Define inline concurrency worker function
                const executionQueue = [...slidesWithPrompts.entries()];
                const worker = async () => {
                    while (executionQueue.length > 0) {
                        const next = executionQueue.shift();
                        if (!next) break;
                        const [, item] = next;
                        
                        try {
                            const { getJob } = await import('../jobStore');
                            const currentJob = await getJob(job.$id);
                            if (currentJob.status === 'error' && (currentJob.error === 'Cancelled' || currentJob.error === 'Cancelled by user' || currentJob.statusMessage === 'Cancelled.' || currentJob.statusMessage === 'Cancelled by user')) {
                                throw new Error('Cancelled by user');
                            }
                            const doodleUrl = await generateAndPersistDoodle(item.fluxPrompt, '2:3', jobSeed);

                            result.slides[item.index] = { 
                                ...result.slides[item.index], 
                                doodleUrl, 
                                doodlePrompt: item.fluxPrompt 
                            };
                        } catch (err) {
                            console.error(`[createCarouselJob] Doodle ${item.index + 1} failed, keeping placeholder:`, err);
                        } finally {
                            completedCount++;
                            const stepPercent = Math.round((completedCount / slidesWithPrompts.length) * 10);
                            await progress(
                                `Sketching doodle ${completedCount}/${slidesWithPrompts.length}...`, 
                                82 + stepPercent
                            );
                        }
                    }
                };

                const workers = Array(Math.min(concurrencyLimit, slidesWithPrompts.length))
                    .fill(null)
                    .map(() => worker());

                await Promise.all(workers);
            }

            await progress('Saving carousel...', 95);
            const carouselId = await createCarouselServer({
                userId,
                title: payload.topic.length > 80 ? payload.topic.slice(0, 77) + '…' : payload.topic,
                templateType: payload.selectedTemplate.replace('-', '') as any,
                theme: result.theme,
                slides: result.slides,
                brandMode: payload.brandMode,
                presetId: payload.presetId,
                brandKit: payload.brandKit,
                signaturePosition: payload.signaturePosition,
                format: payload.format,
                selectedPattern: payload.selectedPattern,
                patternOpacity: payload.patternOpacity,
            });

            const reply = `Done — ${result.slides.length} slides. Tell me what to refine: a slide, the tone, or the whole angle.`;
            
            // Mark all events as complete
            const cleanEvents = events.map(e => ({ ...e, done: true }));

            try {
                await saveChatServer(carouselId, userId, [
                    { id: `msg-${Date.now()}-u`, role: 'user', text: payload.topic },
                    { 
                        id: `msg-${Date.now()}-a`, 
                        role: 'assistant', 
                        text: reply, 
                        events: cleanEvents,
                        tokenUsage: tokenTracker
                    },
                ], '', 0);
            } catch (err) {
                console.warn('[createCarouselJob] Failed to persist chat history (non-fatal):', err);
            }

            await updateJob(job.$id, {
                status: 'done',
                statusMessage: 'Done!',
                progress: 100,
                carouselId,
                resultSummary: JSON.stringify({
                    reply,
                    tokenUsage: tokenTracker
                }),
            });
        }
    );
};
