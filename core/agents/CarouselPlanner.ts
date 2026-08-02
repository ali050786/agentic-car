import { ResearchAgent } from './ResearchAgent';
import { StrategistAgent } from './StrategistAgent';
import { TemplateAgent } from './TemplateAgent';
import { ProofreaderAgent } from './ProofreaderAgent';
import { ArtDirectorAgent } from './ArtDirectorAgent';
import { AgentContext } from './agentContext';
import { polishSlides } from '../../utils/contentPolish';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { generateAndPersistDoodle } from '../../worker/doodleGen';
import { createCarouselServer } from '../../worker/carouselStoreServer';
import { saveChatServer } from '../../worker/chatStoreServer';
import { getUserMemory } from '../../lib/memoryServer';
import { generateContentFromAgent } from '../../services/aiService';
import { SlideLayout, CarouselTheme, CreativeBrief, TemplateId, BrandKit, BrandMode, SignaturePosition, CarouselFormat } from '../../types';
import { slideToLayout, layoutToSlide } from '../../utils/slideMigration';

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
  creativeBrief?: CreativeBrief;
}

export interface PlannerRunParams {
  jobId: string;
  userId: string;
  payload: CreateJobPayload;
  events: { label: string; done: boolean }[];
  progress: (statusMessage: string, progressPct: number) => Promise<void>;
  runAgentSpan: <R>(name: string, input: any, fn: () => Promise<R>) => Promise<R>;
  tokenTracker: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number };
}

export interface PlanResult {
  researchStrategy: 'SEARCH' | 'NONE';
  approachMode: string;
  targetSlideCount: number;
  visualPlan: string;
}

export interface ReflectResult {
  score: number;
  needsRevision: boolean;
  flaggedSlideIndices: number[];
  feedback: string;
}

export const CarouselPlanner = {
  run: async ({
    jobId,
    userId,
    payload,
    events,
    progress,
    runAgentSpan,
    tokenTracker,
  }: PlannerRunParams): Promise<{ carouselId: string; slides: SlideLayout[]; theme: CarouselTheme }> => {
    const workingMemory: string[] = [];

    // =========================================================================
    // STEP 1: PLAN PHASE
    // =========================================================================
    await progress('PLAN: Analyzing brief & constructing strategy...', 15);

    const effectiveInput = payload.sourceContent || payload.topic;
    const rawSlideCount = payload.creativeBrief?.suggestedSlideCount ?? payload.slideCount;
    const targetSlideCount = Math.max(2, Math.min(20, rawSlideCount));
    const structuredMemory = await getUserMemory(userId);
    if (structuredMemory.bannedWords.length > 0) {
      workingMemory.push(`Banned words constraint active: ${structuredMemory.bannedWords.join(', ')}`);
    }

    const planPrompt = `
      You are an expert AI Carousel Planner. Construct a strategy plan for creating a social media carousel.

      Input Topic/Context:
      """
      ${effectiveInput}
      """

      User Structured Memory Rules:
      - Banned Words: ${structuredMemory.bannedWords.length ? structuredMemory.bannedWords.join(', ') : 'None'}
      - Brand Rules: ${structuredMemory.brandRules.length ? structuredMemory.brandRules.join(', ') : 'None'}
      - Tone Preferences: ${structuredMemory.tonePrefs.length ? structuredMemory.tonePrefs.join(', ') : 'None'}

      Requested Slide Count: ${targetSlideCount}
      Input Mode: ${payload.inputMode}
      Template Style: ${payload.selectedTemplate}

      Analyze the input and output a JSON strategy plan with:
      1. researchStrategy: "SEARCH" if factual data/stats search is needed, else "NONE".
      2. approachMode: concise string describing narrative angle.
      3. targetSlideCount: integer matching ${targetSlideCount}.
      4. visualPlan: brief recommendation for visual iconography and doodle metaphors.
    `;

    const planSchema = {
      type: 'object',
      properties: {
        researchStrategy: { type: 'string', enum: ['SEARCH', 'NONE'] },
        approachMode: { type: 'string' },
        targetSlideCount: { type: 'number' },
        visualPlan: { type: 'string' },
      },
      required: ['researchStrategy', 'approachMode', 'targetSlideCount', 'visualPlan'],
    };

    let plan: PlanResult;
    try {
      plan = await runAgentSpan('CarouselPlanner.PLAN', { topic: payload.topic }, () =>
        generateContentFromAgent(planPrompt, planSchema)
      );
    } catch (err) {
      console.warn('[CarouselPlanner] Plan step failed, using default plan:', err);
      plan = {
        researchStrategy: effectiveInput.length > 500 ? 'SEARCH' : 'NONE',
        approachMode: payload.creativeBrief?.contentStrategy.approachMode || 'DIRECT_EXPERT',
        targetSlideCount,
        visualPlan: 'Use topic-matched icons and high-contrast editorial styling.',
      };
    }

    workingMemory.push(`Plan created: ${plan.targetSlideCount} slides, approach: ${plan.approachMode}`);

    // =========================================================================
    // STEP 2: EXECUTE PHASE
    // =========================================================================
    const inputType = effectiveInput.length > 500 ? 'CONTEXT' : 'TOPIC';
    let finalContent = effectiveInput;

    if (plan.researchStrategy === 'SEARCH') {
      await progress('EXECUTE: Researching trends & factual context...', 25);
      let researchAnalysis;
      try {
        researchAnalysis = await runAgentSpan(
          'ResearchAgent.analyzeInputNeeds',
          { input: effectiveInput },
          () => ResearchAgent.analyzeInputNeeds(effectiveInput)
        );
      } catch (err) {
        console.warn('[CarouselPlanner] Research analysis failed:', err);
        researchAnalysis = { strategy: 'NONE' as const, searchQueries: [] };
      }

      if (researchAnalysis.strategy !== 'NONE' && researchAnalysis.searchQueries.length > 0) {
        const researchData = await runAgentSpan(
          'ResearchAgent.performResearch',
          { queries: researchAnalysis.searchQueries },
          () => ResearchAgent.performResearch(researchAnalysis.searchQueries)
        );
        finalContent += '\n' + researchData;
        workingMemory.push(`Researched ${researchAnalysis.searchQueries.length} queries successfully.`);
      }
    }

    await progress('EXECUTE: Drafting viral angle & narrative flow...', 40);
    let viralAngle = '';
    try {
      viralAngle = await runAgentSpan(
        'StrategistAgent.generateViralAngle',
        {
          finalContentLength: finalContent.length,
          inputType,
          customInstructions: payload.customInstructions,
          creativeBrief: payload.creativeBrief,
        },
        () =>
          StrategistAgent.generateViralAngle(
            finalContent,
            inputType,
            payload.customInstructions || '',
            payload.creativeBrief
          )
      );
    } catch (err) {
      console.warn('[CarouselPlanner] Strategist Agent failed, using raw input:', err);
      viralAngle = `Topic/Context: ${effectiveInput}`;
    }

    workingMemory.push(`Viral angle drafted: ${viralAngle.slice(0, 100)}...`);

    const userMemory = await getUserMemory(userId);
    const agentContext: AgentContext = {
      inputMode: payload.inputMode,
      sourceContent: payload.sourceContent || payload.topic,
      customInstructions: payload.customInstructions,
      outputLanguage: payload.creativeBrief?.outputLanguage ?? payload.outputLanguage,
      slideCount: plan.targetSlideCount,
      viralAngle,
      userMemory,
      creativeBrief: payload.creativeBrief,
    };

    await progress('EXECUTE: Writing content & mapping Layout IR...', 55);
    const generatedResult = await runAgentSpan(
      'TemplateAgent.generate',
      { context: agentContext, selectedTemplate: payload.selectedTemplate },
      () => TemplateAgent.generate(agentContext, payload.selectedTemplate || 'template-1')
    );

    let currentSlides: SlideLayout[] = generatedResult.slides.map(slideToLayout);
    let currentTheme: CarouselTheme = generatedResult.theme;

    // Apply polish and proofread
    const polishedLegacy = polishSlides(currentSlides.map(layoutToSlide));
    await progress('EXECUTE: Proofreading copy & enforcing tone...', 70);
    const proofreadLegacy = await runAgentSpan(
      'ProofreaderAgent.proofread',
      { slideCount: polishedLegacy.length, creativeBrief: payload.creativeBrief },
      () => ProofreaderAgent.proofread(polishedLegacy, payload.creativeBrief)
    );
    currentSlides = polishSlides(proofreadLegacy).map(slideToLayout);

    const preset = getPresetById(payload.presetId || 'ocean-tech');
    if (preset) {
      currentTheme = resolveTheme(preset.seeds, payload.selectedTemplate);
    }

    workingMemory.push(`Assembled ${currentSlides.length} layout slides.`);

    // =========================================================================
    // STEP 3: REFLECT PHASE (Bounded Loop N=2 Max)
    // =========================================================================
    const MAX_REFLECT_ITERATIONS = 2;
    for (let iteration = 1; iteration <= MAX_REFLECT_ITERATIONS; iteration++) {
      await progress(`REFLECT: Critiquing layout & quality (pass ${iteration}/${MAX_REFLECT_ITERATIONS})...`, 75 + iteration * 3);

      const reflectPrompt = `
        You are a Carousel Quality Inspector. Critique the following slide layouts against quality standards and user constraints.

        Target Slide Count: ${plan.targetSlideCount}
        Actual Slide Count: ${currentSlides.length}
        Banned Words Rules: ${structuredMemory.bannedWords.length ? JSON.stringify(structuredMemory.bannedWords) : 'None'}
        Brand Rules: ${structuredMemory.brandRules.length ? JSON.stringify(structuredMemory.brandRules) : 'None'}
        Working Memory: ${JSON.stringify(workingMemory)}

        Slide Layouts:
        ${JSON.stringify(
          currentSlides.map((s, idx) => ({
            index: idx,
            blockType: s.blockType,
            headline: s.slots.headline,
            body: s.slots.body,
          })),
          null,
          2
        )}

        Evaluation Criteria:
        1. Does slide count match exactly ${plan.targetSlideCount}?
        2. Are any Banned Words present in slide headlines/body? (Flag immediately if found!)
        3. Are brand rules respected?
        4. Are headlines punchy, complete, and free of typos?

        Output JSON:
        {
          "score": number (0-100),
          "needsRevision": boolean,
          "flaggedSlideIndices": array of zero-based slide index numbers requiring fix,
          "feedback": string concise critique notes
        }
      `;

      const reflectSchema = {
        type: 'object',
        properties: {
          score: { type: 'number' },
          needsRevision: { type: 'boolean' },
          flaggedSlideIndices: { type: 'array', items: { type: 'number' } },
          feedback: { type: 'string' },
        },
        required: ['score', 'needsRevision', 'flaggedSlideIndices', 'feedback'],
      };

      try {
        const reflectRes: ReflectResult = await runAgentSpan(
          `CarouselPlanner.REFLECT_${iteration}`,
          { slideCount: currentSlides.length },
          () => generateContentFromAgent(reflectPrompt, reflectSchema)
        );

        workingMemory.push(`Reflect Pass ${iteration}: score ${reflectRes.score}/100. ${reflectRes.feedback}`);

        if (!reflectRes.needsRevision || reflectRes.flaggedSlideIndices.length === 0 || reflectRes.score >= 85) {
          console.log(`[CarouselPlanner] Reflection passed with score ${reflectRes.score}. Ending loop.`);
          break;
        }

        // Targeted LLM revision for the flagged slides — real self-correction,
        // not a placeholder. Rewrites only the flagged slides' copy in place,
        // honoring banned words, brand rules, tone and the inspector's feedback.
        const flagged = reflectRes.flaggedSlideIndices.filter(
          (i) => i >= 0 && i < currentSlides.length
        );
        if (flagged.length === 0) break;

        console.log(`[CarouselPlanner] Revising flagged slides:`, flagged);
        await progress(`REFLECT: Rewriting ${flagged.length} flagged slide(s)...`, 78 + iteration * 3);

        const revisionPrompt = `
        You are a Carousel Copy Editor. Rewrite ONLY the flagged slides below to resolve the inspector's critique, while preserving each slide's original intent and block type.

        Topic / Angle: ${(viralAngle || effectiveInput).slice(0, 500)}
        Output Language: ${agentContext.outputLanguage}
        Inspector Feedback: ${reflectRes.feedback}

        HARD CONSTRAINTS (must obey):
        - Banned Words (must NOT appear anywhere): ${structuredMemory.bannedWords.length ? JSON.stringify(structuredMemory.bannedWords) : 'None'}
        - Brand Rules: ${structuredMemory.brandRules.length ? JSON.stringify(structuredMemory.brandRules) : 'None'}
        - Tone Preferences: ${structuredMemory.tonePrefs.length ? JSON.stringify(structuredMemory.tonePrefs) : 'None'}
        - Headlines must be punchy and complete; body concise. Do NOT add or remove slides.

        Flagged Slides:
        ${JSON.stringify(
          flagged.map((idx) => ({
            index: idx,
            blockType: currentSlides[idx].blockType,
            preHeader: currentSlides[idx].slots.preHeader || '',
            headline: currentSlides[idx].slots.headline || '',
            body: currentSlides[idx].slots.body || '',
            footer: currentSlides[idx].slots.footer || '',
          })),
          null,
          2
        )}

        Output a JSON object with a "revisions" array; each item: { "index": number, "preHeader": string, "headline": string, "body": string, "footer": string }.
        Include only the flagged indices. Keep a field's original text if it needs no change.
      `;

        const revisionSchema = {
          type: 'object',
          properties: {
            revisions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number' },
                  preHeader: { type: 'string' },
                  headline: { type: 'string' },
                  body: { type: 'string' },
                  footer: { type: 'string' },
                },
                required: ['index'],
              },
            },
          },
          required: ['revisions'],
        };

        try {
          const revisionRes: { revisions: Array<{ index: number; preHeader?: string; headline?: string; body?: string; footer?: string }> } =
            await runAgentSpan(
              `CarouselPlanner.REVISE_${iteration}`,
              { flagged },
              () => generateContentFromAgent(revisionPrompt, revisionSchema)
            );

          for (const rev of revisionRes.revisions || []) {
            const target = currentSlides[rev.index];
            if (!target) continue;
            if (typeof rev.preHeader === 'string' && rev.preHeader.trim()) target.slots.preHeader = rev.preHeader.trim();
            if (typeof rev.headline === 'string' && rev.headline.trim()) target.slots.headline = rev.headline.trim();
            if (typeof rev.body === 'string' && rev.body.trim()) target.slots.body = rev.body.trim();
            if (typeof rev.footer === 'string' && rev.footer.trim()) target.slots.footer = rev.footer.trim();
          }

          // Re-polish the revised copy deterministically, matching the EXECUTE phase.
          currentSlides = polishSlides(currentSlides.map(layoutToSlide)).map(slideToLayout);
          workingMemory.push(`Reflect Pass ${iteration}: rewrote slides ${flagged.join(', ')}.`);
        } catch (err) {
          console.warn(`[CarouselPlanner] Targeted revision failed on pass ${iteration}, applying minimal fallback:`, err);
          for (const flagIdx of flagged) {
            const slideToFix = currentSlides[flagIdx];
            if (!slideToFix.slots.headline || slideToFix.slots.headline.length < 5) {
              slideToFix.slots.headline = `Key Point ${flagIdx + 1}: ${payload.topic}`;
            }
          }
        }
      } catch (err) {
        console.warn(`[CarouselPlanner] Reflection pass ${iteration} encountered an error:`, err);
        break;
      }
    }

    // =========================================================================
    // STEP 4: ART DIRECTOR & DOODLE GENERATION (Template 3)
    // =========================================================================
    const legacyForDoodle = currentSlides.map(layoutToSlide);
    if (legacyForDoodle.length > 0 && payload.selectedTemplate === 'template-3') {
      await progress('Art Director: designing sketches...', 85);
      let fluxPrompts: string[];
      try {
        fluxPrompts = await runAgentSpan(
          'ArtDirectorAgent.generatePrompts',
          { slideCount: legacyForDoodle.length, viralAngleOrSource: viralAngle || agentContext.sourceContent },
          () => ArtDirectorAgent.generatePrompts(legacyForDoodle, viralAngle || agentContext.sourceContent)
        );
      } catch (err) {
        console.warn('[CarouselPlanner] Art Director failed, using fallback prompts:', err);
        fluxPrompts = legacyForDoodle.map((s) => s.doodlePrompt || '');
      }

      const concurrencyLimit = 3;
      const jobSeed =
        Math.abs(
          Array.from(jobId).reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 0)
        ) % 2_147_483_647;

      const slidesWithPrompts = legacyForDoodle
        .map((slide, i) => ({ slide, index: i, fluxPrompt: fluxPrompts[i] }))
        .filter((item) => !!item.fluxPrompt);

      let completedCount = 0;
      const executionQueue = [...slidesWithPrompts.entries()];

      const worker = async () => {
        while (executionQueue.length > 0) {
          const next = executionQueue.shift();
          if (!next) break;
          const [, item] = next;

          try {
            const doodleUrl = await runAgentSpan(
              'DoodleImageGeneration',
              { prompt: item.fluxPrompt, index: item.index },
              () => generateAndPersistDoodle(item.fluxPrompt, '2:3', jobSeed)
            );

            if (currentSlides[item.index]) {
              currentSlides[item.index].visual = {
                ...currentSlides[item.index].visual,
                doodleUrl,
                doodlePrompt: item.fluxPrompt,
              };
            }
          } catch (err) {
            console.error(`[CarouselPlanner] Doodle ${item.index + 1} failed:`, err);
          } finally {
            completedCount++;
            const stepPercent = Math.round((completedCount / Math.max(1, slidesWithPrompts.length)) * 8);
            await progress(`Sketching doodle ${completedCount}/${slidesWithPrompts.length}...`, 85 + stepPercent);
          }
        }
      };

      const workers = Array(Math.min(concurrencyLimit, Math.max(1, slidesWithPrompts.length)))
        .fill(null)
        .map(() => worker());

      await Promise.all(workers);
    }

    // =========================================================================
    // STEP 5: SAVE & PERSISTENCE
    // =========================================================================
    await progress('Saving carousel & finalizing...', 95);
    const finalLegacySlides = currentSlides.map(layoutToSlide);

    const carouselId = await createCarouselServer({
      userId,
      title: payload.topic.length > 80 ? payload.topic.slice(0, 77) + '…' : payload.topic,
      templateType: payload.selectedTemplate.replace('-', '') as any,
      theme: currentTheme,
      slides: finalLegacySlides,
      brandMode: payload.brandMode,
      presetId: payload.presetId,
      brandKit: payload.brandKit,
      signaturePosition: payload.signaturePosition,
      format: payload.format,
      selectedPattern: payload.selectedPattern,
      patternOpacity: payload.patternOpacity,
    });

    const reply = `Done — ${currentSlides.length} slides generated via Plan-Execute-Reflect loop.`;
    const cleanEvents = events.map((e) => ({ ...e, done: true }));

    try {
      await saveChatServer(
        carouselId,
        userId,
        [
          { id: `msg-${Date.now()}-u`, role: 'user', text: payload.topic },
          {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            text: reply,
            events: cleanEvents,
            tokenUsage: tokenTracker,
          },
        ],
        '',
        0
      );
    } catch (err) {
      console.warn('[CarouselPlanner] Failed to save chat history (non-fatal):', err);
    }

    return {
      carouselId,
      slides: currentSlides,
      theme: currentTheme,
    };
  },
};
