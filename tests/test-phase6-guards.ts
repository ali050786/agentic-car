/**
 * Phase 6.3 — verifies the guards extracted from OrchestratorAgent into
 * core/agents/guards.ts still behave correctly (these are the deterministic
 * protections the unified planner reuses). Pure functions only — no LLM calls.
 */
import {
    parseDesignActionsFallback,
    applySlidePatches,
    applyStructureOps,
    messageHeuristics,
    StructureOp,
} from '../core/agents/guards';
import { getPresetIds } from '../config/colorPresets';
import { SlideContent } from '../types';

console.log('🧪 Phase 6 Guards Verification Tests...\n');

let passCount = 0;
let failCount = 0;
const check = (name: string, cond: boolean) => {
    if (cond) { passCount++; console.log(`  ✓ PASSED: ${name}`); }
    else { failCount++; console.log(`  ✗ FAILED: ${name}`); }
};

const deck = (): SlideContent[] => [
    { id: 's1', variant: 'hero', headline: 'HERO' },
    { id: 's2', variant: 'body', headline: 'BODY TWO', body: 'original two' },
    { id: 's3', variant: 'body', headline: 'BODY THREE', body: 'original three' },
    { id: 's4', variant: 'closing', headline: 'CLOSING' },
];

// ── parseDesignActionsFallback ──────────────────────────────────────────────
const sketch = parseDesignActionsFallback('make it a hand-drawn sketch');
check('design fallback: "sketch" → set_template template-3',
    sketch.some(a => a.action === 'set_template' && a.value === 'template-3'));

const square = parseDesignActionsFallback('switch to square 1:1');
check('design fallback: "square" → set_format square',
    square.some(a => a.action === 'set_format' && a.value === 'square'));

const firstPreset = getPresetIds()[0];
const presetMsg = `use the ${firstPreset.replace(/-/g, ' ')} palette`;
check(`design fallback: preset name → set_preset ${firstPreset}`,
    parseDesignActionsFallback(presetMsg).some(a => a.action === 'set_preset' && a.value === firstPreset));

check('design fallback: pure question → no actions',
    parseDesignActionsFallback('what template is this?').length === 0);

// ── applySlidePatches (1-based slideIndex) ──────────────────────────────────
const patchOne = applySlidePatches(deck(), [{ slideIndex: 3, headline: 'new three' }], 'template-1');
check('patch: slideIndex 3 (1-based) edits array index 2',
    patchOne.changedIndices.length === 1 && patchOne.changedIndices[0] === 2);
check('patch: template-1 uppercases headline',
    !!patchOne.slides && patchOne.slides[2].headline === 'NEW THREE');

const patchNoop = applySlidePatches(deck(), [{ slideIndex: 2, body: 'original two' }], 'template-1');
check('patch: echoing identical text is NOT counted as a change',
    patchNoop.slides === null && patchNoop.changedIndices.length === 0);

const patchT4 = applySlidePatches(deck(), [{ slideIndex: 2, headline: 'Keep My Case' }], 'template-4');
check('patch: template-4 preserves headline case',
    !!patchT4.slides && patchT4.slides[1].headline === 'Keep My Case');

// ── applyStructureOps ───────────────────────────────────────────────────────
const removed = applyStructureOps(deck(), [{ op: 'remove', removeIndex: 3 }], 'template-1');
check('structure: remove slide 3 (1-based) drops the right middle slide',
    !!removed && removed.length === 3 && !removed.some(s => s.id === 's3'));

const removeHero = applyStructureOps(deck(), [{ op: 'remove', removeIndex: 1 }], 'template-1');
check('structure: removing the hero (slide 1) is blocked',
    removeHero === null);

const tiny: SlideContent[] = [
    { id: 'a', variant: 'hero', headline: 'A' },
    { id: 'b', variant: 'closing', headline: 'B' },
];
const removeBelowMin = applyStructureOps(tiny, [{ op: 'remove', removeIndex: 2 }], 'template-1');
check('structure: cannot drop below 2 slides',
    removeBelowMin === null);

const appended = applyStructureOps(deck(), [{ op: 'append', slideData: { variant: 'body', headline: 'NEW' } }], 'template-1');
check('structure: append inserts before the closing slide',
    !!appended && appended.length === 5 && appended[appended.length - 1].id === 's4');

const inserted = applyStructureOps(
    deck(),
    [{ op: 'insert', afterIndex: 2, slideData: { variant: 'body', headline: 'INS' } }],
    'template-1'
);
check('structure: insert afterIndex 2 (1-based) places new slide at array index 2',
    !!inserted && inserted.length === 5 && inserted[2].headline === 'INS');

// ── messageHeuristics ───────────────────────────────────────────────────────
const q = messageHeuristics('what does this slide say?');
check('heuristics: trailing "?" → isQuestion, not a command',
    q.isQuestion && !q.isCopyCommand && !q.isDesignCommand);

const copy = messageHeuristics('rewrite slide 2 to be punchier');
check('heuristics: "rewrite ... punchier" → copy command',
    copy.isCopyCommand && !copy.isQuestion);

const design = messageHeuristics('switch to the sketch template');
check('heuristics: "switch to ..." → design command',
    design.isDesignCommand);

const structural = messageHeuristics('add a slide about pricing');
check('heuristics: "add a slide" → structural',
    structural.looksStructural);

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) process.exit(1);
console.log('✨ All Phase 6 guard tests passed successfully!');
