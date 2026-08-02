# Implementation Spec — ReAct-style Carousel Agent + Design-System HTML Output

> **For the executing agent (e.g. Google Antigravity):** This is a self-contained, phased implementation spec for the `agentic-car` repo. Execute phases **in order, 0 → 5**. Each phase is an independent task card with an Objective, Dependencies, Files, Steps, and **Acceptance criteria**. **Do not start a phase until the previous phase's acceptance criteria pass.** Phases 0–1 are refactors with no user-visible behavior change (verify by parity). Do not introduce raw LLM-authored HTML anywhere — see Invariants. Repo root: the project's working directory; all paths below are repo-relative.

---

## Background (context for anyone picking this up cold)

The carousel builder currently runs a **fixed linear pipeline** in `worker/jobs/createCarouselJob.ts`: `CreativeDirectorAgent → ResearchAgent → StrategistAgent → TemplateAgent → ProofreaderAgent → ArtDirectorAgent`, each agent running exactly once. Agents produce **content only** — a `SlideContent[]` JSON array + a `CarouselTheme`. The visual is assembled separately by a string-injection engine (`utils/svgInjector.ts`) that does `{{TOKEN}}` replacement to produce an SVG whose real layout is HTML/CSS inside `<foreignObject>`, rendered via `dangerouslySetInnerHTML` in `components/artifact/ArtifactPanel.tsx`. Export (JPG/PDF) is client-side via `html2canvas`.

**Goal of this work:** replace the rigid pipeline with a **bounded plan→execute→reflect loop**, make **design-system-driven HTML** a first-class output, add **structured memory**, and **consolidate the model layer to a single model**.

### Fixed decisions (do not revisit)
1. **HTML strategy = design-system renderer.** The agent emits a structured **layout IR** (blocks + slots + tokens); a **deterministic renderer** turns IR → HTML. The LLM never authors raw HTML.
2. **Loop = bounded plan → execute → reflect.** Specialist agents remain callable steps wrapped in the loop; iterations capped at N=2. Reuse existing deterministic guards.
3. **Model = only `openrouter/deepseek-v4-flash`.** Remove all other providers/models and the fallback chain. Drive the loop with scaffolded JSON step-schemas (reuse existing JSON-mode + truncated-JSON auto-repair), not native tool-calling.
4. **Design system = extracted from existing templates** `template-1/3/4` in `assets/templates/`. Reuse `config/colorPresets.ts` + `utils/brandUtils.ts`.

### Invariants that must hold after every phase (regression guards)
- **Export-safe HTML:** all rendered slide HTML must remain `html2canvas`-compatible (inline styles, extractable `<div>`s inside `<foreignObject>`, embeddable images, resolvable CSS vars). Never let the LLM write markup.
- **Inline editing:** blocks must keep `data-edit-field` + `contenteditable` attributes so `ArtifactPanel` editing works.
- **Brand/signature:** the signature card + theme CSS vars (`--text-default`, `--text-highlight`, `--background`, `--background-2`, `--pattern-color`, `--pattern-opacity`) must still be injected.
- **XSS sanitization:** content still passes through `utils/svgSanitizer.ts`.
- **Backward compat:** existing carousels saved in Appwrite (old `SlideContent` shape) must still render.
- Note: `satori` / `yoga-wasm-web` in `package.json` are dead/unused — do not build on them.

---

## Phase 0 — Consolidate to a single model

**Objective:** Remove all providers/models except `openrouter/deepseek-v4-flash`; delete the multi-model fallback chain.
**Depends on:** nothing.
**Files:** `core/llm/generateContent.ts`, `core/llm/langfuse.ts`, `config/constants.ts`, model-picker UI (search for `selectedModel`), `worker/jobs/createCarouselJob.ts` + `worker/jobs/editCarouselJob.ts` (payload threading), env/config docs.
**Steps:**
1. In `core/llm/generateContent.ts`, strip provider selection + fallback branches (Anthropic-direct, Groq, Llama, Gemini, other OpenRouter models) down to a single call to `openrouter/deepseek-v4-flash`. **Keep** JSON mode and the truncated-JSON auto-repair.
2. Reduce/remove the model roster in `config/constants.ts` and the model-picker UI; stop threading `selectedModel` through `CreateJobPayload`/`AgentContext` — hardcode the model.
3. In `core/llm/langfuse.ts`, ensure the `generation` name/metadata reflect the single model. Keep tracing intact.
4. Remove now-dead provider API keys from env docs/config.
**Acceptance criteria:**
- App and worker build with no unused-import/type errors.
- Running a create job produces a Langfuse trace showing **only** `deepseek-v4-flash` calls; no other provider code path is reachable.

---

## Phase 1 — Extract the design system (tokens + blocks + renderer) behind today's contract

**Objective:** Refactor `svgInjector` internals into a **token-driven block library**, producing visually identical output for the current 3 templates. No schema change yet.
**Depends on:** Phase 0.
**Files:** NEW `core/design/tokens.ts`, NEW `core/design/blocks/*`, NEW `core/design/renderSlide.ts`; refactor `utils/svgInjector.ts` into a thin adapter; extract from `assets/templates/template{1,3,4}{,_square}.ts`; reuse `utils/{brandUtils,patternGenerator,iconGenerator,signatureCardGenerator,svgSanitizer}.ts`, `config/colorPresets.ts`.
**Steps:**
1. `core/design/tokens.ts`: centralize values currently hardcoded inline in template strings — type scale (e.g. headline `104px`, etc.), spacing, font families (`Inter Tight`, the T3 serif), letter-spacing, and **color roles** mapped to the existing CSS vars. Reuse `colorPresets` seeds + `brandUtils` (`resolveTheme`, `generateColorScale`) unchanged.
2. `core/design/blocks/*`: one deterministic renderer per current archetype — `Hero`, `Body`, `List`, `Closing` — extracted from the three templates. Each takes typed slots → `html2canvas`-safe HTML with `data-edit-field`/`contenteditable`. Reuse the sub-generators.
3. `core/design/renderSlide.ts`: reimplement the internals of `injectContentIntoSvg` (same output contract: SVG+foreignObject string, per-template/format signature-card positioning shims preserved).
4. Convert `utils/svgInjector.ts` into a thin adapter delegating to `renderSlide` so `ArtifactPanel` and all exporters stay untouched.
**Acceptance criteria:**
- DOM/screenshot snapshot comparison of old vs new output for `template-{1,3,4}` × `{hero,body,list,closing}` × `{portrait,square}` is visually identical.
- JPG export, PDF export, and inline `contenteditable` editing all still work in `ArtifactPanel`.

---

## Phase 2 — Introduce the Layout IR + migration adapter

**Objective:** Replace the fixed 4-variant `SlideContent` with a richer `SlideLayout` IR; keep old carousels renderable.
**Depends on:** Phase 1.
**Files:** `types.ts`, NEW `utils/slideMigration.ts`, `core/agents/TemplateAgent.ts`, `core/design/renderSlide.ts`, guards in `core/agents/agentConfigs.ts` / `applyIntentGuards`.
**Steps:**
1. `types.ts`: add `SlideLayout` — `{ blockType, slots:{ headline, preHeader, body, listItems, footer, accentPhrase, ... }, styleOverrides?, visual?:{ icon | doodle } }`. Keep `SlideContent` as a legacy shape.
2. `utils/slideMigration.ts`: adapter `SlideContent → SlideLayout` (and back if needed) so existing saved carousels still render.
3. `core/agents/TemplateAgent.ts`: emit `SlideLayout[]`, selecting a block per slide. Add new blocks to the vocabulary here once parity holds (e.g. `Stat`, `Quote`, `Split`) with matching renderers under `core/design/blocks/`.
4. `core/design/renderSlide.ts`: consume `SlideLayout` natively (route `blockType` → block renderer).
**Acceptance criteria:**
- New carousels created via `TemplateAgent` render correctly through the IR path.
- A pre-existing saved carousel (old `SlideContent`) loads and renders unchanged via the migration adapter.

---

## Phase 3 — The plan → execute → reflect loop (core change)

**Objective:** Replace the hardcoded sequence in the create job with a bounded reason-act-reflect loop.
**Depends on:** Phase 2.
**Files:** NEW `core/agents/CarouselPlanner.ts`, `worker/jobs/createCarouselJob.ts`; reuse `core/agents/{ResearchAgent,StrategistAgent,TemplateAgent,ArtDirectorAgent}.ts`, `worker/doodleGen.ts`, `applyIntentGuards`, `polishSlides`, `core/llm/langfuse.ts` (`runAgentSpan`).
**Steps:**
1. `core/agents/CarouselPlanner.ts` implementing `run()`:
   - **PLAN:** one scaffolded-JSON call → build plan `{ researchStrategy, approachMode, slideCount, perSlideBlockChoices, visualPlan }`, built from the existing `CreativeBrief`.
   - **EXECUTE:** run specialist agents as deterministic steps per plan — `ResearchAgent` (Tavily), `StrategistAgent`, per-block content via `TemplateAgent`, `ArtDirectorAgent` (T3 doodles via `worker/doodleGen.ts`). Apply `applyIntentGuards`, `polishSlides`, honesty guard.
   - **REFLECT:** one critique call scoring the assembled `SlideLayout[]` against the brief + hard invariants (slide count, format, brand, banned words) → emits targeted revision ops. Re-run EXECUTE **only for flagged slides**. **Cap loop at N=2 iterations.**
   - Maintain a **working-memory scratchpad** of observations across steps; feed it into REFLECT.
2. `worker/jobs/createCarouselJob.ts`: replace the 10-step sequence with `CarouselPlanner.run()` as driver. Keep all surrounding plumbing unchanged — Appwrite job doc, progress %, `createCarouselServer`/`saveChatServer`, Langfuse spans, rate limiting, queue.
3. Leave the edit path (`OrchestratorAgent` / `editCarouselJob.ts`) unchanged this phase.
**Acceptance criteria:**
- Creation runs end-to-end for a topic, a URL, and a PDF input via the worker; progress streams to the client via Appwrite Realtime.
- Hard invariants hold (slide count / format / brand / banned words).
- REFLECT measurably revises at least one weak slide in a test case; total LLM calls and latency are recorded and within a reasonable multiple of the old pipeline.

---

## Phase 4 — Structured memory

**Objective:** Upgrade flat `string[]` memory to typed structured memory; feed it into the loop.
**Depends on:** Phase 3.
**Files:** `services/memoryService.ts`, `lib/memoryServer.ts`, `core/agents/MemoryAgent.ts`, `core/agents/CarouselPlanner.ts`.
**Steps:**
1. Change persisted memory (Appwrite user prefs field `carouselMemory`) from `string[]` to typed JSON `{ brandRules[], bannedWords[], tonePrefs[], pastDecisions[] }`, with a migration from the old `string[]`.
2. `services/memoryService.ts` + `lib/memoryServer.ts`: read/write the structured shape; `rememberUserPreference` routes a note into the correct bucket.
3. `core/agents/MemoryAgent.ts`: keep chat compaction; additionally distill durable structured facts from a run.
4. Feed structured memory into PLAN and REFLECT in `CarouselPlanner`.
**Acceptance criteria:**
- Setting a preference ("never use emojis") is honored in a freshly created carousel.
- Old `string[]` memory migrates to the structured shape without data loss.

---

## Phase 5 — HTML as a deliverable

**Objective:** Let the user export a standalone HTML file of the carousel.
**Depends on:** Phase 1 (needs deterministic block HTML); can follow Phase 3/4.
**Files:** NEW `utils/htmlExporter.ts`, `components/artifact/ArtifactPanel.tsx`, reuse `utils/imageUtils.ts` (`embedImagesInSvg`).
**Steps:**
1. `utils/htmlExporter.ts`: serialize rendered slides into a standalone `.html` — inline theme CSS vars + fonts (`@font-face`/Google Fonts), embed images as base64 via `embedImagesInSvg`.
2. Add an "Export HTML" action next to the existing JPG/PDF/Figma buttons in `ArtifactPanel`.
**Acceptance criteria:**
- Exporting a deck produces a `.html` file that opens standalone in a browser with correct fonts, colors, and images, without the app running.

---

## Final end-to-end verification (after all phases)
Run worker + client together; create carousels for all 3 templates from a topic, a URL, and a PDF; confirm the plan→execute→reflect loop runs, invariants hold, memory is honored, and JPG/PDF/HTML exports all succeed.
