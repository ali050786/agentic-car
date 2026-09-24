/**
 * Offline test for the v2 create pipeline: scripted (misbehaving) model,
 * in-memory store. Proves the code-level guarantees: exact slide count, limits,
 * banned words, emoji, grounding, rich blocks survive, hook tournament math,
 * refusal paths, and that every call carries the right model role.
 *
 *   npx tsx tests/v2/test-create-v2.ts
 */

import { runWithAgentContext } from '../../core/llm/agentGateway';
import { runCreatePipelineV2 } from '../../core/agents/v2/createPipeline';
import { memoryStore } from '../../core/agents/v2/persistence';
import { validateDeck } from '../../core/agents/v2/validate';
import { hardFit } from '../../core/agents/v2/limits';
import { savedToDraft } from '../../core/agents/v2/slides';
import { slideToLayout } from '../../utils/slideMigration';
import { createMockLLM, MockOptions } from './mockLLM';
import type { CreateJobPayload } from '../../core/agents/CarouselPlanner';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : ''); }
};

const SOURCE = `Remote teams that write things down ship 23% faster, per the 2024 GitLab survey. "Default to asynchronous communication," said GitLab CEO Sid Sijbrandij.
Meetings over 30 minutes lose half their attendees' attention. Written decisions travel across time zones; meetings do not. Teams that record decisions spend less time re-litigating them.
This material is long enough to trigger fact extraction from the source rather than web research.`;

const payload = (over: Partial<CreateJobPayload> = {}): CreateJobPayload => ({
    topic: 'Why async-first remote teams move faster',
    userMessage: 'Make a carousel on why async-first remote teams move faster',
    inputMode: 'text',
    sourceContent: SOURCE,
    customInstructions: '',
    outputLanguage: 'English',
    slideCount: 7,
    selectedModel: 'x',
    selectedTemplate: 'template-1',
    presetId: 'ocean-tech',
    brandMode: 'preset' as any,
    brandKit: { enabled: false, identity: { name: '', title: '', imageUrl: '' }, colors: {} } as any,
    signaturePosition: 'bottom-left' as any,
    format: 'portrait',
    selectedPattern: 1,
    patternOpacity: 0.1,
    ...over,
});

const run = async (mockOpts: MockOptions = {}, p = payload(), options: any = { skipImages: true }) => {
    const mock = createMockLLM(mockOpts);
    const store = memoryStore({ memory: { brandRules: [], bannedWords: ['Never use "synergy"', 'No emojis'], tonePrefs: ['Direct'], pastDecisions: [] } });
    const progress: string[] = [];
    const tokenTracker = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };
    const out = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', tokenTracker, mockLLM: mock.fn }, () =>
        runCreatePipelineV2({ jobId: 'job-1', userId: 'u1', payload: p, store, progress: async (m) => { progress.push(m); }, options }),
    );
    return { out, mock, store, progress };
};

const main = async () => {
    console.log('v2 create pipeline (offline)\n');

    // ── Happy path ──────────────────────────────────────────────────────────
    const { out, mock, store, progress } = await run();
    check('pipeline finishes', out.kind === 'done', out);
    if (out.kind !== 'done') return;
    const slides = out.result.slides;
    const drafts = slides.map(savedToDraft);

    check('exact slide count (outline over-produced by one)', slides.length === 7, slides.length);
    check('hero first, closing last', slides[0].blockType === 'hero' && slides[6].blockType === 'closing', slides.map((s) => s.blockType));
    check('hook tournament winner by summed score, not judge "winner"', slides[0].headline === 'Ship 23% faster by writing things down', slides[0].headline);
    check('hook accent is inside headline', !!slides[0].accentPhrase && slides[0].headline.includes(slides[0].accentPhrase!), slides[0].accentPhrase);

    const lim = validateDeck(drafts, 'template-1', { banned: ['synergy'] });
    check('no field over its limit', !lim.some((i) => i.code === 'over_limit'), lim.filter((i) => i.code === 'over_limit'));
    check('banned term removed everywhere', !JSON.stringify(slides).toLowerCase().includes('synergy'));
    check('emoji stripped', !/\p{Extended_Pictographic}/u.test(JSON.stringify(slides)));
    check('every accentPhrase is a substring of its headline', slides.every((s) => !s.accentPhrase || s.headline.includes(s.accentPhrase)), slides.map((s) => [s.headline, s.accentPhrase]));

    check('grounded stat kept as a stat block', slides[1].blockType === 'stat' && slides[1].slots?.statNumber === '23%', slides[1]);
    check('stat survives the IR reader (slideToLayout)', slideToLayout(slides[1] as any).blockType === 'stat' && slideToLayout(slides[1] as any).slots.statNumber === '23%');
    check('quote with a real speaker kept as quote block', slides[2].blockType === 'quote' && !!slides[2].slots?.quoteAuthor, slides[2]);
    check('list trimmed to the template max (3)', slides[3].blockType === 'list' && slides[3].listItems!.length === 3, slides[3].listItems);
    check('split block kept', slides[5].blockType === 'split' && !!slides[5].slots?.splitLeft, slides[5]);
    check('invented "87%" gone after reflect', !JSON.stringify(slides).includes('87%'));
    check('invented "64%" stat not shipped as a stat', !slides.some((s) => s.blockType === 'stat' && s.slots?.statNumber === '64%'));
    check('slide 5 revised by the critic loop', out.stats.revisedSlides.includes(5), out.stats.revisedSlides);
    check('proofread fixed "Teh"', !JSON.stringify(slides).includes('Teh '));
    check('proofread rejected the rewrite-style "correction"', !slides[0].body?.startsWith('A completely different sentence'));
    check('preHeaders uppercased for renderers', slides.every((s) => !s.preHeader || s.preHeader === s.preHeader.toUpperCase()));

    check('facts extracted from source', out.result.facts.length === 3, out.result.facts);
    check('outline dropped unknown fact id F99', !out.result.outline.beats.some((b) => b.factIds.includes('F99')));

    const saved = store.decks.get(out.result.carouselId);
    check('carousel saved once', store.decks.size === 1 && !!saved);
    check('thread has user + assistant turn', (store.threads.get(out.result.carouselId) || []).length === 2);
    const brief = store.briefs.get(out.result.carouselId);
    check('brief saved with facts, takeaway and pipeline tag', !!brief && brief.pipeline === 'v2' && !!brief.takeaway && (brief.facts || []).length === 3, brief);
    check('brief fits the 8000-char attribute', JSON.stringify(brief).length <= 8000);
    check('reply mentions the hook tournament', /cover hooks/.test(out.reply), out.reply);
    check('reply has no em dash', !out.reply.includes('—'), out.reply);

    const roleOf = (label: string) => mock.calls.find((c) => c.label === label)?.role;
    check('outline uses planner role', roleOf('outline') === 'planner');
    check('hooks written and scored in one creative call', roleOf('hooks.generate') === 'creative' && !mock.calls.some((c) => c.label === 'hooks.judge'));
    check('writer uses writer role', mock.calls.some((c) => c.label.startsWith('writer.') && c.role === 'writer'));
    check('critic uses critic role', roleOf('critic') === 'critic');
    check('tighten + proofread use fast role', roleOf('tighten') === 'fast' && roleOf('proofread') === 'fast');
    check('writer prompt carries the facts', mock.calls.find((c) => c.label.startsWith('writer.'))!.prompt.includes('[F1]'));
    check('writer prompt carries limits', /statNumber ≤ 10/.test(mock.calls.find((c) => c.label === 'writer.2-4')!.prompt));
    check('writer leaves the cover to the hook tournament', !mock.calls.some((c) => /^writer\.1-/.test(c.label)), mock.calls.filter((c) => c.label.startsWith('writer.')).map((c) => c.label));
    check('memory reaches the writer', mock.calls.find((c) => c.label.startsWith('writer.'))!.prompt.includes('Tone preference: Direct'));
    check('progress uses PLAN/EXECUTE/REFLECT prefixes', ['PLAN:', 'EXECUTE:', 'REFLECT:'].every((p) => progress.some((m) => m.startsWith(p))), progress);
    check('progress is monotonic-ish (last step is saving)', progress[progress.length - 1].startsWith('Saving'), progress.slice(-2));

    // ── Skipped slide is re-requested ───────────────────────────────────────
    const skipped = await run({ skipSlide: 4 });
    check('writer retry fills a skipped slide', skipped.out.kind === 'done' && skipped.out.result.slides[3].blockType === 'list', skipped.out.kind === 'done' ? skipped.out.result.slides[3] : skipped.out);
    check('retry call happened (two groups + one retry)', skipped.mock.calls.filter((c) => c.label.startsWith('writer.')).length === 3, skipped.mock.calls.filter((c) => c.label.startsWith('writer.')).map((c) => c.label));
    check('7-slide deck written as two groups of 3 (cover from the hooks)', ['writer.2-4', 'writer.5-7'].every((l) => mock.calls.some((c) => c.label === l)), mock.calls.filter((c) => c.label.startsWith('writer.')).map((c) => c.label));
    check('groups know the others are written in parallel', /written at the same time/.test(mock.calls.find((c) => c.label === 'writer.5-7')?.prompt || ''));

    // ── Last-resort fitting never leaves a sentence hanging ─────────────────
    const body = "Airbnb's cereal hustle wasn't a business strategy. It was a desperate, creative act that worked. Next time you're stuck, try something absurd.";
    const fit1 = hardFit(body, 100, 'body');
    check('fit keeps whole sentences', fit1 === "Airbnb's cereal hustle wasn't a business strategy. It was a desperate, creative act that worked.", fit1);
    const long1 = 'The $30,000 gave Airbnb financial runway until early 2009, when the founders finally got into Y Combinator and found investors.';
    const fit2 = hardFit(long1, 80, 'body');
    check('fit ends at a clause with a period when one sentence is too long', fit2 === 'The $30,000 gave Airbnb financial runway until early 2009.', fit2);
    const fit3 = hardFit('Supercalifragilistic expialidocious words keep going without any commas or breaks at all here', 40, 'body');
    check('fit marks a forced word cut with an ellipsis', fit3.endsWith('…') && fit3.length <= 40, fit3);
    check('labels are still cut at a word, no ellipsis', hardFit('Three async habits for remote teams that ship', 30, 'headline') === 'Three async habits for remote', hardFit('Three async habits for remote teams that ship', 30, 'headline'));
    check('no shipped body ends mid-sentence', slides.every((sl) => !sl.body || /[.!?…"”')\]]$/.test(sl.body.trim())), slides.map((sl) => sl.body?.slice(-30)));

    // ── Separate hook judge (HOOK_JUDGE=separate) still sums scores itself ───
    process.env.HOOK_JUDGE = 'separate';
    const judged = await run();
    delete process.env.HOOK_JUDGE;
    check('separate judge path: critic judges, code picks by sum', judged.out.kind === 'done' && judged.mock.calls.some((c) => c.label === 'hooks.judge' && c.role === 'critic') && judged.out.result.slides[0].headline === 'Ship 23% faster by writing things down');

    // ── Large deck is written in parallel groups ─────────────────────────────────
    const big = await run({}, payload({ slideCount: 12 }));
    check('12-slide deck exact count', big.out.kind === 'done' && big.out.result.slides.length === 12);
    check('12-slide deck written in two halves after the cover', ['writer.2-7', 'writer.8-12'].every((l) => big.mock.calls.some((c) => c.label === l)) && big.mock.calls.filter((c) => c.label.startsWith('writer.')).length === 2, big.mock.calls.filter((c) => c.label.startsWith('writer.')).map((c) => c.label));

    // ── Template without split degrades split beats ─────────────────────────
    const t3 = await run({}, payload({ selectedTemplate: 'template-3' }));
    check('template-3 never gets a split block', t3.out.kind === 'done' && !t3.out.result.slides.some((s) => s.blockType === 'split'));

    // ── Refusals save nothing ───────────────────────────────────────────────
    const refused = await run({ refuse: true }, payload(), { skipImages: true });
    check('input gate refusal', refused.out.kind === 'refused' && refused.out.stage === 'input');
    check('refused request writes nothing', refused.store.decks.size === 0);
    check('refused request stops before outlining', !refused.mock.calls.some((c) => c.label === 'outline'));

    const flagged = await run({ flagOutput: true });
    const flaggedAtReturn = flagged.mock.calls.map((c) => c.label);
    await new Promise((r) => setTimeout(r, 50));
    const flaggedLater = flagged.mock.calls.map((c) => c.label);
    check('output moderation refusal', flagged.out.kind === 'refused' && flagged.out.stage === 'output');
    check('flagged deck is never saved (no create-then-delete)', flagged.store.decks.size === 0);

    // ── Good deck stops the loop early ──────────────────────────────────────
    const good = await run({ criticScore: 9 }, payload({ sourceContent: SOURCE.replace('87%', '') }));
    const criticCalls = good.mock.calls.filter((c) => c.label === 'critic').length;
    check('good deck: one critic pass', criticCalls === 1, criticCalls);
    const twoPass = await run({}, payload(), { skipImages: true, maxReflectPasses: 2 });
    check('maxReflectPasses=2 still bounded', twoPass.mock.calls.filter((c) => c.label === 'critic').length <= 2);
    check('default is one critic pass', mock.calls.filter((c) => c.label === 'critic').length === 1, mock.calls.filter((c) => c.label === 'critic').length);

    // ── Early moderation, preview, refusal ──────────────────────────────────
    const order = (calls: { label: string }[], label: string) => calls.findIndex((c) => c.label === label);
    check('draft moderated before the editor review', order(mock.calls, 'gatekeeper.moderate') >= 0 && order(mock.calls, 'gatekeeper.moderate') < order(mock.calls, 'critic.revise'));
    check('flagged draft refused before any revision is written', flagged.out.kind === 'refused' && !flaggedAtReturn.includes('critic.revise'), flaggedAtReturn);
    check('work in flight stops after a refusal', !flaggedLater.includes('critic.revise') && flaggedLater.length === flaggedAtReturn.length, flaggedLater.slice(flaggedAtReturn.length));

    const previews: any[] = [];
    const withPreview = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: createMockLLM().fn }, () =>
        runCreatePipelineV2({ jobId: 'job-p', userId: 'u1', payload: payload(), store: memoryStore(), progress: async () => undefined, options: { skipImages: true }, preview: (pv) => { previews.push(pv); } }));
    check('draft preview emitted', previews.length === 1 && previews[0].stage === 'draft' && previews[0].slides.length === 7, previews.map((x) => x.stage));
    check('preview carries theme + template', !!previews[0]?.theme && previews[0]?.templateId === 'template-1');
    check('preview slides are the saved shape (slots, blockType)', !!previews[0]?.slides?.[1]?.slots && previews[0].slides[1].blockType === 'stat');
    check('final deck differs from the draft only where the editor revised', withPreview.kind === 'done' && withPreview.result.slides[4].headline !== previews[0].slides[4].headline && withPreview.result.slides[5].headline === previews[0].slides[5].headline.replace('Teh', 'The'));
    check('stat slide repeating the cover\'s number is revised', withPreview.kind === 'done' && withPreview.result.slides[1].headline !== previews[0].slides[1].headline);

    const flaggedPreviews: any[] = [];
    await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: createMockLLM({ flagOutput: true }).fn }, () =>
        runCreatePipelineV2({ jobId: 'job-f', userId: 'u1', payload: payload(), store: memoryStore(), progress: async () => undefined, options: { skipImages: true }, preview: (pv) => { flaggedPreviews.push(pv); } }));
    check('no preview for a flagged draft', flaggedPreviews.length === 0);

    // ── Creative Director in the worker ─────────────────────────────────────
    const noBrief = { ...payload({ userMessage: 'Make 5 slides on why async-first remote teams move faster', briefInWorker: true }), creativeBrief: undefined };
    const cd = await run({}, noBrief);
    check('worker writes the brief when the client sent none', cd.mock.calls.some((c) => c.label === 'creativeDirector.answers' && c.role === 'planner'));
    check('brief is written alongside the gate (before the outline)', order(cd.mock.calls, 'creativeDirector.answers') < order(cd.mock.calls, 'outline'));
    check('"5 slides" in the request wins over the brief estimate (6)', cd.out.kind === 'done' && cd.out.result.slides.length === 5, cd.out.kind === 'done' ? cd.out.result.slides.length : cd.out);
    check('brief from the worker reaches the writer', /remote team leads/.test(cd.mock.calls.find((c) => c.label.startsWith('writer.'))?.prompt || ''));
    const many = await run({}, { ...noBrief, userMessage: 'Make 30 slides on async-first teams' });
    check('out-of-range count clamped with a note', many.out.kind === 'done' && many.out.result.slides.length === 20 && /maximum is 20/i.test(many.out.reply), many.out.kind === 'done' ? many.out.reply : many.out);
    const withBrief = await run();
    check('no worker brief when the client sent one', !withBrief.mock.calls.some((c) => c.label.startsWith('creativeDirector')));

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
