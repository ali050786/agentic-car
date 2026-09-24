/**
 * Offline test for the Canvas design agents inside the v2 pipelines:
 * Design Director + per-slide composer on create, fallbacks when the models
 * misbehave, and the design edits (redesign a slide, new look, fonts,
 * switching a deck to the Canvas, inserts, regenerate, undo).
 *
 *   npx tsx tests/v2/test-design-v2.ts
 */

import { runWithAgentContext } from '../../core/llm/agentGateway';
import { runCreatePipelineV2 } from '../../core/agents/v2/createPipeline';
import { runEditPipelineV2 } from '../../core/agents/v2/editPipeline';
import { memoryStore } from '../../core/agents/v2/persistence';
import { draftText, savedToDraft } from '../../core/agents/v2/slides';
import { slideTexts } from '../../core/agents/GatekeeperAgent';
import { isDesignRef } from '../../core/design/canvas/types';
import { designFor, styleOf } from '../../core/design/canvas';
import { slideToLayout } from '../../utils/slideMigration';
import { createMockLLM, MockOptions } from './mockLLM';
import { designDeckWithAI, refitDesigns } from '../../core/agents/v2/design';
import type { DraftSlide } from '../../core/agents/v2/types';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 600) : ''); }
};

const SOURCE = `Remote teams that write things down ship 23% faster, per the 2024 GitLab survey. "Default to asynchronous communication," said GitLab CEO Sid Sijbrandij. Meetings over 30 minutes lose half their attendees' attention. Written decisions travel across time zones; meetings do not. Teams that record decisions spend less time re-litigating them. Long enough to extract facts from.`;

const payload = (over: Record<string, unknown> = {}) => ({
    topic: 'Why async-first remote teams move faster',
    userMessage: 'Make a carousel on why async-first remote teams move faster',
    inputMode: 'text', sourceContent: SOURCE, slideCount: 7, selectedTemplate: 'template-5', presetId: 'ocean-tech', format: 'portrait',
    brandKit: { enabled: true, identity: { name: 'Ada', title: 'Founder', imageUrl: '' }, colors: {} },
    ...over,
}) as any;

const create = async (store: ReturnType<typeof memoryStore>, mockOpts: MockOptions = {}, over: Record<string, unknown> = {}, options: any = { skipImages: true }) => {
    const mock = createMockLLM(mockOpts);
    const out = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: mock.fn }, () =>
        runCreatePipelineV2({ jobId: 'job-d', userId: 'u1', payload: payload(over), store, progress: async () => undefined, options }));
    return { out, mock };
};

const edit = async (store: ReturnType<typeof memoryStore>, carouselId: string, message: string, mockOpts: MockOptions, selected?: number[]) => {
    const mock = createMockLLM(mockOpts);
    const res = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: mock.fn }, () => runEditPipelineV2({
        carouselId, userId: 'u1', message, selectedSlideIndices: selected, store, progress: async () => undefined, options: { skipImages: true },
    }));
    return { res, mock };
};

const archetypes = (slides: any[]) => slides.map((s) => (s.design as any)?.archetype);
const designKey = (s: any) => JSON.stringify(s.design || null);

const main = async () => {
    console.log('v2 Canvas design agents (offline)\n');

    // ── Create ────────────────────────────────────────────────────────────
    const store = memoryStore();
    const { out, mock } = await create(store);
    check('create finishes', out.kind === 'done', out);
    if (out.kind !== 'done') return;
    const slides = out.result.slides as any[];
    check('every slide has a design', slides.every((s) => s.design && typeof s.design === 'object'), slides.map((s) => !!s.design));
    check('composed slides stored as full trees', slides.every((s) => !isDesignRef(s.design) && s.design.composed && s.design.root));
    check('the Design Director picked the look (editorial / classic)', slides.every((s) => s.design.style.direction === 'editorial' && s.design.style.fonts === 'classic'), slides[0].design.style);
    const director = mock.calls.filter((c) => c.label === 'design.director');
    const composer = mock.calls.filter((c) => c.label === 'design.compose');
    check('one director call (planner role)', director.length === 1 && director[0].role === 'planner', director.map((c) => c.role));
    check('one composer call per slide (writer role)', composer.length === slides.length && composer.every((c) => c.role === 'writer'), composer.length);
    check('composer sees the art director\'s idea and the draft', composer.some((c) => c.prompt.includes('Idea for slide 1')) && composer.every((c) => /Idea for slide \d/.test(c.prompt) && c.prompt.includes('"type":"stack"')));
    check('composer prompt carries the palette-free role language', composer[0].prompt.includes('ROLE (colors come from the user\'s palette)'));
    const quoteIdx = slides.findIndex((s) => s.blockType === 'quote');
    check('the director\'s color moment lands on the quote (ink fill for an editorial deck)', quoteIdx >= 0 && slides[quoteIdx].design.invert === 'ink' && slides.filter((s) => s.design.invert).length === 1, slides.map((s) => s.design.invert));
    check('extras: the sticker is kept and shown', slides.every((s) => s.slots.extras?.tag === 'Worth knowing') && JSON.stringify(slides[0].design.root).includes('x.tag'));
    check('extras: invented numbers and emoji never reach the deck', !JSON.stringify(slides).includes('900%'));
    check('moderation sees design labels', slideTexts(slides).includes('Worth knowing'));
    check('stats report the design', out.stats.design?.direction === 'editorial' && out.stats.design?.composed === slides.length && out.stats.design?.source === 'model', out.stats.design);
    check('reply mentions the look', /editorial look/.test(out.reply), out.reply);
    const deck = await store.loadDeck(out.result.carouselId);
    check('stored deck keeps designs + Canvas template', deck.templateId === 'template-5' && deck.slides.every((s: any) => s.design));
    check('theme carries the Canvas marker', (deck.theme as any).designMode === 'canvas');
    const rendered = slides.map((s, i) => designFor(slideToLayout(s), i + 1));
    check('stored designs render back', rendered.every((d) => d.root && d.root.type === 'stack'));

    // ── Overlap: the look is planned from the outline, layouts from the draft ──
    check('director plans from the outline while the copy is written', /the copy is being written now/.test(director[0]?.prompt || ''));
    check('director call comes before the writer finishes (called right after the outline)', mock.calls.findIndex((c) => c.label === 'design.director') < mock.calls.findIndex((c) => c.label === 'critic'));

    const previews: any[] = [];
    // A little latency on the review, as in real runs, so the composed layouts land before the deck is final.
    const pv = await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: createMockLLM({ delays: { critic: 40, 'design.director': 5 } }).fn }, () =>
        runCreatePipelineV2({ jobId: 'job-pv', userId: 'u1', payload: payload(), store: memoryStore(), progress: async () => undefined, options: { skipImages: true }, preview: (x) => { previews.push(x); } }));
    const stages = previews.map((x) => x.stage);
    check('Canvas previews: draft first, then composed layouts', stages[0] === 'draft' && stages.includes('designed'), stages);
    check('draft preview uses library layouts in the director\'s look', previews[0]?.slides.every((s: any) => isDesignRef(s.design) && s.design.style.direction === 'editorial'), previews[0]?.slides.map((s: any) => s.design?.ref));
    const designed = previews.find((x) => x.stage === 'designed');
    check('designed preview carries composed trees + labels', !!designed && designed.slides.every((s: any) => !isDesignRef(s.design) && s.design.composed) && designed.slides.every((s: any) => s.slots.extras?.tag === 'Worth knowing'));
    check('final deck keeps the composed layouts', pv.kind === 'done' && (pv.result.slides as any[]).every((s) => !isDesignRef(s.design) && s.design.composed));

    // ── Refit: layouts composed on the draft are checked against the final words ──
    const base: DraftSlide[] = [
        { blockType: 'hero', headline: 'Async teams ship faster', body: 'Here is why writing wins.', preHeader: 'Remote work' },
        { blockType: 'body', headline: 'Meetings do not scale', body: 'Written decisions travel across time zones.' },
        { blockType: 'stat', headline: 'Writing pays off', statNumber: '23%', statLabel: 'faster shipping' },
        { blockType: 'closing', headline: 'Write it down first', footer: 'Follow for more' },
    ];
    const rMock = createMockLLM();
    await runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: rMock.fn }, async () => {
        const res = await designDeckWithAI({ drafts: base, topic: 'Async teams', theme: null, seed: 3 });
        const composeCalls = () => rMock.calls.filter((c) => c.label === 'design.compose').length;
        const n0 = composeCalls();
        const same = await refitDesigns({ drafts: base.map((d) => ({ ...d })), seen: base, result: res, theme: null, seed: 3 });
        check('refit: unchanged words keep every layout, no model call', same.recomposed === 0 && composeCalls() === n0 && same.designs.every((d, i) => d === res.designs[i]));
        const small = base.map((d) => ({ ...d }));
        small[1] = { ...small[1], body: 'Written decisions travel across every time zone.' };
        const smallFit = await refitDesigns({ drafts: small, seen: base, result: res, theme: null, seed: 3 });
        check('refit: a small wording change keeps the layout', smallFit.recomposed === 0 && smallFit.designs[1] === res.designs[1]);
        const kind = base.map((d) => ({ ...d }));
        kind[2] = { blockType: 'body', headline: 'Writing pays off', body: 'Teams that write things down ship faster.' };
        const kindFit = await refitDesigns({ drafts: kind, seen: base, result: res, theme: null, seed: 3 });
        check('refit: a slide that changed kind is composed again (only that one)', kindFit.recomposed === 1 && composeCalls() === n0 + 1 && kindFit.designs[2] !== res.designs[2] && kindFit.designs[0] === res.designs[0]);
        const numbered = base.map((d) => ({ ...d }));
        const withLabel = { ...res, extras: res.extras.map((e, i) => (i === 2 ? { tag: 'Up 23%' } : e)) };
        numbered[2] = { ...numbered[2], statNumber: '31%' };
        const labelFit = await refitDesigns({ drafts: numbered, seen: base, result: withLabel, theme: null, seed: 3 });
        check('refit: a label whose number left the slide forces a new layout', labelFit.recomposed === 1 && labelFit.extras[2]?.tag !== 'Up 23%');
        const grown = base.map((d) => ({ ...d }));
        grown[1] = { ...grown[1], body: 'Written decisions travel across time zones. '.repeat(20) };
        const grownFit = await refitDesigns({ drafts: grown, seen: base, result: res, theme: null, seed: 3 });
        check('refit: copy that would no longer fit is composed again', grownFit.recomposed >= 1);
    });

    // ── Model misbehaviour → library fallbacks ───────────────────────────
    const s2 = memoryStore();
    const bad = await create(s2, { composer: () => ({ nonsense: true }) });
    if (bad.out.kind === 'done') {
        const sl = bad.out.result.slides as any[];
        check('composer garbage → library layouts (stored as recipes)', sl.every((s) => isDesignRef(s.design)), sl.map((s) => s.design?.ref));
        check('fallbacks counted', bad.out.stats.design?.composed === 0 && bad.out.stats.design?.fallbacks === sl.length, bad.out.stats.design);
    } else check('garbage run finishes', false, bad.out);

    const huge = await create(memoryStore(), {
        composer: (_p, draft) => ({ ...draft, root: { type: 'stack', children: [{ type: 'text', field: 'headline', role: 'display', size: 3 }, { type: 'text', field: 'body', role: 'display', size: 3 }, { type: 'list', look: 'cards', size: 3 }] } }),
    });
    if (huge.out.kind === 'done') {
        check('compositions that would shrink text hard are rejected', (huge.out.stats.design?.fallbacks || 0) >= 3, huge.out.stats.design);
    }

    const dirFail = await create(memoryStore(), { designDirector: () => { throw new Error('boom'); } });
    if (dirFail.out.kind === 'done') {
        const sl = dirFail.out.result.slides as any[];
        check('director failure → heuristic look, deck still designed', sl.every((s) => s.design) && dirFail.out.stats.design?.source === 'library', dirFail.out.stats.design);
    }

    const offline = await create(memoryStore(), {}, {}, { skipImages: true, skipDesignModels: true });
    if (offline.out.kind === 'done') {
        check('design models can be switched off (library only)', !offline.mock.calls.some((c) => c.label.startsWith('design.')) && (offline.out.result.slides as any[]).every((s) => s.design));
    }
    const classic = await create(memoryStore(), {}, { selectedTemplate: 'template-1' });
    if (classic.out.kind === 'done') {
        check('classic templates never call the design agents', !classic.mock.calls.some((c) => c.label.startsWith('design.')) && !(classic.out.result.slides as any[]).some((s) => s.design));
    }
    const asked = await create(memoryStore(), { designDirector: () => ({ direction: 'corporate', fonts: 'modern', slides: [] }) }, { userMessage: 'Carousel on async teams, make it playful please' });
    if (asked.out.kind === 'done') {
        check('the user\'s own words about the look win over the model', (asked.out.result.slides as any[]).every((s) => s.design.style.direction === 'playful'), (asked.out.result.slides as any[])[0].design.style);
    }

    // ── Edits ─────────────────────────────────────────────────────────────
    const id = out.result.carouselId;
    const before = (await store.loadDeck(id)).slides as any[];

    const r1 = await edit(store, id, 'Redesign slide 2, make the point feel bigger', { editPlan: { actions: [{ type: 'redesign', slides: [2], instruction: 'make the point feel bigger' }], reply: 'Redesigning slide 2.' } });
    const after1 = (await store.loadDeck(id)).slides as any[];
    check('redesign changes only slide 2', JSON.stringify(r1.res.changedIndices) === '[1]', r1.res.changedIndices);
    check('redesign keeps every word', after1.every((s, i) => draftText(savedToDraft(s)).replace(/Worth knowing/g, '') === draftText(savedToDraft(before[i])).replace(/Worth knowing/g, '')));
    check('other slides keep their designs', after1.every((s, i) => i === 1 || designKey(s) === designKey(before[i])));
    const r1calls = r1.mock.calls.filter((c) => c.label === 'design.compose');
    check('only one slide recomposed, with the user\'s request', r1calls.length === 1 && r1calls[0].prompt.includes('make the point feel bigger'), r1calls.length);
    check('redesign is reported and undoable', r1.res.actions.includes('redesign') && r1.res.undoable, r1.res);

    const r2 = await edit(store, id, 'Make the whole deck playful', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_direction', value: 'playful' }] }], reply: 'Going playful.' } });
    const after2 = (await store.loadDeck(id)).slides as any[];
    check('new look: every slide restyled as playful', after2.every((s) => styleOf(s.design).direction === 'playful'), after2.map((s) => styleOf(s.design).direction));
    check('new look: every slide recomposed', r2.mock.calls.filter((c) => c.label === 'design.compose').length === after2.length);

    const archBefore = archetypes(after2);
    await edit(store, id, 'Use the editorial serif fonts', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_fonts', value: 'editorial' }] }], reply: 'Switching fonts.' } });
    const after3 = (await store.loadDeck(id)).slides as any[];
    check('fonts change the deck style, not the layouts', after3.every((s) => styleOf(s.design).fonts === 'editorial') && JSON.stringify(archetypes(after3)) === JSON.stringify(archBefore));

    const r4 = await edit(store, id, 'undo', {});
    const after4 = (await store.loadDeck(id)).slides as any[];
    check('undo restores the previous fonts', r4.res.intent === 'undo' && after4.every((s) => styleOf(s.design).fonts !== 'editorial'), after4.map((s) => styleOf(s.design).fonts));

    const r5 = await edit(store, id, 'Make slide 3 punchier', { editPlan: { actions: [{ type: 'copy', slides: [3], instruction: 'punchier' }], reply: 'Punchier.' } });
    const after5 = (await store.loadDeck(id)).slides as any[];
    check('copy edits keep the slide\'s design', designKey(after5[2]) === designKey(after4[2]) && r5.res.changedIndices.includes(2));

    await edit(store, id, 'Add a slide after 2 about time zones', { editPlan: { actions: [{ type: 'structure', insertAfter: 2, insertAbout: 'time zones' }], reply: 'Adding it.' } });
    const after6 = (await store.loadDeck(id)).slides as any[];
    check('an inserted slide is designed in the deck\'s look', after6.length === 8 && !!after6[2].design && styleOf(after6[2].design).direction === 'playful', after6[2]?.design?.style);

    const r7 = await edit(store, id, 'Rebuild it as 5 slides', { editPlan: { actions: [{ type: 'regenerate', targetSlideCount: 5 }], reply: 'Rebuilding.' } });
    const after7 = (await store.loadDeck(id)).slides as any[];
    check('regenerate designs the new slides and keeps the look', r7.res.actions.includes('regenerate') && after7.length === 5 && after7.every((s) => s.design && styleOf(s.design).direction === 'playful'), after7.map((s) => s.design && styleOf(s.design).direction));

    // Classic deck: redesign is Canvas-only; switching designs every slide.
    const cStore = memoryStore();
    const c1 = await create(cStore, {}, { selectedTemplate: 'template-1' });
    if (c1.out.kind !== 'done') return;
    const cid = c1.out.result.carouselId;
    const n1 = await edit(cStore, cid, 'Redesign slide 2', { editPlan: { actions: [{ type: 'redesign', slides: [2] }], reply: 'Sure.' } });
    check('redesign on a classic deck explains it needs the Canvas and changes nothing', /Canvas/.test(n1.res.reply) && !n1.res.slidesChanged, n1.res.reply);
    const n2 = await edit(cStore, cid, 'Switch to the canvas template', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_template', value: 'The Canvas' }] }], reply: 'Switching.' } });
    const cDeck = await cStore.loadDeck(cid);
    check('switching to the Canvas designs every slide', cDeck.templateId === 'template-5' && cDeck.slides.every((s: any) => s.design), n2.res.designActions);
    check('switching stamps the theme for storage', (cDeck.theme as any).designMode === 'canvas');
    check('the switch runs the director', n2.mock.calls.some((c) => c.label === 'design.director'));
    const n3 = await edit(cStore, cid, 'Switch back to the truth template', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_template', value: 'template-1' }] }], reply: 'Switching back.' } });
    const cDeck2 = await cStore.loadDeck(cid);
    check('switching away clears the marker (designs stay for later)', cDeck2.templateId === 'template-1' && !(cDeck2.theme as any).designMode && cDeck2.slides.every((s: any) => s.design), n3.res.designActions);

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
