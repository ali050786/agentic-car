# Agent pipeline v2

v2 replaces the Plan-Execute-Reflect planner for creating and editing carousels. It is on by default (`PIPELINE_VERSION=v2`). Set `PIPELINE_VERSION=v1` on the worker to switch back; nothing else changes.

## Why

A code-level review of v1 found these problems:

| # | v1 problem | v2 fix |
|---|---|---|
| 1 | Stat, quote and split slides were flattened to plain slides by an IR round trip (`layoutToSlide` drops them), so rich layouts never reached the renderer. | Drafts are converted once, at save time, into hybrid slides that carry both the legacy fields and the IR (`blockType` + `slots`). |
| 2 | One hardcoded model at temperature 0.2 for every task, no timeout, no retry, no fallback, and the response schema was ignored. | Model roles (`fast`, `planner`, `writer`, `creative`, `critic`) with their own model, temperature, token budget and timeout. Retries with backoff, a fallback chain, schema validation with safe coercion and one repair round trip. |
| 3 | The PLAN step could silently change the slide count. | The count is fixed before planning and enforced in code (outline, writer retry, validators). |
| 4 | Three separate layers decided whether to research. | One decision: deterministic rules first, then a single `fast` call. |
| 5 | No outline: the writer invented structure and copy for N slides in one shot. | An outline stage plans each slide's job, layout block and supporting facts. |
| 6 | The cover was written once (the landing page advertised a tournament). | A real hook tournament: 4 covers in different styles, scored on a rubric. The code sums the scores itself. |
| 7 | Character limits, accent phrases and banned words were prompt-only. | One limits table per template drives both the prompts and the validators. Limits, accents, banned words, emoji and structure are enforced in code. |
| 8 | Self-critique by the same prompt, on vague criteria, with no check that rewrites helped. | A separate critic role, a rubric that depends on the content type, per-slide fixes, and revisions are kept only if they don't add rule violations. |
| 9 | Research text was pasted raw into prompts and sources were thrown away. | Research becomes a numbered fact sheet (F1...Fn) with sources. Numbers in the copy must trace back to it, the source, or the user's request. Unsupported stat slides are downgraded. Sources are saved with the carousel brief. |
| 10 | The Creative Director always asked questions on turn 1. | It asks only when the request is genuinely ambiguous, with a code-level check that skips questions for specific requests. |
| 11 | Edits: one intent per message, safety check before loading (serial), empty conversation summary, headlines uppercased on sentence-case templates, save then moderate then revert, no undo. | A multi-action edit plan, safety in parallel with loading and planning, the client's rolling summary is used, sentence case kept, moderation before saving, and a snapshot before every change for undo. |
| 12 | All memory went into one bucket and banned words were never enforced. | Memory is categorised (banned words, tone, brand rules, other). Banned words are removed in code. Explicit "never use X" messages are caught by a deterministic backstop. |
| 13 | Parallel steps shared one trace span; cached tokens read from the wrong field; no evals. | Each step gets its own span via AsyncLocalStorage. Cost and cached tokens come from OpenRouter usage. An offline test suite and a v1-vs-v2 eval harness. |

## Model roles

Defined in `core/llm/models.ts`. Every role defaults to `deepseek/deepseek-v4-flash`.

| Role | Used for | Temperature | Max tokens | Timeout |
|---|---|---|---|---|
| fast | gate, moderation, research planning, fact extraction, tighten, proofread, memory | 0.1 | 2000 | 45s |
| planner | outline, edit plan, Creative Director, Design Director | 0.3 | 4000 | 60s |
| writer | slide copy, revisions, edit rewrites, Canvas composer | 0.75 | 8000 | 120s |
| creative | hook candidates (written and scored in one call), art direction | 0.95 | 2500 | 60s |
| critic | deck critique, eval judge | 0.15 | 4000 | 75s |

Override per role with `LLM_MODEL_<ROLE>` and `LLM_TEMP_<ROLE>`, or all at once with `LLM_MODEL_DEFAULT`. `LLM_FALLBACK_MODELS` is a comma-separated list tried after the primary fails 3 times. A 401/403 or a safety-filter refusal stops the chain immediately.

### Call speed

Hidden reasoning is off for every role. The writer and creative roles were switched off after the 2026-09-24 evals: the same judge scores (8.0 vs 8.1), 31s instead of 84s per deck, about half the cost, and none of the empty responses reasoning mode produced. `LLM_REASONING_WRITER=default` turns it back on for one role.

Every call streams (`LLM_STREAM=off` to disable), which makes slow calls cheap to recover from:

| Setting | fast | planner | writer | creative | critic | Env override |
|---|---|---|---|---|---|---|
| Reasoning | off | off | off | off | off | `LLM_REASONING_<ROLE>` / `LLM_REASONING` = on, off, default |
| No first token after | 20s | 25s | 45s | 35s | 25s | `LLM_FIRST_TOKEN_MS[_<ROLE>]` |
| Tokens stop for | 15s | 18s | 20s | 18s | 18s | `LLM_STALL_MS[_<ROLE>]` |
| Twin request after | 9s | 12s | 18s | 14s | 12s | `LLM_HEDGE_MS_<ROLE>`, `LLM_HEDGE=off` |

- A silent or stalled attempt is cut and retried at once (no backoff); reasoning tokens count as progress.
- If an attempt has no first token by the "twin" time, an identical request starts; the first to finish wins and the other is cancelled.
- Requests ask OpenRouter for the highest-throughput provider (`LLM_PROVIDER_SORT=throughput|latency|price|off`).
- A model that rejects the reasoning switch gets one retry without it and is remembered.
- Focused calls get only the facts they need (the revision sees facts its slides cite or share numbers with; hooks see the outline's facts), capped at 12.

## Create pipeline

`core/agents/v2/createPipeline.ts`

1. **Gate, memory, research plan and (when the studio sent no brief) the Creative Director in parallel.** For a specific request the studio skips its own intent round trip and the worker writes the brief here; an explicit "N slides" in the request still wins, with a note in the reply if it was out of range.
2. **Research → fact sheet.** Tavily search when needed (skipped for entertainment; for explainers of stable knowledge such as "how X works" or "explain X for kids", unless the request asks for current data; and when a substantial source is provided unless the user asked for a fact-check). Explainer outlines walk through the mechanism step by step instead. A `fast` call distills up to 12 atomic facts with ids and source links. A pasted source also gets a fact sheet.
3. **Outline.** One beat per slide: purpose, key message, layout block, fact ids. The planner sees the user's own words and must deliver what they literally ask for (a time frame, a format, a verdict). The request decides the story: facts only support it, and off-topic facts are left out (the fact sheet itself keeps only facts that help answer the request, and the cover must be on topic). Code enforces the count, hero first, closing last, blocks the template supports, each fact id on one beat only, and that stat/quote beats cite a fact that actually contains a number or a quote. Canvas decks start the Design Director here, from the outline.
4. **Hook tournament ‖ writer.** 4 covers (specific promise, curiosity gap, contrarian or surprising fact, story opening or direct benefit), written and scored on the rubric in one call; code sums the scores (ties go to "deliverable"). `HOOK_JUDGE=separate` scores them in a second critic call instead. Hooks must say exactly what the facts say (no hype labels, one person's result is not a promise), and "deliverable" scores 1-3 for anything overstated. Meanwhile the writer drafts slides 2 onward, in two halves at the same time once there are 6 or more (`WRITER_CHUNK=n` forces groups of n; smaller groups measured slower, because each call spends most of its time reasoning over the whole outline); the cover comes from the tournament, and if the tournament fails the writer writes it afterwards. Missing slides are re-requested once. The writer is told to use each fact faithfully (subject, scope, time frame, qualifiers), to lead with each fact on one slide only, to end every body on a complete sentence, and never to write fact ids in copy. Code scrubs any fact id that leaks anyway ("According to F12", "(F3)") and turns a stat slide whose number is not a number (e.g. "F2") into a plain slide.
5. **Rules in code.** Structure, allowed blocks, list lengths, accent phrases, emoji, banned words, bodies that stop mid-sentence, and headlines, labels or list items that stop on a connector or an open quote ("…serverless vs.", "…haven't done your"). Over-limit fields, banned terms and fragments go to a `tighten` call that returns 3 options of decreasing length; code keeps the longest one that fits and reads complete, and retries once for anything still unfixed. The last-resort cut keeps whole sentences in body copy and whole clauses in labels (cut at a colon, comma or dash), never ends on a connector and never leaves a quote open. The final clamp applies the same guarantees.
6. **Grounding.** Every numeric claim is checked against the fact sheet, the user's source and the user's request (not raw search snippets: the writer never saw those, so a match there is a coincidence). Percentages must match as percentages ("1%" is not supported by "1 in 100"). A number that leads two slides (headline or big number) is flagged for the review. A stat slide with an unsupported number becomes a plain slide.
7. **The draft goes out.** It is moderated, and once it passes the studio shows it (read-only, with the current step). Canvas composers and sketch images start on it too.
8. **Critic ‖ fact check ‖ proofread.** One critic pass by default (`maxReflectPasses`): a content-type rubric (now including "expectations": does it deliver what was asked), per-slide problems, revisions of flagged slides, kept only if they don't add violations; skipped when the score is 8+ with no blocking issues. At the same time a fact check (`verify.ts`, critic role, temperature 0) reads the slides next to the facts and reports only serious problems: invented numbers, quotes, studies or examples, and claims that change a fact's meaning (wrong number, one result presented as a rule, a flipped condition, merged facts). Paraphrase, omitted details and headline compression are explicitly not problems, fixes must be slide copy in the deck's voice, and at most 4 findings are kept. Its findings are blocking notes for the revision, so they are fixed even when the critic is happy, and a flagged cover may be rewritten. It runs when the deck has facts, a source, or an accuracy brief; not for pure entertainment. `FACT_CHECK=off` turns it off. The proofreader checks the draft at the same time.
9. **Proofread what changed.** Slides the critic left alone keep the proofreader's corrections; revised slides are proofread now (corrections only, temperature 0; changes over 30% in length, to numbers, or past a limit are rejected). Words that changed since the draft was moderated are moderated alongside, and Canvas layouts are checked against the final words (a slide is composed again only if its layout no longer fits).
10. **Save.** Hybrid slides, the thread's first turn and the brief (premise, takeaway, facts, sources, creative settings; kept under the 8000-character column). A flagged deck is never saved; once the pipeline has refused or finished, calls still in flight stop.

Steps 3 to 9 live in `composeDeck()`, which whole-deck edits reuse.

### What runs at the same time

```
gate ‖ memory ‖ research plan ‖ brief ─► search ─► facts ─► outline ─┬─► hooks ─┐
                                                                     ├─► writer (groups of 3) ─► rules ─► draft ─┬─► critic ‖ fact check ─► revise ─► proofread changed ─► save
                                                                     └─► design director                         ├─► proofread
                                                                                                            ├─► moderation ─► preview
                                                                                                            └─► composers (Canvas) / sketches (template-3)
```

`npx tsx tests/v2/test-speed.ts` simulates the calls with delays (writer calls take time per slide) and checks these overlaps; in that simulation a classic deck finishes in about 55% of the previous structure's time and a Canvas deck in about 45%, with the first slides on screen at about 60% of the run.

## Edit pipeline

`core/agents/v2/editPipeline.ts`

- Safety check runs in parallel with loading the deck, thread, brief and memory and with planning. A bare "undo" skips both.
- The planner returns an ordered list of actions: `copy`, `design`, `structure`, `regenerate`, `image`, `undo`, `answer`, plus an optional memory note. "Switch to the sketch template and punch up slide 2" does both.
- Executors: copy rewrites run with the same limits, banned words, accent and proofread guarantees as create. Structure changes track slides by identity, so slide numbers stay correct after removals and inserts; new slides are written by the writer, not by the planner. Template switches re-fit copy to the new template's blocks and limits. Regenerate runs the full compose pipeline. Image requests use the art director's style envelope.
- Numbers an edit introduces that aren't in the facts are called out in the reply.
- Moderation runs before saving. A snapshot of the previous deck is saved before every change.
- The honesty guard still refuses to claim a change that didn't happen, and anything that was planned but not applied is stated in the reply.

## Undo

Run once per Appwrite project:

```
npm run setup:versions
```

This creates the `carousel_versions` collection (the last 10 snapshots per carousel are kept). Without it, edits still work; undo just says there's nothing to restore. In the studio, an "Undo last change" chip appears after any edit that saved a snapshot, and typing "undo" works too.

## Tests and evals

```
npm run test:agents     # offline: model runtime, create pipeline, edit pipeline, accuracy guarantees, timing (mock model)
npm run eval            # live: v1 vs v2 on 10 golden cases, judged blind
npm run eval -- --cases=kids-rain,source-4day --pipelines=v2
npm run eval -- --mock --pipelines=v2     # offline smoke test of the harness
npm run eval -- --serial --pipelines=v2   # one run at a time: latency without our own load
npm run eval -- --pipelines=v2 --repeat=3 # every case 3 times (ids #1-#3): averages out judge noise
LLM_REASONING_WRITER=off LLM_REASONING_CREATIVE=off npm run eval -- --serial --pipelines=v2   # speed experiment
npx tsx tests/v2/test-speed.ts            # timing simulation (which steps overlap)
```

The summary also counts bodies that end mid-sentence and fact-check findings; each deck lists what the fact check flagged in its draft. The report's "Where the time goes" section lists every model call by label (calls per run, average and p90 seconds, retries, hedged calls, time to first token, reasoning tokens, failures), every step, why attempts failed, and a timeline of the slowest run. Without `--serial`, runs share the API with each other, so latency is inflated.

Evals never write to Appwrite and never generate images. Reports go to `evals/reports/<timestamp>.md` (summary, per-case scores, pairwise winner and reason, and every deck) plus a `.json` with the raw data. The judge is the `critic` role at temperature 0, blind to which pipeline wrote each deck, and the pairwise order alternates per case. The judge also sees what each deck was written from (v2: its fact sheet; v1: its research text), and scores accuracy as "true to the evidence or common knowledge", so sourced numbers are no longer marked as invented. Scores before 2026-09-24 03:00 were judged without the evidence and are not directly comparable.

## Tracing and cost

Each job gets a Langfuse trace; each step (`outline`, `hooks`, `writer`, `reflect`, ...) is its own span with LLM generations nested under it. The job result includes a `metrics` summary (steps with start times, LLM calls, retries, hedged calls, reasoning tokens, cost) and `tokenUsage.costUsd`, which the studio shows next to the token count.

Job progress writes never block the pipeline: they go through one ordered queue, progress never goes backwards, and a cancel is picked up by a background check every 2.5s (model calls after a cancel refuse to start).

## Files

| Path | What |
|---|---|
| `core/llm/models.ts` | Roles, defaults, env overrides |
| `core/llm/schema.ts` | Schema validation and coercion |
| `core/llm/generateContent.ts` | Retries, timeouts, fallback, repair, usage |
| `core/llm/agentGateway.ts` | Job context, per-step spans, metrics, mock model hook |
| `core/agents/v2/*` | The v2 stages and both pipelines |
| `worker/versionStoreServer.ts`, `scripts/setupCarouselVersions.ts` | Undo storage |
| `tests/v2/*` | Offline tests and the scripted mock model |
| `evals/*` | Golden set, scorer, runner |
