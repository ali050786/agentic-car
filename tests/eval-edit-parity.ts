/**
 * Edit-parity eval (Phase 6.4 gate).
 *
 * Runs a fixed set of edit prompts through BOTH the legacy OrchestratorAgent
 * and the new unified planner edit path (runEditTurn), and reports how often
 * they agree on intent + which slides changed. This is the gate that must pass
 * before OrchestratorAgent / editCarouselJob are deleted — we retire the old
 * path on measured tolerance, NOT on faith (some regression is expected).
 *
 * REQUIRES a live model + Appwrite (getUserMemory) — runs on your env, not in
 * CI without creds:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... \
 *   OPENROUTER_API_KEY=... npx tsx tests/eval-edit-parity.ts
 *
 * dryRun is set so nothing is persisted.
 */
import 'dotenv/config';
import { OrchestratorAgent } from '../core/agents/OrchestratorAgent';
import { runEditTurn, CreateJobPayload } from '../core/agents/CarouselPlanner';
import { SlideContent } from '../types';

const TEMPLATE_ID = 'template-1' as const;
const USER_ID = process.env.EVAL_USER_ID || 'eval-user';

const deck = (): SlideContent[] => [
  { id: 's1', variant: 'hero', headline: 'THE HIDDEN COST OF BUSYWORK', body: '' },
  { id: 's2', variant: 'body', headline: 'MEETINGS EAT YOUR DAY', body: 'The average manager spends 23 hours a week in meetings.' },
  { id: 's3', variant: 'body', headline: 'CONTEXT SWITCHING IS EXPENSIVE', body: 'It takes 23 minutes to refocus after an interruption.' },
  { id: 's4', variant: 'list', headline: 'FIX IT', listItems: ['Batch your comms', 'Protect deep-work blocks', 'Say no more often'] },
  { id: 's5', variant: 'closing', headline: 'RECLAIM YOUR FOCUS', body: '' },
];

const PROMPTS: string[] = [
  'make slide 2 punchier',
  'rewrite the whole carousel in a more contrarian tone',
  'shorten slide 3',
  'switch to the sketch template',
  'make it square',
  'use the ocean tech palette',
  'move my signature to the top right',
  'add a slide about the cost of email',
  'remove slide 3',
  'delete everything except the first slide',
  'what does slide 4 say?',
  'is this too negative?',
  'change slide 5 to end on a hopeful note',
  'give slide 1 a bolder hook',
  'regenerate the image on slide 2',
];

const noopProgress = async () => {};
const runSpan = async <R>(_n: string, _i: any, fn: () => Promise<R>) => fn();

const basePayload = (): CreateJobPayload => ({
  topic: '', inputMode: 'topic', sourceContent: '', customInstructions: '', outputLanguage: 'en',
  slideCount: 5, selectedModel: 'openrouter/deepseek-v4-flash', selectedTemplate: TEMPLATE_ID,
  presetId: 'ocean-tech', brandMode: 'preset', brandKit: {} as any, signaturePosition: 'bottom-left',
  format: 'portrait', selectedPattern: 1, patternOpacity: 0.1,
});

const main = async () => {
  console.log(`🧪 Edit-parity eval — ${PROMPTS.length} prompts, old (OrchestratorAgent) vs new (runEditTurn)\n`);
  let intentMatches = 0;
  const rows: string[] = [];

  for (const message of PROMPTS) {
    let oldIntent = 'ERR', newIntent = 'ERR';
    let oldChanged = '-', newChanged = '-';
    try {
      const o = await OrchestratorAgent.handle({
        message, slides: deck(), templateId: TEMPLATE_ID, selectedSlideIndex: null,
        recentMessages: [], conversationSummary: '', userMemory: [],
      });
      oldIntent = o.intent;
      oldChanged = o.changedIndices.length ? o.changedIndices.join(',') : (o.designActions.length ? 'design' : (o.structureOps.length ? 'struct' : (o.imageBrief ? 'img' : '-')));
    } catch (e: any) { oldIntent = `ERR(${e?.message?.slice(0, 20)})`; }

    try {
      const n = await runEditTurn({
        userId: USER_ID, progress: noopProgress, runAgentSpan: runSpan,
        payload: { ...basePayload(), isEditTurn: true, dryRun: true, carouselId: 'eval', message, existingSlides: deck() },
      });
      newIntent = n.intent;
      newChanged = n.changedIndices.length ? n.changedIndices.join(',') : (n.designActions.length ? 'design' : (n.structureOps.length ? 'struct' : (n.imageBrief ? 'img' : '-')));
    } catch (e: any) { newIntent = `ERR(${e?.message?.slice(0, 20)})`; }

    const match = oldIntent === newIntent;
    if (match) intentMatches++;
    rows.push(`${match ? '✓' : '✗'} "${message}"\n     old: ${oldIntent} [${oldChanged}]   new: ${newIntent} [${newChanged}]`);
  }

  console.log(rows.join('\n'));
  const pct = Math.round((intentMatches / PROMPTS.length) * 100);
  console.log(`\nIntent match: ${intentMatches}/${PROMPTS.length} (${pct}%)`);
  console.log(pct >= 90
    ? '✅ Meets the ≥90% intent-match gate. Spot-check the [changed] columns before deleting OrchestratorAgent.'
    : '⚠️ Below the 90% gate — do NOT retire OrchestratorAgent yet; inspect the ✗ rows.');
};

main().catch(err => { console.error('Eval failed:', err); process.exit(1); });
