/**
 * Accuracy guarantees of the v2 create pipeline (offline):
 * unit-aware numeric grounding, repeated lead numbers, mid-sentence bodies,
 * one fact per beat, the fact check, the cover written by the hook tournament,
 * and the cover fallback when the tournament fails.
 *
 *   npx tsx tests/v2/test-accuracy.ts
 */

import { runWithAgentContext } from '../../core/llm/agentGateway';
import { runCreatePipelineV2 } from '../../core/agents/v2/createPipeline';
import { memoryStore } from '../../core/agents/v2/persistence';
import { groundingIssues, numberPool, repeatedNumberIssues } from '../../core/agents/v2/grounding';
import { fixStructure, scrubFactIds, validateDeck } from '../../core/agents/v2/validate';
import { closeFragment, closeLabel, endsCleanly, hardFit, looksCut } from '../../core/agents/v2/limits';
import { isExplainer, planResearch } from '../../core/agents/v2/research';
import { clampDeck, tightenDeck } from '../../core/agents/v2/tighten';
import { enforceOutline } from '../../core/agents/v2/outline';
import { chunkRanges } from '../../core/agents/v2/writer';
import { createMockLLM, MockOptions } from './mockLLM';
import type { DraftSlide, Fact } from '../../core/agents/v2/types';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : ''); }
};

const SOURCE = `Remote teams that write things down ship 23% faster, per the 2024 GitLab survey. "Default to asynchronous communication," said GitLab CEO Sid Sijbrandij.
Meetings over 30 minutes lose half their attendees' attention. Written decisions travel across time zones; meetings do not. Teams that record decisions spend less time re-litigating them.
This material is long enough to trigger fact extraction from the source rather than web research.`;

const payload = (over: Record<string, unknown> = {}) => ({
    topic: 'Why async-first remote teams move faster',
    userMessage: 'Make a carousel on why async-first remote teams move faster',
    inputMode: 'text', sourceContent: SOURCE, customInstructions: '', outputLanguage: 'English', slideCount: 7,
    selectedModel: 'x', selectedTemplate: 'template-1', presetId: 'ocean-tech', brandMode: 'preset',
    brandKit: { enabled: false, identity: { name: '', title: '', imageUrl: '' }, colors: {} },
    signaturePosition: 'bottom-left', format: 'portrait', selectedPattern: 1, patternOpacity: 0.1,
    ...over,
}) as any;

const run = async (mockOpts: MockOptions = {}, p = payload()) => {
    const mock = createMockLLM(mockOpts);
    const out = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: mock.fn }, () =>
        runCreatePipelineV2({ jobId: 'job-acc', userId: 'u1', payload: p, store: memoryStore(), progress: async () => undefined, options: { skipImages: true } }));
    return { out, mock };
};

const d = (x: Partial<DraftSlide>): DraftSlide => ({ blockType: 'body', headline: '', ...x });

const main = async () => {
    console.log('v2 accuracy (offline)\n');

    // ── Unit-aware grounding ────────────────────────────────────────────────
    const facts: Fact[] = [
        { id: 'F1', text: 'Investors see over 1,000 decks a year and fund 1 in 100.', origin: 'research' },
        { id: 'F2', text: 'Revenue rose 35% compared with a year earlier.', origin: 'research' },
    ];
    const pool = numberPool(facts, '', '');
    const g = (text: string) => groundingIssues([d({ headline: text })], pool, true);
    check('"1%" is unsupported when the facts only say "1 in 100"', g('Only 1% of decks get funded').length === 1);
    check('"35%" is supported by "35%"', g('Revenue grew 35%').length === 0);
    check('"1,000" is supported', g('Investors see 1,000 decks').length === 0);
    check('"70%" is unsupported when no fact has it', g('70% of students sleep badly').length === 1);
    const pctPool = numberPool([{ id: 'F1', text: 'Sick days fell by 65 percent.', origin: 'source' }], '', '');
    check('"65%" is supported by "65 percent"', groundingIssues([d({ headline: 'Sick days fell 65%' })], pctPool, true).length === 0);

    // ── Repeated lead numbers ───────────────────────────────────────────────
    const rep = repeatedNumberIssues([
        d({ blockType: 'hero', headline: 'Revenue rose 35% over the prior year' }),
        d({ blockType: 'stat', headline: '57% drop in staff leaving', statNumber: '57%' }),
        d({ blockType: 'stat', headline: 'Revenue grew 35% year-on-year', statNumber: '35%' }),
        d({ body: 'That 35% came from fewer handoffs.', headline: 'Why it worked' }),
    ]);
    check('a second slide leading with 35% is flagged', rep.length === 1 && rep[0].index === 2 && rep[0].code === 'repeat_number', rep);
    check('a body that explains the number is not flagged', !rep.some((i) => i.index === 3));

    // ── Mid-sentence bodies ─────────────────────────────────────────────────
    const frag = 'An Airbnb interviewer credited daily practice and improved his conversion rate. He received nearly 15';
    check('endsCleanly spots a fragment', !endsCleanly(frag) && endsCleanly('Done.') && endsCleanly('He said "go."'));
    check('closeFragment keeps the whole sentences', closeFragment(frag) === 'An Airbnb interviewer credited daily practice and improved his conversion rate.', closeFragment(frag));
    check('closeFragment closes a lone fragment', closeFragment('Next time you read about a new') === 'Next time you read about a new.' || closeFragment('Next time you read about a new').endsWith('.'), closeFragment('Next time you read about a new'));
    const fIssues = validateDeck([d({ blockType: 'hero', headline: 'Cover', body: 'A fine sentence.' }), d({ headline: 'Two', body: frag })], 'template-1');
    check('validator flags the fragment body', fIssues.some((i) => i.code === 'fragment' && i.index === 1), fIssues);

    // Tighten must not accept a rewrite that fits by chopping the sentence off.
    const chop = createMockLLM();
    const longBody = 'Teams that write their decisions down spend far less time arguing about them later, because the record settles it. This is a second sentence that pushes the body over the limit for sure.';
    const deck = [d({ blockType: 'hero', headline: 'Cover', body: 'Short.' }), d({ headline: 'Write it down', body: longBody })];
    await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: async (req) => {
        if (req.label.startsWith('tighten')) return { fixes: [{ id: 1, text: 'Teams that write their decisions down spend far less time arguing about them later, because the' }] };
        return chop.fn(req);
    } }, () => tightenDeck(deck, 'template-1', [{ index: 1, field: 'body', code: 'over_limit', message: 'too long', severity: 'block' }], { banned: [], outputLanguage: 'English' }));
    check('a chopped rewrite is rejected', deck[1].body === longBody && endsCleanly(deck[1].body || ''), deck[1].body);

    const clampMe = [d({ blockType: 'hero', headline: 'Cover', body: 'Short.' }), d({ headline: 'Airbnb', body: 'It was a desperate, creative act that worked. Next time you are stuck' })];
    clampDeck(clampMe, 'template-1');
    check('the final clamp never ships a fragment', clampMe[1].body === 'It was a desperate, creative act that worked.', clampMe[1].body);

    // ── One fact per beat ───────────────────────────────────────────────────
    const beats = enforceOutline([
        { blockType: 'hero', keyMessage: 'cover', purpose: '', factIds: ['F2'] },
        { blockType: 'stat', keyMessage: 'revenue', purpose: '', factIds: ['F2'] },
        { blockType: 'stat', keyMessage: 'decks', purpose: '', factIds: ['F1', 'F1'] },
        { blockType: 'closing', keyMessage: 'end', purpose: '', factIds: [] },
    ], 4, 'template-1', facts);
    check('a fact used by the cover is not reused by a later beat', beats[1].factIds.length === 0 && beats[1].blockType === 'body', beats[1]);
    check('duplicate ids on one beat collapse', beats[2].factIds.length === 1 && beats[2].blockType === 'stat', beats[2]);

    // ── Cut-off labels, headlines and list items ────────────────────────────
    check('looksCut: ends on a connector or an open quote', ['Cost trade-offs: Spot vs. on-demand, serverless vs.', "Generic decks signal you haven't done your", 'Empieza hoy: horario fijo, sin pantallas, sin', 'Read "Attention Is All', 'THREE KINDS OF'].every(looksCut));
    check('looksCut: finished phrases pass', !['Plan A', 'Vitamin E', 'What if', 'Log in', 'Do less', 'Fundamentals, practice, mocks', 'Read "Attention Is All You Need"'].some(looksCut), ['Plan A', 'Vitamin E', 'What if', 'Log in', 'Do less'].filter(looksCut));
    const item = 'Cost trade-offs: Spot vs. on-demand, cache vs. recompute, serverless vs. provisioned capacity';
    check('last-resort cut keeps whole clauses', hardFit(item, 70, 'listItem') === 'Cost trade-offs: Spot vs. on-demand, cache vs. recompute', hardFit(item, 70, 'listItem'));
    check('last-resort cut never leaves a connector', !looksCut(hardFit("Generic decks signal you haven't done your homework on the fund", 44, 'headline')), hardFit("Generic decks signal you haven't done your homework on the fund", 44, 'headline'));
    check('last-resort cut never leaves an open quote', !looksCut(hardFit('Read "Attention Is All You Need" tonight', 22, 'footer')), hardFit('Read "Attention Is All You Need" tonight', 22, 'footer'));
    check('closeLabel repairs a cut label', closeLabel('Cost trade-offs: Spot vs. on-demand, cache vs. recompute, serverless vs.') === 'Cost trade-offs: Spot vs. on-demand, cache vs. recompute', closeLabel('Cost trade-offs: Spot vs. on-demand, cache vs. recompute, serverless vs.'));
    const cutIssues = validateDeck([d({ blockType: 'hero', headline: 'Cover', body: 'Fine.' }), d({ blockType: 'list', headline: 'Three areas', listItems: ['Cost: spot vs.', 'Failure: retries and timeouts', 'Ops: observability'] })], 'template-1');
    check('validator flags a cut list item', cutIssues.some((i) => i.code === 'fragment' && i.field === 'listItems[0]'), cutIssues);

    // Tighten asks for 3 options and keeps the longest that fits and reads complete.
    const opt = [d({ blockType: 'hero', headline: 'Cover', body: 'Short.' }), d({ headline: 'Generic decks signal you have not researched the fund at all', body: 'Fine.' })];
    let tightenPrompt = '';
    await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: async (req) => {
        tightenPrompt = req.prompt;
        return { fixes: [{ id: 1, options: ["Generic decks signal you haven't done your", 'Generic decks show you skipped research', 'Generic decks look lazy'] }] };
    } }, () => tightenDeck(opt, 'template-1', [{ index: 1, field: 'headline', code: 'over_limit', message: 'too long', severity: 'block' }], { banned: [], outputLanguage: 'English' }));
    check('tighten asks for 3 options', /3 options/.test(tightenPrompt));
    check('tighten keeps the longest complete option that fits', opt[1].headline === 'Generic decks show you skipped research', opt[1].headline);
    const clampLabels = [d({ blockType: 'hero', headline: 'Cover', body: 'Short.' }), d({ blockType: 'list', headline: 'Areas', listItems: ['Cost trade-offs: Spot vs. on-demand, cache vs. recompute, serverless vs.'], footer: 'Use data as a starting' })];
    clampDeck(clampLabels, 'template-1');
    check('final clamp repairs cut list items', clampLabels[1].listItems![0] === 'Cost trade-offs: Spot vs. on-demand, cache vs. recompute', clampLabels[1].listItems);

    // ── Explainers skip web research ────────────────────────────────────────
    check('explainers are recognised', ['Explain how rain forms, for 8 year olds', 'A 12 slide deep dive on how transformer models work', 'How does compound interest work'].every(isExplainer));
    check('data, how-to, opinion and story requests are not explainers', !['How to prepare for a system design interview in 2 weeks', 'What is the latest on GPT pricing in 2026', 'The story of how Airbnb survived by selling cereal', 'Is it true we only use 10% of our brains? Fact-check it'].some(isExplainer));
    const prevKey = process.env.TAVILY_API_KEY;
    process.env.TAVILY_API_KEY = 'test-key';
    const plan = await planResearch('A 12 slide deep dive on how transformer models work', '', { contentType: 'EDUCATIONAL', audience: { description: 'developers' } } as any);
    if (prevKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = prevKey;
    check('an explainer is not researched (no model call needed)', !plan.needsResearch && /Explainer/.test(plan.reason), plan);
    const explainer = await run({}, payload({ topic: 'A 7 slide deep dive on how transformer models work', userMessage: 'A 7 slide deep dive on how transformer models work', sourceContent: '' }));
    check('explainer outline is told to walk through the mechanism', /This is an explainer/.test(explainer.mock.calls.find((c) => c.label === 'outline')?.prompt || ''));

    // ── Leaked fact ids ─────────────────────────────────────────────────────
    const leak = d({ headline: 'Clarity wins', body: 'According to F12, clarity is the most important attribute of any deck (F3).', listItems: ['Speed: ships faster [F1]'] });
    scrubFactIds(leak);
    check('fact ids are scrubbed from copy', leak.body === 'Clarity is the most important attribute of any deck.' && leak.listItems![0] === 'Speed: ships faster', leak);
    const f1 = d({ headline: 'Formula F1 racing is fast', body: 'The F1 season starts in March.' });
    scrubFactIds(f1);
    check('a bare "F1" in normal prose is left alone', f1.body === 'The F1 season starts in March.', f1.body);
    const statLeak = fixStructure([d({ blockType: 'hero', headline: 'Cover' }), d({ blockType: 'stat', headline: 'Cost trade-offs matter', statNumber: 'F2', statLabel: 'sets you apart' }), d({ blockType: 'closing', headline: 'End' })], 'template-1');
    check('a stat slide whose number is a fact id becomes a plain slide', statLeak[1].blockType === 'body' && !statLeak[1].statNumber, statLeak[1]);

    // ── Writer groups ───────────────────────────────────────────────────────
    check('chunkRanges: 6 slides → 3 + 3', JSON.stringify(chunkRanges(1, 7, 3)) === '[[1,4],[4,7]]', chunkRanges(1, 7, 3));
    check('chunkRanges: 11 slides → 3,3,3,2', JSON.stringify(chunkRanges(1, 12, 3)) === '[[1,4],[4,7],[7,10],[10,12]]', chunkRanges(1, 12, 3));
    check('chunkRanges: 4 slides → 2 + 2', JSON.stringify(chunkRanges(1, 5, 3)) === '[[1,3],[3,5]]', chunkRanges(1, 5, 3));

    // ── Fact check in the pipeline ──────────────────────────────────────────
    const clean = await run();
    check('pipeline finishes', clean.out.kind === 'done', clean.out);
    const verifyCall = clean.mock.calls.find((c) => c.label === 'verify');
    check('fact check runs on a deck with facts, as the critic role', !!verifyCall && verifyCall.role === 'critic');
    check('fact check sees the facts and the slides', !!verifyCall && verifyCall.prompt.includes('[F1]') && /Slide 2 \[stat\]/.test(verifyCall.prompt));

    const flagged = await run({
        criticScore: 9,
        factCheck: [
            { index: 1, field: 'headline', claim: 'Ship 23% faster by writing things down', verdict: 'distorted', why: 'the survey result is presented as a promise', fix: 'Say remote teams that write things down shipped 23% faster in the 2024 GitLab survey' },
            { index: 99, field: 'body', claim: 'out of range', verdict: 'unsupported', fix: 'x' },
        ],
    });
    check('flagged deck finishes', flagged.out.kind === 'done', flagged.out);
    const revise = flagged.mock.calls.find((c) => c.label === 'critic.revise');
    check('a fact-check finding forces a revision even when the critic is happy', !!revise);
    check('the revision is told what the fact check found', !!revise && /FACT CHECK: "Ship 23% faster/.test(revise.prompt));
    check('a flagged cover may be rewritten', flagged.out.kind === 'done' && flagged.out.result.slides[0].headline === 'Revised slide 1 with a concrete example', flagged.out.kind === 'done' ? flagged.out.result.slides[0].headline : '');
    check('an unflagged cover keeps the tournament hook', clean.out.kind === 'done' && clean.out.result.slides[0].headline === 'Ship 23% faster by writing things down');

    const noisy = await run({ factCheck: Array.from({ length: 9 }, (_, k) => ({ index: 2 + (k % 5), field: 'body', claim: `claim ${k}`, verdict: 'distorted', fix: 'reword it' })) });
    const noisyRevise = noisy.mock.calls.find((c) => c.label === 'critic.revise')?.prompt || '';
    check('a long fact-check list is capped at 4 findings', (noisyRevise.match(/FACT CHECK:/g) || []).length === 4, (noisyRevise.match(/FACT CHECK:/g) || []).length);
    check('fact-check prompt tells it not to nitpick', /never report these/.test(clean.mock.calls.find((c) => c.label === 'verify')?.prompt || ''));

    process.env.WRITER_CHUNK = '3';
    const chunked = await run({}, payload({ slideCount: 12 }));
    delete process.env.WRITER_CHUNK;
    check('WRITER_CHUNK=3 splits into groups of 3', chunked.mock.calls.filter((c) => c.label.startsWith('writer.')).length === 4, chunked.mock.calls.filter((c) => c.label.startsWith('writer.')).map((c) => c.label));
    check('default: two halves after the cover', ['writer.2-4', 'writer.5-7'].every((l) => clean.mock.calls.some((c) => c.label === l)), clean.mock.calls.filter((c) => c.label.startsWith('writer.')).map((c) => c.label));

    process.env.FACT_CHECK = 'off';
    const off = await run();
    delete process.env.FACT_CHECK;
    check('FACT_CHECK=off skips the call', !off.mock.calls.some((c) => c.label === 'verify'));

    // ── Cover written by the hook tournament; fallback when it fails ───────
    check('no writer call writes slide 1 when the tournament runs', !clean.mock.calls.some((c) => /^writer\.1-/.test(c.label)));
    const noHook = await run({ hookFail: true });
    check('tournament failure: the deck still finishes', noHook.out.kind === 'done', noHook.out);
    check('tournament failure: the writer writes the cover afterwards', noHook.mock.calls.some((c) => c.label === 'writer.1-1'), noHook.mock.calls.map((c) => c.label));
    check('tournament failure: the cover is real copy, not the outline placeholder', noHook.out.kind === 'done' && noHook.out.result.slides[0].headline === 'Slide 1 makes one clear point', noHook.out.kind === 'done' ? noHook.out.result.slides[0].headline : '');

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((err) => { console.error(err); process.exit(1); });
