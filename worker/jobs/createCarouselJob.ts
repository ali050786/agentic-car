import { runWithAgentContext } from '../../core/llm/agentGateway';
import { langfuse } from '../../core/llm/langfuse';
import { GenerationJob, updateJob } from '../jobStore';
import { CarouselPlanner, CreateJobPayload } from '../../core/agents/CarouselPlanner';

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

  const updateProgress = async (statusMessage: string, progressPct: number) => {
    const { getJob } = await import('../jobStore');
    const currentJob = await getJob(job.$id);
    if (
      currentJob.status === 'error' &&
      (currentJob.error === 'Cancelled' ||
        currentJob.error === 'Cancelled by user' ||
        currentJob.statusMessage === 'Cancelled.' ||
        currentJob.statusMessage === 'Cancelled by user')
    ) {
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
    cachedTokens: 0,
  };

  const trace = langfuse?.trace({
    name: 'create-carousel',
    userId,
    metadata: {
      topic: payload.topic,
      inputMode: payload.inputMode,
      slideCount: payload.slideCount,
      selectedModel: 'openrouter/deepseek-v4-flash',
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
  };

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

    const plannerResult = await CarouselPlanner.run({
      jobId: job.$id,
      userId,
      payload,
      events,
      progress: updateProgress,
      runAgentSpan,
      tokenTracker,
    });

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
};
