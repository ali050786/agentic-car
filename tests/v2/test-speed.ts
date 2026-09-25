/**
 * Timing simulation for the v2 create pipeline: the scripted model answers
 * after a delay per call (roughly 1 ms here per 100 ms of a real call), and
 * the test checks which steps overlap, how early the first slides are ready,
 * and how the wall time compares with running every call one after another.
 *
 *   npx tsx tests/v2/test-speed.ts
 */

import { runWithAgentContext, type StepMetric } from '../../core/llm/agentGateway';
import { runCreatePipelineV2, type CreatePreview } from '../../core/agents/v2/createPipeline';
import { memoryStore } from '../../core/agents/v2/persistence';
import { createMockLLM } from './mockLLM';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : ''); }
};

/** Delays in ms, scaled from typical real latencies (seconds / 100). */
const DELAYS: Record<string, number> = {
    'gatekeeper.classify': 50,
    'gatekeeper.moderate': 50,
    'research.plan': 50,
    'research.facts': 150,
    'creativeDirector': 150,
    'outline': 250,
    'hooks.generate': 200,
    'hooks.judge': 150,
    'writer.': 220,
    // A real writer call's time grows with the slides it writes: 220 ms for a 3-4 slide half.
    'writer.per-slide': 63,
    'verify': 250,
    'tighten': 80,
    'critic': 250,
    'critic.revise': 250,
    'proofread': 80,
};

const SOURCE = `Remote teams that write things down ship 23% faster, per the 2024 GitLab survey. "Default to asynchronous communication," said GitLab CEO Sid Sijbrandij.
Meetings over 30 minutes lose half their attendees' attention. Written decisions travel across time zones; meetings do not. Teams that record decisions spend less time re-litigating them.
This material is long enough to trigger fact extraction from the source rather than web research.`;

const payload = (template: string, over: Record<string, unknown> = {}) => ({
    topic: 'Why async-first remote teams move faster',
    userMessage: 'Make a carousel on why async-first remote teams move faster',
    inputMode: 'text', sourceContent: SOURCE, customInstructions: '', outputLanguage: 'English', slideCount: 7,
    selectedModel: 'x', selectedTemplate: template, presetId: 'ocean-tech', brandMode: 'preset',
    brandKit: { enabled: false, identity: { name: '', title: '', imageUrl: '' }, colors: {} },
    signaturePosition: 'bottom-left', format: 'portrait', selectedPattern: 1, patternOpacity: 0.1,
    ...over,
}) as any;

interface Timed { metrics: StepMetric[]; wall: number; t0: number; previews: { stage: CreatePreview['stage']; at: number }[]; kind: string }

const timedRun = async (template: string, over: Record<string, unknown> = {}): Promise<Timed> => {
    const metrics: StepMetric[] = [];
    const previews: Timed['previews'] = [];
    const mock = createMockLLM({ delays: DELAYS });
    const t0 = Date.now();
    const out = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: mock.fn, metrics }, () =>
        runCreatePipelineV2({
            jobId: `speed-${template}`, userId: 'u1', payload: payload(template, over), store: memoryStore(),
            progress: async () => undefined, options: { skipImages: true },
            preview: (p) => { previews.push({ stage: p.stage, at: Date.now() - t0 }); },
        }));
    return { metrics, wall: Date.now() - t0, t0, previews, kind: out.kind };
};

const calls = (t: Timed, prefix: string) => t.metrics.filter((m) => m.kind === 'llm' && m.name.startsWith(prefix));
const steps = (t: Timed, name: string) => t.metrics.filter((m) => m.kind === 'step' && m.name === name);
const overlaps = (a: StepMetric[], b: StepMetric[]) =>
    a.some((x) => b.some((y) => x !== y && (x.at ?? 0) < (y.at ?? 0) + y.ms && (y.at ?? 0) < (x.at ?? 0) + x.ms));
const serialSum = (t: Timed) => t.metrics.filter((m) => m.kind === 'llm').reduce((a, m) => a + m.ms, 0);

const gantt = (t: Timed) => {
    const width = 70;
    const rows = t.metrics.filter((m) => m.kind === 'llm').sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    const scale = width / t.wall;
    for (const m of rows) {
        const from = Math.floor(((m.at ?? t.t0) - t.t0) * scale);
        const len = Math.max(1, Math.round(m.ms * scale));
        console.log(`    ${m.name.padEnd(20).slice(0, 20)} |${' '.repeat(from)}${'▒'.repeat(Math.min(len, width - from))}${' '.repeat(Math.max(0, width - from - len))}|`);
    }
    for (const p of t.previews) {
        const at = Math.min(width - 1, Math.floor(p.at * scale));
        console.log(`    ${`preview: ${p.stage}`.padEnd(20)} |${' '.repeat(at)}▲${' '.repeat(width - at - 1)}|`);
    }
};

/**
 * What the same calls cost on the critical path of the previous structure:
 * gate → facts → outline → hook write → hook judge → writer (one call) →
 * tighten → 2 × (critic → revise) → tighten → proofread → moderation.
 */
const previousPath = () => {
    const d = DELAYS;
    let ms = Math.max(d['gatekeeper.classify'], d['research.plan']) + d['research.facts'] + d.outline
        + d['hooks.generate'] + d['hooks.judge'] + d['writer.'] * 1.6 + d.tighten
        + 2 * (d.critic + d['critic.revise']) + d.tighten + d.proofread + d['gatekeeper.moderate'];
    return Math.round(ms);
};

const main = async () => {
    console.log('v2 create pipeline: timing simulation (offline)\n');

    // ── Classic template ────────────────────────────────────────────────────
    const t1 = await timedRun('template-1');
    check('classic run finishes', t1.kind === 'done');
    const sum1 = serialSum(t1);
    console.log(`  classic: wall ${t1.wall} ms · all calls back to back ${sum1} ms · previous structure ≈ ${previousPath()} ms · first slides at ${t1.previews[0]?.at ?? '-'} ms`);
    gantt(t1);
    check('writer groups run at the same time', overlaps(calls(t1, 'writer.2-'), calls(t1, 'writer.5-')));
    check('hook tournament runs alongside the writer', overlaps(calls(t1, 'hooks.generate'), calls(t1, 'writer.')));
    check('no separate hook judge call', calls(t1, 'hooks.judge').length === 0);
    check('proofread runs during the editor review', overlaps(calls(t1, 'proofread'), calls(t1, 'critic')));
    check('draft moderation runs during the editor review', overlaps(steps(t1, 'moderate.draft'), calls(t1, 'critic')));
    check('fact check runs alongside the editor review', overlaps(calls(t1, 'verify'), calls(t1, 'critic')));
    check('one critic pass', calls(t1, 'critic').filter((m) => m.name === 'critic').length === 1);
    check('wall time well under running calls back to back (≤ 70%)', t1.wall <= sum1 * 0.7, { wall: t1.wall, sum: sum1 });
    check('faster than the previous structure by a third or more', t1.wall <= previousPath() * 0.67, { wall: t1.wall, previous: previousPath() });
    const draft1 = t1.previews.find((p) => p.stage === 'draft');
    check('first slides ready before the review and revision', !!draft1 && t1.wall - draft1.at >= DELAYS.critic + DELAYS['critic.revise'] * 0.8, { draft: draft1?.at, wall: t1.wall });

    // ── The Statement ─────────────────────────────────────────────────────
    const t4 = await timedRun('template-4');
    check('The Statement run finishes', t4.kind === 'done');
    check('The Statement takes about as long as The Truth (±25%)', Math.abs(t4.wall - t1.wall) <= t1.wall * 0.25, { t4: t4.wall, t1: t1.wall });

    // ── Creative Director in the worker ─────────────────────────────────────
    const cd = await timedRun('template-1', { briefInWorker: true, creativeBrief: undefined });
    check('worker brief overlaps the gate and research planning', overlaps(calls(cd, 'creativeDirector'), [...calls(cd, 'gatekeeper.classify'), ...calls(cd, 'research.plan')]));

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
