/**
 * Pipeline eval runner: v1 (Plan-Execute-Reflect) vs v2 on the golden set.
 *
 *   npx tsx evals/run.ts                       # both pipelines, all cases, judged
 *   npx tsx evals/run.ts --cases=kids-rain,source-4day --pipelines=v2
 *   npx tsx evals/run.ts --mock --pipelines=v2 # offline smoke test of the harness
 *   npx tsx evals/run.ts --serial              # one pipeline at a time: honest latency numbers
 *
 * Nothing is saved to Appwrite (dry runs, no images). Needs OPENROUTER_API_KEY
 * (and optionally TAVILY_API_KEY) in .env / .env.local; v1 also needs the
 * Appwrite server env because its modules import the Appwrite client.
 * Writes evals/reports/<timestamp>.md and .json, updated after every case.
 */

import '../worker/loadEnv';
import fs from 'node:fs';
import path from 'node:path';
import { runWithAgentContext, withSpan, summarizeMetrics, StepMetric, AgentJobContext } from '../core/llm/agentGateway';
import { runCreatePipelineV2 } from '../core/agents/v2/createPipeline';
import { memoryStore } from '../core/agents/v2/persistence';
import { dumpDraft } from '../core/agents/v2/slides';
import { roleConfig } from '../core/llm/models';
import { GOLDEN_SET, GoldenCase } from './goldenSet';
import { checkDeck, judgeDeck, judgePair, toDrafts, DeckChecks, Judgement } from './scorer';
import { createMockLLM } from '../tests/v2/mockLLM';

type Pipeline = 'v1' | 'v2';

interface RunResult {
    pipeline: Pipeline;
    ok: boolean;
    error?: string;
    ms: number;
    slides: any[];
    tokens: number;
    costUsd: number;
    llmCalls: number;
    retries: number;
    checks?: DeckChecks;
    judge?: Judgement;
    extra?: Record<string, unknown>;
    /** What the writer was given (v2: the fact sheet; v1: research text), shown to the judge. */
    evidence?: string;
    /** Sum of model-call time; divided by ms it shows how much ran in parallel. */
    llmMs?: number;
    hedges?: number;
    /** When the studio would first show slides (v2 draft preview), ms from start. */
    firstPreviewMs?: number;
    /** Every step and model call, relative to the run's start. */
    timeline?: TimelineEntry[];
}

interface TimelineEntry {
    kind: 'step' | 'llm';
    name: string;
    start: number;
    ms: number;
    ok: boolean;
    role?: string;
    attempts?: number;
    hedges?: number;
    reasoningTokens?: number;
    firstTokenMs?: number;
    failures?: string[];
}

const timelineOf = (metrics: StepMetric[], started: number): TimelineEntry[] =>
    metrics
        .map((m) => ({
            kind: m.kind,
            name: m.name,
            start: Math.max(0, (m.at ?? started) - started),
            ms: m.ms,
            ok: m.ok,
            role: m.role,
            attempts: m.attempts,
            hedges: m.hedges || undefined,
            reasoningTokens: m.reasoningTokens || undefined,
            firstTokenMs: m.firstTokenMs,
            failures: m.failures,
        }))
        .sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));

interface CaseResult {
    id: string;
    topic: string;
    runs: Partial<Record<Pipeline, RunResult>>;
    pairwise?: { winner: Pipeline | 'tie'; reason: string };
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name: string) => process.argv.includes(`--${name}`);

const MOCK = flag('mock');
const NO_JUDGE = flag('no-judge');
const pipelines = (arg('pipelines') || (MOCK ? 'v2' : 'v1,v2')).split(',').filter((p): p is Pipeline => p === 'v1' || p === 'v2');
/** --repeat=N: every case runs N times (ids get #1…#N), so one noisy judge score can't swing the result. */
const REPEAT = Math.max(1, Math.min(5, Number(arg('repeat') || 1)));
const cases = (() => {
    const ids = arg('cases')?.split(',');
    const base = ids ? GOLDEN_SET.filter((c) => ids.includes(c.id)) : GOLDEN_SET;
    if (REPEAT === 1) return base;
    return Array.from({ length: REPEAT }, (_, r) => base.map((c) => ({ ...c, id: `${c.id}#${r + 1}` }))).flat();
})();
/** --serial: one pipeline at a time, one case at a time, so latency isn't inflated by our own load. */
const SERIAL = flag('serial');
const concurrency = SERIAL ? 1 : Math.max(1, Number(arg('concurrency') || process.env.EVAL_CONCURRENCY || 3));

const ctxFor = (metrics: StepMetric[], tracker: any): AgentJobContext => ({
    userId: 'eval-user',
    selectedModel: 'eval',
    tokenTracker: tracker,
    metrics,
    mockLLM: MOCK ? createMockLLM().fn : undefined,
});

const newTracker = () => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, costUsd: 0 });

const runPipeline = async (p: Pipeline, c: GoldenCase): Promise<RunResult> => {
    const metrics: StepMetric[] = [];
    const tracker = newTracker();
    const started = Date.now();
    const payload: any = {
        topic: c.topic,
        userMessage: c.topic,
        inputMode: c.sourceContent ? 'text' : 'topic',
        sourceContent: c.sourceContent || '',
        customInstructions: '',
        outputLanguage: c.brief.outputLanguage || 'English',
        slideCount: c.slides,
        selectedModel: 'eval',
        selectedTemplate: c.template,
        presetId: 'ocean-tech',
        brandMode: 'preset',
        brandKit: { enabled: false, identity: { name: '', title: '', imageUrl: '' }, colors: {} },
        signaturePosition: 'bottom-left',
        format: 'portrait',
        selectedPattern: 1,
        patternOpacity: 0.1,
        creativeBrief: JSON.parse(JSON.stringify(c.brief)),
        dryRun: true,
    };
    let firstPreviewMs: number | undefined;
    try {
        let slides: any[] = [];
        let extra: Record<string, unknown> = {};
        let evidence = '';
        await runWithAgentContext(ctxFor(metrics, tracker), async () => {
            if (p === 'v2') {
                const out = await runCreatePipelineV2({
                    jobId: `eval-${c.id}`,
                    userId: 'eval-user',
                    payload,
                    store: memoryStore(),
                    progress: async () => undefined,
                    preview: async () => { if (firstPreviewMs === undefined) firstPreviewMs = Date.now() - started; },
                    options: { dryRun: true, skipImages: true, skipGate: true, skipModeration: true },
                });
                if (out.kind !== 'done') throw new Error(`refused: ${out.gate.category}`);
                slides = out.result.slides;
                extra = { stats: out.stats, facts: out.result.facts.length, sources: out.result.sources.map((s) => s.url), hook: out.result.hook?.headline };
                evidence = out.result.facts.map((f) => `[${f.id}] ${f.text}`).join('\n');
            } else {
                // Imported lazily: v1 pulls in the Appwrite server client at module load.
                const { CarouselPlanner } = await import('../core/agents/CarouselPlanner');
                const out = await CarouselPlanner.run({
                    jobId: `eval-${c.id}`,
                    userId: 'eval-user',
                    payload,
                    events: [],
                    progress: async () => undefined,
                    runAgentSpan: (name, input, fn) => withSpan(name, input, fn),
                    tokenTracker: tracker,
                });
                slides = out.slides;
                // Only what research added beyond the request itself.
                const ev = String((out as any).evidence || '');
                evidence = ev.startsWith(c.topic) ? ev.slice(c.topic.length).trim() : ev;
            }
        });
        const m = summarizeMetrics(metrics);
        return { pipeline: p, ok: true, ms: Date.now() - started, slides, tokens: tracker.totalTokens, costUsd: m.costUsd, llmCalls: m.llmCalls, retries: m.retries, llmMs: m.llmMs, hedges: m.hedges, firstPreviewMs, timeline: timelineOf(metrics, started), checks: checkDeck(slides, c), extra, evidence };
    } catch (err: any) {
        const m = summarizeMetrics(metrics);
        return { pipeline: p, ok: false, error: String(err?.message || err).slice(0, 300), ms: Date.now() - started, slides: [], tokens: tracker.totalTokens, costUsd: m.costUsd, llmCalls: m.llmCalls, retries: m.retries, llmMs: m.llmMs, hedges: m.hedges, firstPreviewMs, timeline: timelineOf(metrics, started) };
    }
};

const judgeCtx = () => ctxFor([], newTracker());

const runCase = async (c: GoldenCase, index: number): Promise<CaseResult> => {
    console.log(`▶ ${c.id} (${pipelines.join(' vs ')})`);
    const results: RunResult[] = [];
    if (SERIAL) for (const p of pipelines) results.push(await runPipeline(p, c));
    else results.push(...(await Promise.all(pipelines.map((p) => runPipeline(p, c)))));
    const cr: CaseResult = { id: c.id, topic: c.topic, runs: {} };
    results.forEach((r) => { cr.runs[r.pipeline] = r; });

    if (!NO_JUDGE) {
        await runWithAgentContext(judgeCtx(), async () => {
            await Promise.all(results.filter((r) => r.ok).map(async (r) => {
                try { r.judge = await judgeDeck(r.slides, c, r.evidence); } catch (err) { console.warn(`  judge failed for ${r.pipeline}:`, err); }
            }));
            const v1 = cr.runs.v1;
            const v2 = cr.runs.v2;
            if (v1?.ok && v2?.ok) {
                // Alternate sides so position bias can't favour one pipeline.
                const v2First = index % 2 === 0;
                try {
                    const pr = await judgePair(v2First ? v2.slides : v1.slides, v2First ? v1.slides : v2.slides, c, v2First ? v2.evidence : v1.evidence, v2First ? v1.evidence : v2.evidence);
                    const winner = pr.winner === 'tie' ? 'tie' : (pr.winner === 'A') === v2First ? 'v2' : 'v1';
                    cr.pairwise = { winner, reason: pr.reason };
                } catch (err) {
                    console.warn('  pairwise judge failed:', err);
                }
            }
        });
    }
    for (const r of results) {
        const preview = r.firstPreviewMs !== undefined ? `, preview at ${(r.firstPreviewMs / 1000).toFixed(0)}s` : '';
        console.log(`  ${r.pipeline}: ${r.ok ? `${r.checks?.slides} slides, overall ${r.judge?.overall ?? '-'}, ${(r.ms / 1000).toFixed(0)}s${preview}, $${r.costUsd.toFixed(4)}, ${r.llmCalls} calls` : `FAILED ${r.error}`}`);
    }
    if (cr.pairwise) console.log(`  pairwise → ${cr.pairwise.winner}`);
    return cr;
};

// ── Report ─────────────────────────────────────────────────────────────────

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (n: number) => n.toFixed(1);

const report = (all: CaseResult[], startedAt: Date): string => {
    const lines: string[] = [];
    const models = (['fast', 'planner', 'writer', 'creative', 'critic'] as const).map((r) => `${r}: ${roleConfig(r).model} @ ${roleConfig(r).temperature}`).join(' · ');
    lines.push(`# Pipeline eval: ${pipelines.join(' vs ')}`, '');
    lines.push(`Run ${startedAt.toISOString()} · ${all.length}/${cases.length} cases${MOCK ? ' · MOCK MODEL (harness smoke test, scores meaningless)' : ''}`, '');
    lines.push(`Models: ${models}`, '');
    lines.push('Judge: the `critic` role at temperature 0, blind to which pipeline wrote each deck. Pairwise order alternates per case.', '');

    lines.push('## Summary', '');
    lines.push(`| Metric | ${pipelines.join(' | ')} |`, `|---|${pipelines.map(() => '---').join('|')}|`);
    const col = (fn: (r: RunResult) => number | undefined, fmt = f1) => pipelines.map((p) => {
        const xs = all.map((c) => c.runs[p]).filter((r): r is RunResult => !!r && r.ok).map(fn).filter((x): x is number => typeof x === 'number');
        return xs.length ? fmt(avg(xs)) : '-';
    });
    const sum = (fn: (r: RunResult) => number | undefined) => pipelines.map((p) => String(all.map((c) => c.runs[p]).filter((r): r is RunResult => !!r && r.ok).reduce((a, r) => a + (fn(r) || 0), 0)));
    const row = (name: string, vals: string[]) => lines.push(`| ${name} | ${vals.join(' | ')} |`);
    row('Judge overall (1-10)', col((r) => r.judge?.overall));
    for (const k of ['hook', 'flow', 'specificity', 'clarity', 'audienceFit', 'accuracy', 'expectations'] as const) row(`  ${k}`, col((r) => r.judge?.[k]));
    row('Runs completed', pipelines.map((p) => `${all.filter((c) => c.runs[p]?.ok).length}/${all.length}`));
    row('Exact slide count', pipelines.map((p) => `${all.filter((c) => c.runs[p]?.checks?.countOk).length}/${all.length}`));
    row('Fields over limit (total)', sum((r) => r.checks?.overLimit));
    row('Missing required fields (total)', sum((r) => r.checks?.missingRequired));
    row('Accent not in headline (total)', sum((r) => r.checks?.accentInvalid));
    row('Duplicate headlines (total)', sum((r) => r.checks?.duplicates));
    row('Stat/quote/split slides as rendered (total)', sum((r) => r.checks?.richBlocksRendered));
    row('Numeric claims (total)', sum((r) => r.checks?.numericClaims));
    row('Bodies ending mid-sentence (total)', sum((r) => r.checks?.fragments));
    row('Fact-check findings fixed in review (total)', sum((r) => ((r.extra as any)?.stats?.factCheckFindings || []).length));
    row('Avg latency (s)', col((r) => r.ms / 1000, (n) => n.toFixed(0)));
    row('Slowest run (s)', pipelines.map((p) => { const xs = all.map((c) => c.runs[p]).filter((r): r is RunResult => !!r && r.ok).map((r) => r.ms / 1000); return xs.length ? Math.max(...xs).toFixed(0) : '-'; }));
    row('First slides on screen (s)', col((r) => (r.firstPreviewMs !== undefined ? r.firstPreviewMs / 1000 : undefined), (n) => n.toFixed(0)));
    row('Parallelism (model time ÷ wall time)', col((r) => (r.llmMs && r.ms ? r.llmMs / r.ms : undefined), (n) => `${n.toFixed(2)}×`));
    row('Avg LLM calls', col((r) => r.llmCalls));
    row('Avg retries', col((r) => r.retries));
    row('Avg hedged calls', col((r) => r.hedges));
    row('Avg cost (USD)', col((r) => r.costUsd, (n) => `$${n.toFixed(4)}`));
    if (pipelines.length === 2) {
        const w = (x: string) => all.filter((c) => c.pairwise?.winner === x).length;
        lines.push('', `**Blind pairwise preference:** v2 ${w('v2')} · v1 ${w('v1')} · tie ${w('tie')}`);
    }

    lines.push(...timingSection(all));

    lines.push('', '## Per case', '');
    lines.push(`| Case | ${pipelines.map((p) => `${p} overall`).join(' | ')} | Pairwise | Why |`, `|---|${pipelines.map(() => '---').join('|')}|---|---|`);
    for (const c of all) {
        lines.push(`| ${c.id} | ${pipelines.map((p) => { const r = c.runs[p]; return r?.ok ? `${r.judge?.overall ?? '-'} (${r.checks?.slides} sl, ${(r.ms / 1000).toFixed(0)}s)` : `failed`; }).join(' | ')} | ${c.pairwise?.winner || '-'} | ${(c.pairwise?.reason || '').replace(/\|/g, '/').slice(0, 220)} |`);
    }

    lines.push('', '## Decks', '');
    for (const c of all) {
        lines.push(`### ${c.id}: ${c.topic}`, '');
        for (const p of pipelines) {
            const r = c.runs[p];
            if (!r) continue;
            lines.push(`**${p}**${r.ok ? ` · judge ${r.judge?.overall ?? '-'} · ${r.judge?.notes ? `"${r.judge.notes.replace(/\n/g, ' ').slice(0, 300)}"` : ''}` : ` · failed: ${r.error}`}`, '');
            const found: string[] = (r.extra as any)?.stats?.factCheckFindings || [];
            if (r.ok && found.length) lines.push('Fact check flagged in the draft (sent to the revision):', ...found.map((x) => `- ${x.replace(/\n/g, ' ').slice(0, 300)}`), '');
            if (r.ok) lines.push('```', ...toDrafts(r.slides).map(dumpDraft), '```', '');
        }
    }
    return lines.join('\n');
};

// ── Where the time goes ─────────────────────────────────────────────────────

const pct = (xs: number[], q: number) => {
    if (!xs.length) return 0;
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const sec = (ms: number) => (ms / 1000).toFixed(1);

/** A text gantt of one run: one row per step/call, bars scaled to the run's length. */
const gantt = (r: RunResult, width = 60): string[] => {
    const rows = (r.timeline || []).filter((t) => t.ms >= 200 || t.kind === 'step');
    if (!rows.length || !r.ms) return [];
    const scale = width / r.ms;
    const label = (t: TimelineEntry) => `${t.kind === 'llm' ? '  · ' : ''}${t.name}`.padEnd(26).slice(0, 26);
    const out = rows.map((t) => {
        const from = Math.floor(t.start * scale);
        const len = Math.max(1, Math.round(t.ms * scale));
        const bar = ' '.repeat(Math.min(width, from)) + (t.kind === 'llm' ? '▒' : '█').repeat(Math.min(width - Math.min(width, from), len) || 1);
        const notes = [t.attempts && t.attempts > 1 ? `${t.attempts} tries` : '', t.hedges ? 'hedged' : '', t.ok ? '' : 'FAILED'].filter(Boolean).join(', ');
        return `${label(t)} |${bar.padEnd(width)}| ${sec(t.start)}s +${sec(t.ms)}s${notes ? ` (${notes})` : ''}`;
    });
    if (r.firstPreviewMs !== undefined) {
        const at = Math.min(width - 1, Math.floor(r.firstPreviewMs * scale));
        out.push(`${'first slides on screen'.padEnd(26)} |${' '.repeat(at)}▲${' '.repeat(width - at - 1)}| ${sec(r.firstPreviewMs)}s`);
    }
    return out;
};

const timingSection = (all: CaseResult[]): string[] => {
    const lines: string[] = ['', '## Where the time goes', ''];
    if (!SERIAL && pipelines.length > 1) lines.push(`_Pipelines and cases ran concurrently (concurrency ${concurrency}); latency is inflated by our own load. Use \`--serial\` for clean numbers._`, '');
    for (const p of pipelines) {
        const runs = all.map((c) => c.runs[p]).filter((r): r is RunResult => !!r && !!r.timeline?.length);
        if (!runs.length) continue;
        const n = runs.length;
        const byName = (kind: 'llm' | 'step') => {
            const map = new Map<string, TimelineEntry[]>();
            // Writer calls are labelled by slide range (writer.1-4); group them.
            const key = (name: string) => name.replace(/^writer\.\d+-\d+$/, 'writer.* (per call)');
            for (const r of runs) for (const t of r.timeline!) if (t.kind === kind) map.set(key(t.name), [...(map.get(key(t.name)) || []), t]);
            return Array.from(map.entries()).sort((a, b) => b[1].reduce((x, t) => x + t.ms, 0) - a[1].reduce((x, t) => x + t.ms, 0));
        };

        lines.push(`### ${p}: model calls by label`, '');
        lines.push('| Call | Calls/run | Avg s | p90 s | Total s/run | Retries/run | Hedged/run | First token s | Reasoning tok/run | Failed |', '|---|---|---|---|---|---|---|---|---|---|');
        for (const [name, ts] of byName('llm')) {
            const ms = ts.map((t) => t.ms);
            const ft = ts.map((t) => t.firstTokenMs).filter((x): x is number => typeof x === 'number');
            lines.push(`| ${name} | ${(ts.length / n).toFixed(1)} | ${sec(avg(ms))} | ${sec(pct(ms, 0.9))} | ${sec(ms.reduce((a, b) => a + b, 0) / n)} | ${(ts.reduce((a, t) => a + Math.max(0, (t.attempts || 1) - 1), 0) / n).toFixed(1)} | ${(ts.reduce((a, t) => a + (t.hedges || 0), 0) / n).toFixed(1)} | ${ft.length ? sec(avg(ft)) : '-'} | ${Math.round(ts.reduce((a, t) => a + (t.reasoningTokens || 0), 0) / n)} | ${ts.filter((t) => !t.ok).length} |`);
        }
        lines.push('', `### ${p}: steps`, '');
        lines.push('| Step | Runs | Avg s | p90 s | Avg start s |', '|---|---|---|---|---|');
        for (const [name, ts] of byName('step')) {
            const ms = ts.map((t) => t.ms);
            lines.push(`| ${name} | ${ts.length} | ${sec(avg(ms))} | ${sec(pct(ms, 0.9))} | ${sec(avg(ts.map((t) => t.start)))} |`);
        }
        const failures = runs.flatMap((r) => r.timeline!.flatMap((t) => (t.failures || []).map((f) => `${t.name}: ${f}`)));
        if (failures.length) {
            const counts = new Map<string, number>();
            for (const f of failures) {
                const key = f.replace(/\d{3,}ms/g, 'Nms').replace(/: \{.*$/, '').slice(0, 90);
                counts.set(key, (counts.get(key) || 0) + 1);
            }
            lines.push('', `**Why attempts failed (${p}):**`, '');
            for (const [k, v] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)) lines.push(`- ${v}× ${k}`);
        }
        const slowest = runs.filter((r) => r.ok).sort((a, b) => b.ms - a.ms)[0];
        if (slowest) {
            const id = all.find((c) => c.runs[p] === slowest)?.id;
            lines.push('', `**Timeline of the slowest ${p} run (${id}, ${sec(slowest.ms)}s).** █ step, ▒ model call.`, '', '```', ...gantt(slowest), '```');
        }
        lines.push('');
    }
    return lines;
};

const main = async () => {
    const startedAt = new Date();
    const stamp = startedAt.toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const dir = path.resolve(process.cwd(), 'evals/reports');
    fs.mkdirSync(dir, { recursive: true });
    const base = path.join(dir, `${stamp}${MOCK ? '-mock' : ''}`);
    console.log(`Eval: ${cases.length} cases × ${pipelines.join(', ')} (${SERIAL ? 'serial' : `concurrency ${concurrency}`})${MOCK ? ' [mock]' : ''}`);

    const all: CaseResult[] = [];
    const queue = cases.map((c, i) => ({ c, i }));
    const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
            const cr = await runCase(next.c, next.i);
            all.push(cr);
            all.sort((a, b) => cases.findIndex((c) => c.id === a.id) - cases.findIndex((c) => c.id === b.id));
            fs.writeFileSync(`${base}.json`, JSON.stringify(all, null, 2));
            fs.writeFileSync(`${base}.md`, report(all, startedAt));
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    console.log(`\nReport: ${path.relative(process.cwd(), base)}.md`);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
