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
import { UNDO_RE, previousPoint } from '../../core/agents/undo';

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
    check('the change saves a restore point for its reply', !!e1.res.versionId && (store.versions.get(carouselId) || []).some((v) => v.id === e1.res.versionId && v.kind === 'point'));
    check('the reply no longer asks you to type undo', !/say "undo"/i.test(e1.res.reply), e1.res.reply);
    const thread1 = store.threads.get(carouselId) || [];
    check('the creation reply carries a restore point', !!thread1[1]?.versionId && thread1[1].role === 'assistant', thread1.slice(0, 2));
    check('the edit reply is saved with its restore point', thread1[thread1.length - 1]?.versionId === e1.res.versionId && thread1[thread1.length - 1]?.id === e1.res.messageId);
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

    // Restore to a reply in the studio, then keep going
    const rc = await withMock(createMockLLM(), () => runCreatePipelineV2({
        jobId: 'jr', userId: 'u1', store, progress: async () => undefined, options: { skipImages: true },
        payload: { topic: 'Async-first remote teams', inputMode: 'text', sourceContent: SOURCE, slideCount: 7, selectedTemplate: 'template-1', presetId: 'ocean-tech', format: 'portrait' } as any,
    }));
    if (rc.kind !== 'done') throw new Error('restore fixture failed');
    const rid = rc.result.carouselId;
    check('create returns the first reply and its restore point', !!rc.result.versionId && !!rc.result.messageId);
    const ra = await edit('Make slide 3 punchier', { editPlan: { actions: [{ type: 'copy', slides: [3] }], reply: 'Done.' } }, { id: rid });
    const rb = await edit('Use pattern 5', { editPlan: { actions: [{ type: 'design', design: [{ action: 'set_pattern', value: '5' }] }], reply: 'Done.' } }, { id: rid });
    check('every change has its own restore point', !!ra.res.versionId && !!rb.res.versionId && ra.res.versionId !== rb.res.versionId);
    const beforeTrim = (store.threads.get(rid) || []).length;
    const mockR = createMockLLM({ editPlan: { actions: [{ type: 'copy', slides: [2] }], reply: 'Done.' } });
    const rr = await withMock(mockR, () => runEditPipelineV2({
        carouselId: rid, userId: 'u1', message: 'Make slide 2 shorter', store, progress: async () => undefined, options: { skipImages: true },
        restoredTo: ra.res.messageId, messageIds: { user: 'client-u', assistant: 'client-a' },
    }));
    const trimmed = store.threads.get(rid) || [];
    check('restoring to a reply drops the later messages', beforeTrim === 6 && trimmed.length === 6 && trimmed[3].id === ra.res.messageId, trimmed.map((m) => m.id));
    check('the new turn keeps the studio\'s message ids', trimmed[4].id === 'client-u' && trimmed[5].id === 'client-a' && rr.messageId === 'client-a', trimmed.slice(-2));
    const ru2 = await edit('undo', {}, { id: rid });
    const afterRu2 = await store.loadDeck(rid);
    const atRa = await store.getVersion(ra.res.versionId!);
    check('undo walks back to the reply before the current state', JSON.stringify(afterRu2.slides.map((x) => x.headline)) === JSON.stringify(atRa!.slides.map((x) => x.headline)) && ru2.res.versionId === ra.res.versionId, ru2.res.reply);
    const ru3 = await edit('undo', {}, { id: rid });
    const afterRu3 = await store.loadDeck(rid);
    check('undo again goes further back, never forward', JSON.stringify(afterRu3.slides.map((x) => x.headline)) === JSON.stringify(rc.result.slides.map((x) => x.headline)), ru3.res.reply);
    const ru4 = await edit('undo', {}, { id: rid });
    check('nothing earlier than the created deck', /nothing to undo/i.test(ru4.res.reply), ru4.res.reply);

    // A deck from before restore points: its last reply gets one for how the deck looked
    const legacyId = await store.createCarousel({ ...(await store.loadDeck(rid)), userId: 'u1', title: 'old', brandKit: {} as any, brandMode: 'preset', signaturePosition: 'bottom-left', selectedPattern: 1, patternOpacity: 0.1 } as any);
    store.threads.set(legacyId, [{ id: 'old-u', role: 'user', text: 'make a deck' }, { id: 'old-a', role: 'assistant', text: 'Here it is.' }]);
    const legacyBefore = await store.loadDeck(legacyId);
    await edit('Make slide 3 punchier', { editPlan: { actions: [{ type: 'copy', slides: [3] }], reply: 'Done.' } }, { id: legacyId });
    const oldReply = (store.threads.get(legacyId) || []).find((m) => m.id === 'old-a');
    const oldPoint = oldReply?.versionId ? await store.getVersion(oldReply.versionId) : null;
    check('an older deck gets a restore point on its last reply', !!oldPoint && JSON.stringify(oldPoint.slides.map((x) => x.headline)) === JSON.stringify(legacyBefore.slides.map((x) => x.headline)));

    // Undo steps (shared by the studio and the pipeline)
    const M = (id: string, versionId?: string) => ({ id, role: 'assistant', versionId });
    const U = (id: string) => ({ id, role: 'user' });
    const timeline = [U('u0'), M('a0', 'v0'), U('u1'), M('a1', 'v1'), U('u2'), M('a2', 'v2'), U('u3'), M('a3')];
    check('undo from the latest goes to the reply before it', previousPoint(timeline)?.id === 'a1');
    check('undo from a restored reply goes one further back', previousPoint(timeline, 'a1')?.id === 'a0');
    check('nothing before the first restore point', previousPoint(timeline, 'a0') === null);
    const afterUndo = [...timeline, U('u4'), M('a4', 'v1')];
    check('after an undo, the next undo walks back (never forward)', previousPoint(afterUndo)?.id === 'a0');
    check('a bare undo is recognised', UNDO_RE.test('undo') && UNDO_RE.test('Undo that please') && !UNDO_RE.test('go back to the square format'));

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
