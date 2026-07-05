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
import { BrandKit, BrandMode, SignaturePosition, TemplateId, CarouselFormat } from '../../types';

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
}

const progress = (jobId: string, statusMessage: string, progressPct: number) =>
    updateJob(jobId, { status: 'running', statusMessage, progress: progressPct });

export const runCreateCarouselJob = async (job: GenerationJob): Promise<void> => {
    const payload: CreateJobPayload = JSON.parse(job.payload);
    const { userId } = job;

    await runWithAgentContext(
        { userId, selectedModel: payload.selectedModel },
        async () => {
            await progress(job.$id, 'Initializing AI agents...', 10);

            const effectiveInput = payload.sourceContent || payload.topic;
            const inputType = effectiveInput.length > 500 ? 'CONTEXT' : 'TOPIC';

            await progress(job.$id, 'Analyzing content density & needs...', 20);
            let researchAnalysis;
            try {
                researchAnalysis = await ResearchAgent.analyzeInputNeeds(effectiveInput);
            } catch (err) {
                console.error('[createCarouselJob] Research analysis failed:', err);
                researchAnalysis = { strategy: 'NONE' as const, reasoning: 'Research analysis failed, skipping.', searchQueries: [] };
            }

            let finalContent = effectiveInput;
            if (researchAnalysis.strategy !== 'NONE') {
                await progress(job.$id, 'Researching for trends & data...', 30);
                const researchData = await ResearchAgent.performResearch(researchAnalysis.searchQueries);
                finalContent += researchData;
            }

            await progress(job.$id, 'Strategist Agent: identifying viral angles...', 40);
            let viralAngle = '';
            try {
                viralAngle = await StrategistAgent.generateViralAngle(finalContent, inputType, payload.customInstructions || '');
            } catch (err) {
                console.error('[createCarouselJob] Strategist Agent failed, falling back to raw input:', err);
                viralAngle = `Topic/Context: ${effectiveInput}`;
            }

            const userMemory = await getUserMemory(userId);
            const context: AgentContext = {
                inputMode: payload.inputMode,
                sourceContent: payload.sourceContent || payload.topic,
                customInstructions: payload.customInstructions,
                outputLanguage: payload.outputLanguage,
                slideCount: payload.slideCount,
                viralAngle,
                userMemory,
            };

            await progress(job.$id, 'Designing slides & writing copy...', 60);
            const result = await TemplateAgent.generate(context, payload.selectedTemplate || 'template-1');

            result.slides = polishSlides(result.slides);
            await progress(job.$id, 'Proofreading copy...', 75);
            result.slides = await ProofreaderAgent.proofread(result.slides);
            result.slides = polishSlides(result.slides);

            const preset = getPresetById(payload.presetId || 'ocean-tech');
            if (preset) {
                result.theme = resolveTheme(preset.seeds, payload.selectedTemplate);
            }

            if (result.slides.length > 0 && payload.selectedTemplate === 'template-3') {
                await progress(job.$id, 'Art Director: designing sketches...', 82);
                let fluxPrompts: string[];
                try {
                    fluxPrompts = await ArtDirectorAgent.generatePrompts(result.slides, viralAngle || context.sourceContent);
                } catch (err) {
                    console.error('[createCarouselJob] Art Director failed, falling back to topic prompts:', err);
                    fluxPrompts = result.slides.map(s => s.doodlePrompt || '');
                }

                for (let i = 0; i < result.slides.length; i++) {
                    const fluxPrompt = fluxPrompts[i];
                    if (!fluxPrompt) continue;
                    await progress(job.$id, `Sketching doodle ${i + 1}/${result.slides.length}...`, 82 + Math.round((i / result.slides.length) * 10));
                    try {
                        const doodleUrl = await generateAndPersistDoodle(fluxPrompt, '2:3');
                        result.slides[i] = { ...result.slides[i], doodleUrl, doodlePrompt: fluxPrompt };
                    } catch (err) {
                        console.error(`[createCarouselJob] Doodle ${i + 1} failed, keeping placeholder:`, err);
                    }
                }
            }

            await progress(job.$id, 'Saving carousel...', 95);
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
            // Best-effort — the carousel itself is already saved above; losing
            // the chat log (e.g. chat_history collection missing) shouldn't
            // fail a job that otherwise succeeded.
            try {
                await saveChatServer(carouselId, userId, [
                    { id: `msg-${Date.now()}-u`, role: 'user', text: payload.topic },
                    { id: `msg-${Date.now()}-a`, role: 'assistant', text: reply },
                ], '', 0);
            } catch (err) {
                console.warn('[createCarouselJob] Failed to persist chat history (non-fatal):', err);
            }

            await updateJob(job.$id, {
                status: 'done',
                statusMessage: 'Done!',
                progress: 100,
                carouselId,
                resultSummary: reply,
            });
        }
    );
};
