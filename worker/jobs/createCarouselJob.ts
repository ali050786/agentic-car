import { runWithAgentContext, summarizeMetrics, StepMetric } from '../../core/llm/agentGateway';
import { runCreatePipelineV2, type CreatePreview } from '../../core/agents/v2/createPipeline';
import { appwriteStore } from '../../core/agents/v2/persistence';
import { langfuse } from '../../core/llm/langfuse';
import { GenerationJob, getJob, updateJob } from '../jobStore';
import { CarouselPlanner, CreateJobPayload } from '../../core/agents/CarouselPlanner';
import { GatekeeperAgent, GateResult, slideTexts } from '../../core/agents/GatekeeperAgent';
import { deleteCarouselServer } from '../carouselStoreServer';
import { recordRefusal } from '../abuseGuard';

/** Marks a job as a (successful) refusal — a friendly reply, no carousel, no error styling. */
const finishRefused = async (jobId: string, userId: string, gate: GateResult) => {
    recordRefusal(userId, gate.category);
    await updateJob(jobId, {
        status: 'done',
        statusMessage: 'Request declined',
        progress: 100,
        resultSummary: JSON.stringify({ reply: gate.reason, refused: true, category: gate.category }),
    });
};

const isCancelledJob = (j: GenerationJob) =>
  j.status === 'error' &&
  (j.error === 'Cancelled' || j.error === 'Cancelled by user' || j.statusMessage === 'Cancelled.' || j.statusMessage === 'Cancelled by user');

/** Draft slides can be large (Canvas trees): the attribute holds 100k characters. */
const PREVIEW_MAX_CHARS = 95_000;

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

  // Job writes never hold the pipeline up: they go through one queue (so they
  // land in order), progress never goes backwards while steps run in parallel,
  // and a cancel is noticed by a background check instead of a read per step.
  let cancelled = false;
  let closed = false;
  let lastPct = 0;
  let writes: Promise<void> = Promise.resolve();
  // Only the first write sets status 'running'; later ones leave status alone so
  // a cancel the client wrote in between is never overwritten.
  let startedWrite = false;
  const enqueueWrite = (patch: Partial<GenerationJob>) => {
    const full = startedWrite ? patch : { status: 'running' as const, ...patch };
    startedWrite = true;
    writes = writes
      .then(() => (closed ? undefined : updateJob(job.$id, full)))
      .catch((err) => console.warn('[createCarouselJob] job update failed (ignored):', err?.message || err));
  };
  const cancelPoll = setInterval(() => {
    getJob(job.$id).then((j) => { if (isCancelledJob(j)) cancelled = true; }).catch(() => undefined);
  }, 2500);
  const settleWrites = async () => {
    closed = true;
    clearInterval(cancelPoll);
    await writes;
  };

  const updateProgress = async (statusMessage: string, progressPct: number) => {
    if (cancelled) throw new Error('Cancelled by user');
    for (const ev of events) {
      ev.done = true;
    }
    events.push({ label: statusMessage, done: false });
    lastPct = Math.max(lastPct, progressPct);
    if (!closed) enqueueWrite({ statusMessage, progress: lastPct });
  };

  /** Draft slides for the studio while the deck is finished (create jobs, v2). */
  const writePreview = async (preview: CreatePreview) => {
    if (closed || cancelled) return;
    const resultSummary = JSON.stringify({ preview });
    if (resultSummary.length > PREVIEW_MAX_CHARS) {
      console.warn(`[createCarouselJob] preview too large (${resultSummary.length} chars), skipped`);
      return;
    }
    enqueueWrite({ resultSummary });
  };

  const tokenTracker = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
  };
  const metrics: StepMetric[] = [];
  // v2 (outline → hook tournament → writer → rules → critic) is the default;
  // PIPELINE_VERSION=v1 switches back to the Plan-Execute-Reflect planner.
  const pipelineVersion = (process.env.PIPELINE_VERSION || 'v2').toLowerCase() === 'v1' ? 'v1' : 'v2';

  const trace = langfuse?.trace({
    name: 'create-carousel',
    userId,
    metadata: {
      topic: payload.topic,
      inputMode: payload.inputMode,
      slideCount: payload.slideCount,
      pipeline: pipelineVersion,
      selectedTemplate: payload.selectedTemplate,
      presetId: payload.presetId,
      brandMode: payload.brandMode,
      format: payload.format,
    },
  });

  const ctx = {
    userId,
    selectedModel: 'openrouter/deepseek-v4-flash',
    tokenTracker,
    langfuseTrace: trace,
    langfuseSpan: undefined as any,
    metrics,
    isCancelled: () => cancelled,
  };

  try {
    await runJob();
  } finally {
    await settleWrites();
  }

  async function runJob(): Promise<void> {

  if (pipelineVersion === 'v2') {
    await runWithAgentContext(ctx, async () => {
      const outcome = await runCreatePipelineV2({
        jobId: job.$id,
        userId,
        payload,
        store: appwriteStore(),
        progress: updateProgress,
        preview: writePreview,
        usage: () => ({ ...tokenTracker, costUsd: Number(tokenTracker.costUsd.toFixed(5)) }),
      });
      // Nothing queued may land after the final write.
      await settleWrites();
      if (outcome.kind === 'refused') {
        console.warn(`[createCarouselJob] v2 ${outcome.stage} gate blocked user ${userId}: ${outcome.gate.category}`);
        trace?.update({ output: { refused: outcome.gate.category, stage: outcome.stage } });
        await finishRefused(job.$id, userId, outcome.gate);
        return;
      }
      const summary = summarizeMetrics(metrics);
      trace?.update({ output: { stats: outcome.stats, metrics: summary } });
      await updateJob(job.$id, {
        status: 'done',
        statusMessage: 'Done!',
        progress: 100,
        carouselId: outcome.result.carouselId,
        resultSummary: JSON.stringify({
          reply: outcome.reply,
          pipeline: 'v2',
          tokenUsage: { ...tokenTracker, costUsd: Number(tokenTracker.costUsd.toFixed(5)) },
          stats: outcome.stats,
          sources: outcome.result.sources,
          metrics: summary,
        }),
      });
    });
    return;
  }

  await runWithAgentContext(ctx, async () => {
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

    // ── Guardrail, step 0: scope + safety gate BEFORE any pipeline cost ──────
    await updateProgress('Checking your request...', 8);
    const gate = await runAgentSpan('Gatekeeper.gate', { topic: payload.topic }, () =>
      GatekeeperAgent.gate({ topic: payload.topic, sourceContent: payload.sourceContent })
    );
    if (!gate.allowed) {
      console.warn(`[createCarouselJob] Gatekeeper blocked user ${userId}: ${gate.category}`);
      await settleWrites();
      await finishRefused(job.$id, userId, gate);
      return;
    }

    // v1 predates the Canvas: build those decks as The Truth.
    const v1Payload = payload.selectedTemplate === 'template-5' ? { ...payload, selectedTemplate: 'template-1' as const } : payload;
    const plannerResult = await CarouselPlanner.run({
      jobId: job.$id,
      userId,
      payload: v1Payload,
      events,
      progress: updateProgress,
      runAgentSpan,
      tokenTracker,
    });

    // ── Guardrail, output moderation: screen the generated deck. On a flag,
    // delete the just-created carousel and refuse rather than surfacing it. ──
    const moderation = await runAgentSpan('Gatekeeper.moderateOutput', { carouselId: plannerResult.carouselId }, () =>
      GatekeeperAgent.moderateOutput(slideTexts(plannerResult.slides))
    );
    await settleWrites();
    if (!moderation.allowed) {
      console.warn(`[createCarouselJob] Output moderation blocked carousel ${plannerResult.carouselId} for user ${userId}: ${moderation.category}`);
      try {
        await deleteCarouselServer(plannerResult.carouselId);
      } catch (err) {
        console.warn('[createCarouselJob] Failed to delete moderated carousel (non-fatal):', err);
      }
      await finishRefused(job.$id, userId, moderation);
      return;
    }

    const reply = `Done — ${plannerResult.slides.length} slides generated via Plan-Execute-Reflect loop.`;

    await updateJob(job.$id, {
      status: 'done',
      statusMessage: 'Done!',
      progress: 100,
      carouselId: plannerResult.carouselId,
      resultSummary: JSON.stringify({
        reply,
        tokenUsage: tokenTracker,
      }),
    });
  });
  }
};
