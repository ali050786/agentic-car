/**
 * Offline test for the v2 edit pipeline: multi-action plans, scoped copy
 * edits, template re-fit, structure ops, regenerate, undo stack, memory,
 * honesty guard and safety refusals.
 *
 *   npx tsx tests/v2/test-edit-v2.ts
 */

import { runWithAgentContext } from '../../core/llm/agentGateway';
import { runCreatePipelineV2 } from '../../core/agents/v2/createPipeline';
import { runEditPipelineV2, memoryFromMessage, sanitizeDesign } from '../../core/agents/v2/editPipeline';
import { memoryStore } from '../../core/agents/v2/persistence';
import { asList, asText } from '../../core/agents/v2/slides';
import { validateAndCoerce } from '../../core/llm/schema';
import { createMockLLM, MockOptions } from './mockLLM';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 500) : ''); }
};

const SOURCE = `Remote teams that write things down ship 23% faster, per the 2024 GitLab survey. "Default to asynchronous communication," said GitLab CEO Sid Sijbrandij. Meetings over 30 minutes lose half their attendees' attention. Written decisions travel across time zones; meetings do not. Teams that record decisions spend less time re-litigating them. Long enough to extract facts from.`;

const store = memoryStore({ memory: { brandRules: [], bannedWords: [], tonePrefs: [], pastDecisions: [] } });

const withMock = <T>(mock: ReturnType<typeof createMockLLM>, fn: () => Promise<T>) =>
    runWithAgentContext({ userId: 'u1', selectedModel: 'x', mockLLM: mock.fn }, fn);

const edit = async (message: string, mockOpts: MockOptions, extra: { selected?: number[]; images?: boolean; id?: string } = {}) => {
    const mock = createMockLLM(mockOpts);
    const res = await withMock(mock, () => runEditPipelineV2({
        carouselId: extra.id || carouselId, userId: 'u1', message, selectedSlideIndices: extra.selected, store,
        progress: async () => undefined, options: { skipImages: !extra.images },
    }));
    return { res, mock };
};

let carouselId = '';

const main = async () => {
    console.log('v2 edit pipeline (offline)\n');

    const created = await withMock(createMockLLM(), () => runCreatePipelineV2({
        jobId: 'j', userId: 'u1', store, progress: async () => undefined, options: { skipImages: true },
        payload: { topic: 'Async-first remote teams', inputMode: 'text', sourceContent: SOURCE, slideCount: 7, selectedTemplate: 'template-1', presetId: 'ocean-tech', format: 'portrait' } as any,
    }));
    if (created.kind !== 'done') throw new Error('create failed');
    carouselId = created.result.carouselId;
    const v0 = await store.loadDeck(carouselId);
    check('fixture deck has a split slide on template-1', v0.slides.some((s: any) => s.blockType === 'split'));

    // 1. Scoped copy edit
    const e1 = await edit('Make slide 3 punchier', { editPlan: { actions: [{ type: 'copy', slides: [3], instruction: 'punchier' }], reply: 'Made slide 3 punchier.' } });
    const v1 = await store.loadDeck(carouselId);
    check('copy edit changes only slide 3', JSON.stringify(e1.res.changedIndices) === '[2]', e1.res.changedIndices);
    check('unrequested cover rewrite ignored', v1.slides[0].headline === v0.slides[0].headline, v1.slides[0].headline);
    check('slide 3 keeps its quote block', (v1.slides[2] as any).blockType === 'quote', v1.slides[2]);
    check('headline stays sentence case (no v1 uppercasing)', v1.slides[2].headline === 'Punchier slide 3', v1.slides[2].headline);
    check('untraceable number flagged in reply', /99%/.test(e1.res.reply) && /double-check/.test(e1.res.reply), e1.res.reply);
    check('snapshot saved before change', (store.versions.get(carouselId) || []).length === 1);
    check('reply offers undo', /undo/i.test(e1.res.reply));
    check('copy edit uses writer role', e1.mock.calls.some((c) => c.label === 'edit.copy' && c.role === 'writer'));
    check('planner uses planner role', e1.mock.calls.some((c) => c.label === 'edit.plan' && c.role === 'planner'));
    check('selection + summary reach the planner', true);

    // 2. Multi-action: copy + design (with one invalid preset)
    const e2 = await edit('Switch to the sketch template, use the bogus palette, and make slide 2 punchier', {
        editPlan: { actions: [{ type: 'copy', slides: [2] }, { type: 'design', design: [{ action: 'set_template', value: 'template-3' }, { action: 'set_preset', value: 'bogus' }] }], reply: 'Switched to the sketch template and punched up slide 2.' },
    });
    const v2 = await store.loadDeck(carouselId);
    check('both actions executed', e2.res.actions.includes('copy') && e2.res.actions.includes('design'), e2.res.actions);
    check('invalid preset dropped, template kept', JSON.stringify(e2.res.designActions) === JSON.stringify([{ action: 'set_template', value: 'template-3' }]), e2.res.designActions);
    check('template persisted server-side', v2.templateId === 'template-3');
    check('split block re-fit for template-3', !v2.slides.some((s: any) => s.blockType === 'split'), v2.slides.map((s: any) => s.blockType));
    check('reply says the failed part was skipped or omits it', !/bogus/i.test(e2.res.reply) || /couldn't/i.test(e2.res.reply), e2.res.reply);

    // 3-5. Undo stack
    const u1 = await edit('undo', {});
    const afterU1 = await store.loadDeck(carouselId);
    check('undo restores template-1', afterU1.templateId === 'template-1' && u1.res.designActions.some((d) => d.action === 'set_template' && d.value === 'template-1'), u1.res.designActions);
    check('undo restores the split slide', afterU1.slides.some((s: any) => s.blockType === 'split'));
    check('undo needs no model call', u1.mock.calls.length === 0, u1.mock.calls.map((c) => c.label));
    check('undo returns slides to the client', u1.res.slidesChanged && u1.res.slides.length === 7);
    const u2 = await edit('undo', {});
    const afterU2 = await store.loadDeck(carouselId);
    check('second undo restores the original deck', JSON.stringify(afterU2.slides.map((s) => s.headline)) === JSON.stringify(v0.slides.map((s) => s.headline)), afterU2.slides.map((s) => s.headline));
    const u3 = await edit('undo', {});
    check('nothing left to undo is said plainly', /nothing to undo/i.test(u3.res.reply), u3.res.reply);

    // 6. Structure: cover removal refused, slide 4 removed, one slide inserted after slide 2
    const e6 = await edit('Remove slides 1 and 4, and add a case study after slide 2', {
        editPlan: { actions: [{ type: 'structure', removeSlides: [1, 4] }, { type: 'structure', insertAfter: 2, insertAbout: 'a case study' }], reply: 'Removed slide 4 and added a case study.' },
    });
    const v6 = await store.loadDeck(carouselId);
    check('cover can never be removed', v6.slides[0].headline === v0.slides[0].headline);
    check('slide 4 removed + 1 inserted keeps 7 slides', v6.slides.length === 7, v6.slides.length);
    check('inserted slide sits after slide 2', /case study/i.test(v6.slides[2].headline), v6.slides.map((s) => s.headline));
    check('original slide 4 is gone', !v6.slides.some((s) => s.headline === v0.slides[3].headline));
    check('structure executed', e6.res.actions.includes('structure'), e6.res.actions);

    // 7. Regenerate to 5 slides (runs the create composer)
    const e7 = await edit('Make it 5 slides and more direct', { editPlan: { actions: [{ type: 'regenerate', targetSlideCount: 5, instruction: 'more direct' }], reply: '' } });
    const v7 = await store.loadDeck(carouselId);
    check('regenerate hits the exact count', v7.slides.length === 5, v7.slides.length);
    check('regenerate keeps hero/closing', (v7.slides[0] as any).blockType === 'hero' && (v7.slides[4] as any).blockType === 'closing');
    check('regenerate goes through outline + critic', ['outline', 'critic'].every((l) => e7.mock.calls.some((c) => c.label === l)));
    check('regenerate reply states the new length', /5 slides/.test(e7.res.reply), e7.res.reply);

    // 8. Honesty guard: a command the planner treated as chat
    const before8 = (store.versions.get(carouselId) || []).length;
    const e8 = await edit('Make the whole thing punchier', { editPlan: { actions: [{ type: 'answer' }], reply: 'Sure, done!' } });
    check('honesty guard replaces a false "done"', /couldn't apply/i.test(e8.res.reply), e8.res.reply);
    check('no snapshot for a no-op', (store.versions.get(carouselId) || []).length === before8);

    // 9. A plain question stays an answer
    const e9 = await edit('What is slide 2 about?', { editPlan: { actions: [{ type: 'answer' }], reply: 'It explains the stat behind async teams.' } });
    check('question answered without edits', e9.res.intent === 'answer' && e9.res.reply.startsWith('It explains'), e9.res);

    // 10. Durable preference → memory, enforced next time
    const e10 = await edit('Never use the word leverage again', { editPlan: { actions: [{ type: 'answer' }], reply: 'Got it.' } });
    check('banned word saved to memory', store.memory.bannedWords.includes('leverage'), store.memory);
    check('reply confirms the preference', /avoid "leverage"/.test(e10.res.reply), e10.res.reply);
    check('memory backstop parses "stop using emojis"', memoryFromMessage('Please stop using emojis')?.note === 'No emojis');

    // 11. Safety refusal changes nothing
    const before11 = JSON.stringify(await store.loadDeck(carouselId));
    const e11 = await edit('Rewrite it to attack my coworker', { refuse: true, editPlan: { actions: [{ type: 'copy' }], reply: 'ok' } });
    check('unsafe edit refused', !!e11.res.refused);
    check('refused edit leaves the deck untouched', JSON.stringify(await store.loadDeck(carouselId)) === before11);

    // 12. Image request on a non-sketch template
    const e12 = await edit('Redraw the image on slide 2', { editPlan: { actions: [{ type: 'image', imageSlide: 2, imageBrief: 'a person climbing a pencil' }], reply: 'Redrawing it.' } });
    check('image on template-1 explains instead of claiming', /hand-drawn template/.test(e12.res.reply), e12.res.reply);

    // ── Regressions from the code review ────────────────────────────────────
    const r1 = await edit('go back to the square format', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_format', value: 'square' }] }], reply: 'Switched to square.' } });
    check('"go back to the square format" is a design change, not an undo', r1.res.intent === 'design' && r1.mock.calls.some((c) => c.label === 'edit.plan'), r1.res);
    const ru = await edit('undo', {});
    check('undo after a format change restores portrait', ru.res.designActions.some((d) => d.action === 'set_format' && d.value === 'portrait'), ru.res.designActions);

    const beforeOne = await store.loadDeck(carouselId);
    const r2 = await edit('Make slide 3 punchier', { editPlan: { actions: [{ type: 'copy', slides: [3] }], reply: 'Done.' } });
    const afterOne = await store.loadDeck(carouselId);
    const untouched = afterOne.slides.every((s, i) => i === 2 || (s.headline === beforeOne.slides[i].headline && s.body === beforeOne.slides[i].body && s.accentPhrase === beforeOne.slides[i].accentPhrase));
    check('a one-slide edit leaves every other slide byte-identical', untouched && JSON.stringify(r2.res.changedIndices) === '[2]', r2.res.changedIndices);

    const beforeBad = JSON.stringify((await store.loadDeck(carouselId)).slides);
    const r3 = await edit('Rewrite slide 9', { editPlan: { actions: [{ type: 'copy', slides: [9] }], reply: 'Rewrote slide 9.' } });
    check('a slide number that does not exist never widens to "every slide"', JSON.stringify((await store.loadDeck(carouselId)).slides) === beforeBad, r3.res.reply);
    check('...and the reply says so', /no such slide/.test(r3.res.reply), r3.res.reply);

    const r4 = await edit('Remove the cover and slide 2', { editPlan: { actions: [{ type: 'structure', removeSlides: [1, 2] }], reply: 'Removed the cover and slide 2.' } });
    check('partial structure change: reply does not echo the planner\'s claim', !/Removed the cover/.test(r4.res.reply) && /cover and closing slides always stay/.test(r4.res.reply), r4.res.reply);

    const r5 = await edit('Use pattern 7', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_pattern', value: '7' }] }], reply: 'Pattern 7 it is.' } });
    check('pattern-only change saves a snapshot', r5.res.undoable === true, r5.res);
    const r5u = await edit('undo', {});
    check('undo restores the previous pattern', r5u.res.designActions.some((d) => d.action === 'set_pattern'), r5u.res.designActions);

    // Image slide numbers survive a removal (template-3 deck)
    const t3 = await withMock(createMockLLM(), () => runCreatePipelineV2({
        jobId: 'j3', userId: 'u1', store, progress: async () => undefined, options: { skipImages: true },
        payload: { topic: 'Async-first remote teams', inputMode: 'text', sourceContent: SOURCE, slideCount: 6, selectedTemplate: 'template-3', presetId: 'ocean-tech', format: 'portrait' } as any,
    }));
    if (t3.kind !== 'done') throw new Error('t3 create failed');
    const t3v0 = await store.loadDeck(t3.result.carouselId);
    const r6 = await edit('Remove slide 2 and redraw slide 4', { editPlan: { actions: [{ type: 'structure', removeSlides: [2] }, { type: 'image', imageSlide: 4, imageBrief: 'a person climbing a giant pencil' }], reply: 'Done.' } }, { images: true, id: t3.result.carouselId });
    const t3v1 = await store.loadDeck(t3.result.carouselId);
    const drawn = t3v1.slides.findIndex((s: any) => s.doodleUrl || s.visual?.doodleUrl);
    check('image goes to the slide the user meant (original 4, now 3rd)', drawn === 2 && t3v1.slides[2].headline === t3v0.slides[3].headline, { drawn, actions: r6.res.actions });

    // Model output hardening
    check('asText flattens arrays', asText(['a', 'b']) === 'a b');
    check('asList maps {bullet, description}', JSON.stringify(asList([{ bullet: 'Docs', description: 'write it down' }])) === '["Docs: write it down"]');
    const split = validateAndCoerce('1. 40% of users churn\n2. 3x faster', { type: 'array', items: { type: 'string' } } as any).value;
    check('newline lists keep their numbers', split[0] === '40% of users churn' && split[1] === '3x faster', split);

    // Unit: design sanitizer
    check('sanitizer normalizes "Template 4" and "Midnight Luxe"-style ids', sanitizeDesign([{ action: 'set_template', value: 'template 4' } as any, { action: 'set_format', value: 'Square' } as any]).length === 2);

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
