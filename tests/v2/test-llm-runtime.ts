/**
 * Offline test for the model runtime: roles, schema coercion, retries,
 * fallback chain, repair round trip, usage/cost accounting. fetch is stubbed.
 *
 *   npx tsx tests/v2/test-llm-runtime.ts
 */

import { generateContent, UsageReport } from '../../core/llm/generateContent';
import { validateAndCoerce, unwrapEnvelope } from '../../core/llm/schema';
import { roleConfig } from '../../core/llm/models';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 300) : ''); }
};

type Reply = { status?: number; body?: any; content?: string; usage?: any; throwAbort?: boolean };
let script: Reply[] = [];
const seen: any[] = [];
(globalThis as any).fetch = async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    seen.push(body);
    const r = script.shift() || { content: '{}' };
    if (r.throwAbort) { const e: any = new Error('aborted'); e.name = 'AbortError'; throw e; }
    const status = r.status ?? 200;
    const payload = r.body ?? { choices: [{ message: { content: r.content ?? '{}' }, finish_reason: 'stop' }], usage: r.usage ?? { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.0001, prompt_tokens_details: { cached_tokens: 4 } } };
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
    } as any;
};

const SCHEMA = {
    type: 'object',
    properties: {
        count: { type: 'number' },
        items: { type: 'array', items: { type: 'string' }, maxItems: 2 },
        kind: { type: 'string', enum: ['a', 'b'] },
        ok: { type: 'boolean' },
    },
    required: ['count', 'items'],
};

const keys = { openrouter: 'test-key' };

/**
 * Streaming stub. Each scripted stream is a list of steps: text chunks sent
 * after a delay. The reader honours the abort signal like real fetch does.
 */
type StreamStep = { wait: number; content?: string; reasoning?: string; comment?: boolean; usage?: any; finish?: string };
type StreamReply = { steps?: StreamStep[]; status?: number; text?: string };
let streamScript: StreamReply[] = [];
const streamSeen: any[] = [];
let streamOpen = 0;
let streamAborted = 0;
const streamFetch = async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    streamSeen.push(body);
    const r = streamScript.shift() || { steps: [{ wait: 0, content: '{}' }] };
    if (r.status && r.status !== 200) {
        return { ok: false, status: r.status, headers: { get: () => 'application/json' }, text: async () => r.text || '' } as any;
    }
    const enc = new TextEncoder();
    const steps = [...(r.steps || [])];
    const signal: AbortSignal = init.signal;
    streamOpen++;
    let closed = false;
    const close = () => { if (!closed) { closed = true; streamOpen--; } };
    const reader = {
        read: () => new Promise<{ done: boolean; value?: Uint8Array }>((resolve, reject) => {
            const step = steps.shift();
            if (!step) {
                close();
                resolve({ done: true });
                return;
            }
            const t = setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                let line: string;
                if (step.comment) line = ': OPENROUTER PROCESSING\n\n';
                else {
                    const delta: any = {};
                    if (step.content !== undefined) delta.content = step.content;
                    if (step.reasoning !== undefined) delta.reasoning = step.reasoning;
                    const chunk: any = { choices: [{ delta, finish_reason: step.finish || null }] };
                    if (step.usage) chunk.usage = step.usage;
                    line = `data: ${JSON.stringify(chunk)}\n\n`;
                }
                resolve({ done: false, value: enc.encode(line) });
            }, step.wait);
            const onAbort = () => {
                clearTimeout(t);
                streamAborted++;
                close();
                const e: any = new Error('aborted');
                e.name = 'AbortError';
                reject(e);
            };
            if (signal.aborted) onAbort();
            else signal.addEventListener('abort', onAbort, { once: true });
        }),
    };
    return { ok: true, status: 200, headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/event-stream' : null) }, body: { getReader: () => reader } } as any;
};

const USAGE = { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28, cost: 0.0002, completion_tokens_details: { reasoning_tokens: 3 } };
const answer = (json: string, wait = 20): StreamStep[] => [
    { wait, content: json.slice(0, 5) },
    { wait: 10, content: json.slice(5) },
    { wait: 5, finish: 'stop', usage: USAGE },
];

const streamingTests = async () => {
    console.log('\nStreaming');
    const savedFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = streamFetch;
    const env = {
        LLM_FIRST_TOKEN_MS_FAST: '250',
        LLM_STALL_MS_FAST: '250',
        LLM_HEDGE_MS_FAST: '0',
        LLM_FIRST_TOKEN_MS_PLANNER: '2000',
        LLM_STALL_MS_PLANNER: '2000',
        LLM_HEDGE_MS_PLANNER: '120',
    };
    Object.assign(process.env, env);
    let usage: UsageReport | null = null;
    const onTokenUsage = (u: UsageReport) => { usage = u; };

    try {
        check('every role runs without hidden reasoning by default', ['fast', 'planner', 'writer', 'creative', 'critic'].every((r) => roleConfig(r as any).reasoning === 'off'));
        process.env.LLM_REASONING_WRITER = 'default';
        check('LLM_REASONING_WRITER turns it back on for the writer only', roleConfig('writer').reasoning === 'default' && roleConfig('creative').reasoning === 'off');
        delete process.env.LLM_REASONING_WRITER;
        check('every role streams by default', ['fast', 'planner', 'writer', 'creative', 'critic'].every((r) => roleConfig(r as any).stream));

        // Happy path: body is assembled from deltas; usage from the final chunk.
        streamScript = [{ steps: answer('{"count": 4, "items": ["s"]}') }];
        const a = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        const sent = streamSeen[streamSeen.length - 1];
        check('assembles streamed JSON', a.count === 4 && a.items[0] === 's', a);
        check('asks for a stream', sent.stream === true);
        check('switches reasoning off for a quick role', sent.reasoning?.enabled === false, sent.reasoning);
        check('routes to the fastest provider by default', sent.provider?.sort === 'throughput', sent.provider);
        check('reports first-token time and reasoning tokens', typeof usage!.firstTokenMs === 'number' && usage!.firstTokenMs! >= 15 && usage!.reasoningTokens === 3, usage);

        // Writer: reasoning switched off by default.
        streamScript = [{ steps: answer('{"count": 1, "items": []}') }];
        await generateContent({ prompt: 'p', role: 'writer', schema: SCHEMA as any, systemKeys: keys });
        check('writer asks for reasoning off', streamSeen[streamSeen.length - 1].reasoning?.enabled === false, streamSeen[streamSeen.length - 1].reasoning);
        // LLM_REASONING_WRITER=default → no switch sent, the model decides.
        process.env.LLM_REASONING_WRITER = 'default';
        streamScript = [{ steps: answer('{"count": 1, "items": []}') }];
        await generateContent({ prompt: 'p', role: 'writer', schema: SCHEMA as any, systemKeys: keys });
        delete process.env.LLM_REASONING_WRITER;
        check('LLM_REASONING_WRITER=default leaves reasoning to the model', streamSeen[streamSeen.length - 1].reasoning === undefined);

        // LLM_PROVIDER_SORT=off removes routing.
        process.env.LLM_PROVIDER_SORT = 'off';
        streamScript = [{ steps: answer('{"count": 1, "items": []}') }];
        await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys });
        check('provider routing can be switched off', streamSeen[streamSeen.length - 1].provider === undefined);
        delete process.env.LLM_PROVIDER_SORT;

        // Silent attempt: cut at first-token limit, retried at once (no backoff).
        streamScript = [{ steps: [{ wait: 5000, content: '{}' }] }, { steps: answer('{"count": 2, "items": []}') }];
        let t0 = Date.now();
        const b = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        let took = Date.now() - t0;
        check('cuts a silent attempt and retries', b.count === 2 && usage!.attempts === 2 && /No response/.test(usage!.failures![0] || ''), usage);
        check('retry after a silent attempt is immediate', took < 900, took);

        // Keep-alive comments are not progress.
        streamScript = [{ steps: [{ wait: 100, comment: true }, { wait: 100, comment: true }, { wait: 100, comment: true }, { wait: 5000, content: '{}' }] }, { steps: answer('{"count": 3, "items": []}') }];
        const c = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        check('keep-alive comments do not count as tokens', c.count === 3 && usage!.attempts === 2, usage);

        // Stall mid-answer: cut after stallMs of silence.
        streamScript = [{ steps: [{ wait: 10, content: '{"cou' }, { wait: 5000, content: 'nt": 1}' }] }, { steps: answer('{"count": 5, "items": []}') }];
        t0 = Date.now();
        const d = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        took = Date.now() - t0;
        check('cuts a stalled stream and retries', d.count === 5 && /Stalled/.test(usage!.failures![0] || ''), usage);
        check('stall is caught quickly', took < 900, took);

        // Reasoning tokens count as progress (a thinking model is not stalled).
        streamScript = [{ steps: [{ wait: 150, reasoning: 'hmm' }, { wait: 150, reasoning: 'more' }, { wait: 150, reasoning: 'done' }, ...answer('{"count": 6, "items": []}', 100)] }];
        const e = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        check('reasoning deltas keep the stream alive', e.count === 6 && usage!.attempts === 1, usage);

        // A provider that rejects the reasoning switch: retried without it, and remembered.
        process.env.LLM_MODEL_FAST = 'picky/model';
        streamScript = [{ status: 400, text: '{"error":{"message":"reasoning is not supported for this model"}}' }, { steps: answer('{"count": 7, "items": []}') }];
        t0 = Date.now();
        const f = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys });
        const retry = streamSeen[streamSeen.length - 1];
        check('drops the reasoning switch after a 400 and retries at once', f.count === 7 && retry.reasoning === undefined && Date.now() - t0 < 500, retry.reasoning);
        streamScript = [{ steps: answer('{"count": 8, "items": []}') }];
        await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys });
        check('remembers the model cannot switch reasoning', streamSeen[streamSeen.length - 1].reasoning === undefined);
        delete process.env.LLM_MODEL_FAST;

        // Hedge: first attempt is slow to start, twin answers first, loser is cancelled.
        streamScript = [{ steps: [{ wait: 1500, content: '{"count": 90, "items": []}' }, { wait: 5, finish: 'stop' }] }, { steps: answer('{"count": 9, "items": []}') }];
        const before = streamSeen.length;
        t0 = Date.now();
        const g = await generateContent({ prompt: 'p', role: 'planner', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        took = Date.now() - t0;
        await sleep(30);
        check('hedged twin wins', g.count === 9 && usage!.hedges === 1 && streamSeen.length - before === 2, { g, usage });
        check('hedge beats the slow attempt', took < 700, took);
        check('the slower request is cancelled', streamOpen === 0 && streamAborted >= 1, { streamOpen, streamAborted });

        // No hedge when the first token arrives in time.
        streamScript = [{ steps: answer('{"count": 10, "items": []}', 30) }];
        const beforeNoHedge = streamSeen.length;
        const h = await generateContent({ prompt: 'p', role: 'planner', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        await sleep(200);
        check('no twin when the first token is on time', h.count === 10 && usage!.hedges === 0 && streamSeen.length - beforeNoHedge === 1, usage);

        // Hedge: if the first attempt fails outright, the twin still gets its chance.
        streamScript = [{ steps: [{ wait: 400, content: '' }, { wait: 5000, content: 'x' }] }, { steps: answer('{"count": 11, "items": []}', 50) }];
        const i = await generateContent({ prompt: 'p', role: 'planner', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        check('twin answer survives the first attempt', i.count === 11, { i, usage });

        // Streaming error chunk is surfaced and retried.
        streamScript = [
            { steps: [{ wait: 10, content: '' }] },
            { steps: answer('{"count": 12, "items": []}') },
        ];
        const j = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage });
        check('empty stream is retried', j.count === 12 && usage!.attempts === 2, usage);

        // LLM_STREAM=off falls back to one JSON response.
        process.env.LLM_STREAM = 'off';
        streamScript = [{ steps: answer('{"count": 1, "items": []}') }];
        (globalThis as any).fetch = savedFetch;
        script = [{ content: '{"count": 13, "items": []}' }];
        const k = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys });
        check('LLM_STREAM=off sends a plain request', k.count === 13 && seen[seen.length - 1].stream === undefined);
        delete process.env.LLM_STREAM;
    } finally {
        (globalThis as any).fetch = savedFetch;
        for (const key of Object.keys(env)) delete process.env[key];
        streamScript = [];
    }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
    console.log('LLM runtime (offline)\n');

    // Roles
    check('writer role is warmer than critic', roleConfig('writer').temperature > roleConfig('critic').temperature);
    process.env.LLM_MODEL_CRITIC = 'some/other-model';
    check('per-role model override via env', roleConfig('critic').model === 'some/other-model');
    delete process.env.LLM_MODEL_CRITIC;
    check('DeepSeek is the default everywhere', ['fast', 'planner', 'writer', 'creative', 'critic'].every((r) => roleConfig(r as any).model === 'deepseek/deepseek-v4-flash'));

    // Schema coercion
    const c = validateAndCoerce({ count: '12', items: 'solo', kind: 'zzz', ok: 'true' }, SCHEMA as any);
    check('coerces "12" → 12', c.value.count === 12);
    check('wraps a lone string into an array', Array.isArray(c.value.items) && c.value.items[0] === 'solo');
    check('drops an optional enum mismatch', c.value.kind === undefined);
    check('coerces "true" → true', c.value.ok === true);
    check('unwraps {"data": {...}} envelopes', unwrapEnvelope({ data: { count: 1, items: [] } }, SCHEMA as any).count === 1);
    const objs = validateAndCoerce({ count: 1, items: [{ bullet: 'Docs', description: 'write the decision first' }, { text: 'Threads' }] }, SCHEMA as any);
    check('list items as {bullet, description} become "key: detail" (no repair call)', objs.errors.length === 0 && objs.value.items[0] === 'Docs: write the decision first' && objs.value.items[1] === 'Threads', objs);
    const nested = validateAndCoerce({ count: 1, items: [{ a: { b: 'x' } }] }, SCHEMA as any);
    check('objects that are not simple text still need a repair', nested.errors.length === 1);
    const trimmed = validateAndCoerce({ count: 1, items: ['a', 'b', 'c'] }, SCHEMA as any);
    check('truncates to maxItems', trimmed.value.items.length === 2);

    // Happy path + usage
    let usage: UsageReport | null = null;
    script = [{ content: '{"count": 3, "items": ["x"]}' }];
    const r1 = await generateContent({ prompt: 'p', role: 'writer', schema: SCHEMA as any, systemKeys: keys, onTokenUsage: (u) => { usage = u; } });
    check('returns parsed JSON', r1.count === 3);
    check('sends the role temperature', seen[seen.length - 1].temperature === roleConfig('writer').temperature);
    check('asks for JSON mode + usage', seen[seen.length - 1].response_format?.type === 'json_object' && seen[seen.length - 1].usage?.include === true);
    check('reports cost and cached tokens', usage!.costUsd === 0.0001 && usage!.cachedTokens === 4, usage);

    // Retry on 429 then succeed
    script = [{ status: 429, body: { error: 'rate' } }, { content: '{"count": 1, "items": []}' }];
    const r2 = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys, onTokenUsage: (u) => { usage = u; } });
    check('retries a 429', r2.count === 1 && usage!.attempts === 2, usage);

    // Timeout counts as retryable
    script = [{ throwAbort: true }, { content: '{"count": 2, "items": []}' }];
    const r3 = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys });
    check('retries after a timeout', r3.count === 2);

    // Fallback chain: primary fails 3x, fallback model answers
    process.env.LLM_FALLBACK_MODELS = 'backup/model';
    script = [{ status: 500 }, { status: 502 }, { status: 503 }, { content: '{"count": 9, "items": []}' }];
    const r4 = await generateContent({ prompt: 'p', role: 'planner', schema: SCHEMA as any, systemKeys: keys, onTokenUsage: (u) => { usage = u; } });
    check('falls back to the next model', r4.count === 9 && usage!.model === 'backup/model', usage);
    delete process.env.LLM_FALLBACK_MODELS;

    // Auth error stops immediately
    process.env.LLM_FALLBACK_MODELS = 'backup/model';
    script = [{ status: 401 }];
    const before = seen.length;
    let threw = false;
    try { await generateContent({ prompt: 'p', role: 'planner', schema: SCHEMA as any, systemKeys: keys }); } catch { threw = true; }
    check('401 fails fast without retries or fallback', threw && seen.length - before === 1, seen.length - before);
    delete process.env.LLM_FALLBACK_MODELS;

    // Repair round trip on schema mismatch
    script = [{ content: '{"items": ["a"]}' }, { content: '{"count": 5, "items": ["a"]}' }];
    const r5 = await generateContent({ prompt: 'p', role: 'planner', schema: SCHEMA as any, systemKeys: keys, onTokenUsage: (u) => { usage = u; } });
    check('repairs a missing required field', r5.count === 5 && usage!.repaired === true, { r5, usage });
    check('repair call runs at temperature 0 and lists the problem', seen[seen.length - 1].temperature === 0 && /count/.test(seen[seen.length - 1].messages.slice(-1)[0].content));

    // Invalid JSON is retried
    script = [{ content: 'not json at all' }, { content: '{"count": 7, "items": []}' }];
    const r6 = await generateContent({ prompt: 'p', role: 'fast', schema: SCHEMA as any, systemKeys: keys });
    check('retries unparseable output', r6.count === 7);

    // ── Streaming, stall detection, hedging, reasoning switch, provider routing ──
    await streamingTests();

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((e) => { console.error(e); process.exit(1); });
