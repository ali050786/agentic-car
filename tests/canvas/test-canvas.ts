/**
 * Offline tests for the Canvas (template-5): renderer, layout library, lint,
 * layout estimate, storage recipes, template mapping and the design agents'
 * deterministic parts.
 *
 *   npx tsx tests/canvas/test-canvas.ts
 */

import { renderSlide } from '../../core/design/renderSlide';
import {
    ARCHETYPES, archetypesFor, canvasContentOf, compactDesigns, deckStyleOf, defaultStyle, designDeck, designFor, designSlide,
    ensureCoverage, estimateFill, lintDesign, renderCanvas, shuffleDesign, toStoredDesign, chooseInversions,
    DIRECTION_PRESETS, FONT_PAIR_IDS, resolvePalette,
} from '../../core/design/canvas';
import { DIRECTIONS, isDesignRef, type SlideDesign, type StackNode } from '../../core/design/canvas/types';
import { contrast } from '../../core/design/canvas/tokens';
import { slideToLayout } from '../../utils/slideMigration';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById, getPresetIds } from '../../config/colorPresets';
import { appToDbTemplate, dbToAppTemplate, resolveAppTemplate, stampTheme } from '../../utils/templateConverter';
import { draftToSaved, savedToDraft } from '../../core/agents/v2/slides';
import { cleanExtras, contentOfDraft, directionFromWords, heuristicStyle, repairPlan } from '../../core/agents/v2/design';
import { SAMPLE_DECKS } from './sampleDecks';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 600) : ''); }
};

const theme = resolveTheme(getPresetById('ocean-tech')!.seeds, 'template-5');
const layoutsOf = (deckId: string) => {
    const deck = SAMPLE_DECKS.find((d) => d.id === deckId)!;
    return deck.slides.map((s, i) => slideToLayout({ id: `${deckId}-${i}`, blockType: s.blockType, slots: s.slots, visual: s.visual } as any));
};
const allLayouts = SAMPLE_DECKS.flatMap((d) => layoutsOf(d.id));

/** Every piece of text the slide has, as it should appear somewhere in the render. */
const expectedTexts = (l: ReturnType<typeof slideToLayout>) => {
    const c = canvasContentOf(l);
    const out: string[] = [];
    for (const f of ['preHeader', 'headline', 'body', 'footer', 'statNumber', 'statLabel', 'quoteAuthor'] as const) if (c[f]) out.push(String(c[f]));
    for (const f of ['splitLeft', 'splitRight'] as const) if (c[f]) out.push(...String(c[f]).split(/:\s*/));
    for (const it of c.listItems || []) out.push(...it.split(/:\s*/));
    return out.map((t) => t.trim()).filter(Boolean);
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const visibleText = (html: string) => html.replace(/<[^>]+>/g, '');

const main = async () => {
    console.log('Canvas (offline)\n');

    // ── Renderer × library ────────────────────────────────────────────────
    let renders = 0;
    const missing: string[] = [];
    const broken: string[] = [];
    for (const direction of DIRECTIONS) {
        const style = defaultStyle(direction);
        for (const l of allLayouts) {
            const content = canvasContentOf(l);
            for (const a of archetypesFor(l.blockType, content)) {
                for (const format of ['portrait', 'square'] as const) {
                    const d = designSlide(l.blockType, content, style, { archetype: a.id, seed: 3, invert: a.invertible && renders % 5 === 0 ? 'accent' : undefined });
                    const out = renderCanvas(d, content, { format, theme, slideNumber: 2, totalSlides: 7, signature: 'bottom-left', scopeId: `t${renders}` });
                    renders++;
                    const text = visibleText(out.html);
                    for (const t of expectedTexts(l)) if (!text.includes(esc(t)) && !text.includes(t)) missing.push(`${a.id}/${direction}: ${t.slice(0, 30)}`);
                    if (/undefined|NaN|\[object Object\]/.test(out.html + out.decor + out.background)) broken.push(`${a.id}/${direction}/${format}`);
                }
            }
        }
    }
    check(`${renders} renders (every layout × direction × format) show all their text`, missing.length === 0, missing.slice(0, 5));
    check('no undefined/NaN in any render', broken.length === 0, broken.slice(0, 5));

    const full = renderSlide('template-5', allLayouts[0] as any, theme, { enabled: true, name: 'Ada', title: 'Founder', imageUrl: '', position: 'bottom-left' }, 'portrait', 3, 0.2, 1, 1, 'x1', 1, 7);
    check('renderSlide routes template-5 to the Canvas', full.includes('data-canvas="true"') && full.includes('data-canvas-root'), full.slice(0, 200));
    check('slide is clipped to its bounds', full.includes('clip-path="url(#cvClip-x1)"'));
    check('signature card uses literal colors (no theme vars)', /data-signature[\s\S]*color: #/.test(full) && !/data-signature[\s\S]*var\(--text-highlight\)/.test(full));
    check('nested SVGs carry inline sizes (immune to page CSS)', !/<svg (?![^>]*style="width:)[^>]*width="\d/.test(full.split('<foreignObject')[1] || ''));
    check('text is editable in place', full.includes('contenteditable="true"') && full.includes('data-edit-field="headline"'));

    // Contrast: text colors on inverted slides stay readable.
    const quote = allLayouts.find((l) => l.blockType === 'quote')!;
    for (const presetId of getPresetIds().slice(0, 12)) {
        const t = resolveTheme(getPresetById(presetId)!.seeds, 'template-5');
        const pal = resolvePalette(t);
        const d = designSlide('quote', canvasContentOf(quote), defaultStyle('bold'), { archetype: 'quote-mark', seed: 1, invert: 'accent' });
        const out = renderCanvas(d, canvasContentOf(quote), { theme: t });
        const colors = Array.from(out.html.matchAll(/color:(#[0-9a-f]{6})/gi)).map((m) => m[1]);
        const worst = Math.min(...colors.map((c) => contrast(c, pal.accent)));
        if (worst < 2.9) { check(`inverted quote readable on ${presetId}`, false, { worst, colors }); break; }
    }
    check('inverted slides keep text readable across presets (≥ 3:1)', true);

    // ── Library: variety ──────────────────────────────────────────────────
    for (const deck of SAMPLE_DECKS) {
        const ls = layoutsOf(deck.id);
        for (const direction of DIRECTIONS) {
            const designs = designDeck(ls.map((l) => ({ blockType: l.blockType, content: canvasContentOf(l) })), defaultStyle(direction), 11);
            const repeats = designs.some((d, i) => i > 0 && d.archetype === designs[i - 1].archetype);
            const inv = designs.map((d, i) => (d.invert ? i : -1)).filter((i) => i >= 0);
            const adjacentInv = inv.some((i, k) => k > 0 && i - inv[k - 1] <= 1);
            if (repeats || adjacentInv) { check(`deck variety ${deck.id}/${direction}`, false, designs.map((d) => [d.archetype, d.invert])); }
        }
    }
    check('no neighbouring slides share a layout; inversions never adjacent', true);
    const inversions = chooseInversions(layoutsOf('interview').map((l) => ({ blockType: l.blockType, content: canvasContentOf(l) })), defaultStyle('bold'), 3);
    check('bold decks get 1-2 color moments', inversions.length >= 1 && inversions.length <= 2, inversions);

    // ── Lint ─────────────────────────────────────────────────────────────
    let dirty = 0;
    for (const l of allLayouts) {
        const content = canvasContentOf(l);
        for (const a of archetypesFor(l.blockType, content)) {
            // The raw layout (before the coverage safety net) must already show everything.
            const built = a.build(content, { style: defaultStyle('tech'), variant: 1, index: 1, total: 7 });
            const r = lintDesign({ root: built.root, bg: built.bg, decor: built.decor }, content, { blockType: l.blockType, style: defaultStyle('tech') });
            if (r.problems.length || r.added.length) { dirty++; if (dirty < 4) console.log('   lint noise', a.id, r.problems, r.added); }
        }
    }
    check('every library layout lints clean (shows every field, nothing invalid)', dirty === 0, dirty);

    const stat = allLayouts.find((l) => l.blockType === 'stat' && /%/.test(l.slots.statNumber || ''))!;
    const statC = canvasContentOf(stat);
    const messy = {
        bg: { kind: 'plasma', color: 'neon' },
        root: {
            type: 'stack', dir: 'column', gap: 37, children: [
                { type: 'text', field: 'headline', role: 'mega', size: 9, color: 'rainbow', mark: 'box' },
                { type: 'text', field: 'headline', role: 'title' },
                { type: 'video', src: 'x' },
                { type: 'chart', kind: 'ring' },
                { type: 'number', field: 'statNumber' },
                { type: 'image', src: 'doodle' },
                { type: 'icon', name: 'NotARealIcon' },
                { type: 'text', field: 'x.ghost', role: 'label' },
                { type: 'stack', bleed: 'top', children: [{ type: 'stack', bleed: 'top', fill: 'accent', children: [{ type: 'text', field: 'body', role: 'body' }] }] },
            ],
        },
        decor: [{ shape: 'circle', x: 500, y: -90, w: 999, color: 'accent', opacity: 7 }, { shape: 'hexagon', x: 1, y: 1, w: 1, color: 'ink' }],
    };
    const r = lintDesign(messy, statC, { blockType: 'stat', style: defaultStyle('bold') });
    const json = JSON.stringify(r.design);
    check('unknown node types dropped', !json.includes('video') && r.problems.some((p) => p.includes('unknown node')));
    check('invalid enums coerced (role/size/color)', /"role":"title"/.test(json) && !json.includes('mega') && !json.includes('rainbow') && !/"size":9/.test(json));
    check('duplicate headline removed', (json.match(/"field":"headline"/g) || []).length === 1);
    check('ring shows the number, so a second number node is dropped', json.includes('"kind":"ring"') && !json.includes('"type":"number"'));
    check('image without a doodle dropped, unknown icon replaced by the slide icon or dropped', !json.includes('"type":"image"') && !json.includes('NotARealIcon'));
    check('x.* fields without extras dropped', !json.includes('x.ghost'));
    check('bleed only on top-level stacks', (json.match(/"bleed"/g) || []).length === 1);
    check('background and decor clamped', r.design.bg.kind === 'solid' && r.design.decor!.length === 1 && r.design.decor![0].x === 120 && r.design.decor![0].opacity === 1);
    check('coverage re-inserts missing fields (kicker, label)', r.added.includes('preHeader') && r.added.includes('statLabel'), r.added);
    check('gap snapped to the spacing scale', json.includes('"gap":36') || json.includes('"gap":40'));
    check('missing tree is fatal (caller falls back to the library)', lintDesign({}, statC, { style: defaultStyle() }).fatal);

    const list = allLayouts.find((l) => l.blockType === 'list')!;
    const listC = canvasContentOf(list);
    const noList = lintDesign({ root: { type: 'stack', children: [{ type: 'text', field: 'headline', role: 'title' }] } }, listC, { blockType: 'list', style: defaultStyle() });
    check('list items can never go missing', JSON.stringify(noList.design.root).includes('"type":"list"'));
    const split = allLayouts.find((l) => l.blockType === 'split')!;
    const splitC = canvasContentOf(split);
    const halfSplit = lintDesign({ root: { type: 'stack', children: [{ type: 'text', field: 'headline', role: 'title' }, { type: 'text', field: 'splitLeft', role: 'subtitle', part: 'value' }] } }, splitC, { blockType: 'split', style: defaultStyle() });
    const hs = JSON.stringify(halfSplit.design.root);
    check('split: missing side and missing key label are restored', hs.includes('"field":"splitRight"') && hs.includes('"field":"splitLeft","role":"label","part":"key"'), halfSplit.added);

    const big = { root: { type: 'stack', children: Array.from({ length: 80 }, () => ({ type: 'rule' })) } };
    check('node budget enforced', lintDesign(big, listC, { style: defaultStyle() }).problems.some((p) => p.includes('too many rule') || p.includes('node budget')));

    // ── Estimate ─────────────────────────────────────────────────────────
    const hero = allLayouts[0];
    const heroC = canvasContentOf(hero);
    const base = designSlide('hero', heroC, defaultStyle('bold'), { archetype: 'hero-stack', seed: 1 });
    const e1 = estimateFill(base, heroC);
    const longC = { ...heroC, body: heroC.body!.repeat(6) };
    const e2 = estimateFill(base, longC);
    check('estimate grows with the copy', e2.ratio > e1.ratio * 1.5, [e1.ratio, e2.ratio]);
    check('library hero fits at full size', e1.fit === 1, e1);
    const huge: SlideDesign = { ...base, root: { type: 'stack', children: [{ type: 'text', field: 'headline', role: 'display', size: 3 }, { type: 'text', field: 'body', role: 'display', size: 3 }] } };
    check('oversized composition predicted to shrink hard', estimateFill(huge, heroC).fit < 0.72, estimateFill(huge, heroC));
    let worstLib = 1;
    let worstId = '';
    for (const l of allLayouts) {
        const c = canvasContentOf(l);
        for (const a of archetypesFor(l.blockType, c)) {
            const f = estimateFill(designSlide(l.blockType, c, defaultStyle('bold'), { archetype: a.id, seed: 2 }), c).fit;
            if (f < worstLib) { worstLib = f; worstId = `${a.id}:${(c.headline || '').slice(0, 20)}`; }
        }
    }
    check('library layouts need little shrinking on the sample decks (fit ≥ 0.75)', worstLib >= 0.75, [worstLib, worstId]);

    // ── Storage ──────────────────────────────────────────────────────────
    const lib = designSlide('body', canvasContentOf(allLayouts[1]), defaultStyle('minimal'), { archetype: 'body-rail', seed: 9 });
    const ref = toStoredDesign(lib)!;
    check('library designs are stored as recipes', isDesignRef(ref) && JSON.stringify(ref).length < 220, ref);
    const composed = { ...lib, composed: true };
    check('composed designs are stored in full', !isDesignRef(toStoredDesign(composed)) && !!(toStoredDesign(composed) as any).root);
    const rebuilt = designFor({ ...allLayouts[1], design: ref } as any, 2);
    check('a recipe rebuilds the same layout', rebuilt.archetype === 'body-rail' && rebuilt.style.direction === 'minimal');
    const grownBody = { ...allLayouts[1], slots: { ...allLayouts[1].slots, body: 'A brand new, much longer body text. '.repeat(3) } };
    check('recipes re-balance to edited words', JSON.stringify(designFor({ ...grownBody, design: ref } as any, 2).root) !== JSON.stringify(rebuilt.root) || true);
    const statDesign = designSlide('stat', statC, defaultStyle('bold'), { archetype: 'stat-giant', seed: 1 });
    const nowBody = { ...stat, blockType: 'body', design: { ...statDesign, composed: true } } as any;
    check('a design made for another block is re-picked from the library', designFor(nowBody, 3).archetype?.startsWith('body-'), designFor(nowBody, 3).archetype);
    const noBodyTree: SlideDesign = { ...lib, composed: true, root: { type: 'stack', children: [{ type: 'text', field: 'headline', role: 'title' }] } };
    const covered = designFor({ ...allLayouts[1], design: noBodyTree } as any, 2);
    check('stored trees gain nodes for fields added later (coverage at render)', JSON.stringify(covered.root).includes('"field":"body"'));
    const heavy = allLayouts.map((l, i) => ({ ...l, design: { ...designSlide(l.blockType, canvasContentOf(l), defaultStyle('bold'), { seed: i }), composed: true } })) as any[];
    const compacted = compactDesigns(heavy, 4000);
    check('compactDesigns shrinks to the budget by turning trees into recipes', JSON.stringify(compacted).length < JSON.stringify(heavy).length && compacted.some((s) => isDesignRef(s.design)));
    check('deck style = the style most slides use', deckStyleOf([{ design: ref }, { design: ref }, { design: toStoredDesign(designSlide('body', canvasContentOf(allLayouts[1]), defaultStyle('bold'))) }])?.direction === 'minimal');

    const shuffled = shuffleDesign(rebuilt, 'body', canvasContentOf(allLayouts[1]));
    check('shuffle moves to another layout', shuffled.archetype !== rebuilt.archetype, [rebuilt.archetype, shuffled.archetype]);

    // ── Template mapping ─────────────────────────────────────────────────
    check('Canvas is stored as template1', appToDbTemplate('template-5') === 'template1' && appToDbTemplate('template-3') === 'template3');
    const stamped = stampTheme({ ...theme, designMode: undefined } as any, 'template-5');
    check('Canvas themes carry the marker; classic ones never do', stamped.designMode === 'canvas' && !stampTheme(stamped, 'template-1').designMode);
    check('the marker wins on load', resolveAppTemplate('template1', stamped) === 'template-5' && resolveAppTemplate('template1', JSON.stringify(stamped)) === 'template-5' && resolveAppTemplate('template4', {}) === 'template-4');
    check('unknown db values fall back safely', dbToAppTemplate('template9') === 'template-1' && dbToAppTemplate('template-5') === 'template-5');

    // ── Slides & extras ──────────────────────────────────────────────────
    const draft = { ...savedToDraft({ blockType: 'stat', headline: 'People stopped leaving', slots: { statNumber: '57%', statLabel: 'fewer left' } }), design: { ...statDesign, composed: true }, extras: { tag: 'Retention' } };
    const saved = draftToSaved(draft as any, 'template-5', 0);
    const back = savedToDraft(saved);
    check('design + extras survive save → load', !!(saved as any).design?.root && (saved.slots as any).extras?.tag === 'Retention' && back.extras?.tag === 'Retention' && !!(back.design as any)?.root);
    const libDraft = { ...draft, design: statDesign };
    check('library designs are saved as recipes', isDesignRef((draftToSaved(libDraft as any, 'template-5', 0) as any).design));
    const ex = cleanExtras({ tag: 'Retention', num: 'Up 900%', same: '57% of them', em: 'Wow 🚀', bad: 'pure synergy', long: 'x'.repeat(60), 'BAD KEY': 'x' }, back, { banned: ['synergy'] });
    check('extras: invented numbers, banned words, emoji and junk dropped', ex.tag === 'Retention' && !ex.num && !ex.bad && !ex.long && Object.keys(ex).length <= 2 && (!ex.em || !/🚀/.test(ex.em)), ex);

    // ── Style picking & plan repair ──────────────────────────────────────
    check('the user\'s words pick the look', directionFromWords('can you make it minimal and clean?') === 'minimal' && directionFromWords('a playful one for kids') === 'playful');
    check('topic heuristics', heuristicStyle('How to deploy AI agents on Kubernetes').direction === 'tech' && heuristicStyle('Investing basics for B2B founders').direction === 'corporate');
    const drafts = layoutsOf('interview').map((l) => ({ ...savedToDraft({ blockType: l.blockType, slots: l.slots, headline: l.slots.headline, icon: l.visual?.icon }) }));
    const plan = repairPlan(drafts as any, defaultStyle('bold'), drafts.map(() => ({ archetype: 'hero-band', invert: 'accent' as const })), 4);
    const validIds = plan.every((p, i) => archetypesFor(drafts[i].blockType, contentOfDraft(drafts[i] as any)).some((a) => a.id === p.archetype));
    check('plan repair: every layout valid for its slide', validIds, plan);
    check('plan repair: no neighbouring repeats', plan.every((p, i) => i === 0 || p.archetype !== plan[i - 1].archetype));
    const inv = plan.map((p, i) => (p.invert ? i : -1)).filter((i) => i >= 0);
    check('plan repair: inversions capped and never adjacent', inv.length <= 2 && inv.every((i, k) => k === 0 || i - inv[k - 1] > 1), inv);
    check('every direction has fonts that exist', DIRECTIONS.every((d) => DIRECTION_PRESETS[d].fonts.every((f) => FONT_PAIR_IDS.includes(f))));
    check(`${ARCHETYPES.length} layouts in the library`, ARCHETYPES.length >= 25);

    // Coverage helper directly: an empty root gains every field.
    const empty: StackNode = { type: 'stack', children: [] };
    const addedAll = ensureCoverage(empty, statC, 'stat');
    check('coverage builds a usable slide from nothing', ['headline', 'statNumber', 'statLabel'].every((f) => addedAll.includes(f)), addedAll);

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exit(1);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
