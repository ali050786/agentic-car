/**
 * Create pipeline v2.
 *
 *   gate ‖ memory ‖ research plan ‖ creative brief (when the client didn't send one)
 *     → web search → fact sheet (numbered, sourced)
 *     → outline (beat per slide, block per beat, facts per beat)
 *     → hook tournament ‖ writer (halves in parallel for 7+ slides)
 *     → validators + tighten (limits, banned terms, structure, accent) in code
 *     → grounding (numbers must exist in facts/source/request)
 *         ├─ moderation of the draft → preview in the studio
 *         ├─ template-3: sketch prompts + images
 *     → critic ⇄ targeted revision (one pass by default) ‖ proofread of the draft
 *     → proofread of revised slides ‖ moderation of revised words
 *     → save (hybrid slides keep stat/quote/split), thread, brief with sources
 *
 * Every model call carries a role (fast/planner/writer/creative/critic) that
 * decides model, temperature, budget and timeout (core/llm/models.ts). Every
 * step runs in its own trace span. Progress messages keep the PLAN/EXECUTE/
 * REFLECT prefixes the studio timeline already understands.
 */

import type { CreateJobPayload } from '../CarouselPlanner';
import type { CarouselTheme, ChatMessage, CreativeBrief, SlideContent, TemplateId } from '../../../types';
import type { CreateResultV2, DraftSlide, Fact, HookChoice, Issue, Outline, PipelineContext, SavedSlide, SourceRef } from './types';
import { withCancel, withSpan } from '../../llm/agentGateway';
import { GatekeeperAgent, type GateResult, slideTexts } from '../GatekeeperAgent';
import { ArtDirectorAgent } from '../ArtDirectorAgent';
import { getPresetById } from '../../../config/colorPresets';
import { resolveTheme } from '../../../utils/brandUtils';
import { buildFactSheet, planResearch, runSearch, type SearchResult } from './research';
import { buildOutline } from './outline';
import { runHookTournament } from './hooks';
import { applyHook, writeCover, writeSlides } from './writer';
import { bannedTerms, fixStructure, removeBannedTerms, stripEmoji, validateDeck } from './validate';
import { clampDeck, tightenDeck } from './tighten';
import { groundingIssues, numberPool } from './grounding';
import { reflectLoop, type ReflectOutcome } from './critic';
import { proofreadDeck } from './proofread';
import { draftToSaved } from './slides';
import type { PipelineStore, StoredBrief } from './persistence';
import { CreativeDirectorAgent, parseExplicitSlideCount } from '../CreativeDirectorAgent';

export interface CreateV2Options {
    /** Build everything but don't write to the store (evals). */
    dryRun?: boolean;
    /** Skip Replicate doodles (evals, tests). */
    skipImages?: boolean;
    skipGate?: boolean;
    skipModeration?: boolean;
    /** Critic passes (default 1). */
    maxReflectPasses?: number;
}

/** Slides to show while the deck is still being finished. */
export interface CreatePreview {
    /** 'draft': the first full draft. */
    stage: 'draft';
    slides: SavedSlide[];
    theme: CarouselTheme;
    templateId: TemplateId;
}

export interface CreateV2Params {
    jobId: string;
    userId: string;
    payload: CreateJobPayload;
    store: PipelineStore;
    progress: (statusMessage: string, progressPct: number) => Promise<void>;
    options?: CreateV2Options;
    /** Token/cost snapshot for the saved assistant message. */
    usage?: () => Record<string, number>;
    /** Called with draft slides once they pass moderation, so the studio can show them early. */
    preview?: (preview: CreatePreview) => Promise<void> | void;
}

export interface CreateV2Stats {
    pipeline: 'v2';
    score: number;
    dimensions: Record<string, number>;
    hookCandidates: number;
    hookScore: number;
    facts: number;
    sources: number;
    researched: boolean;
    revisedSlides: number[];
    /** Claims the fact check flagged in the draft (each sent to the revision). */
    factCheckFindings?: string[];
    rejectedRevisions: number;
    tightened: number;
    forcedFits: number;
    proofreadFixes: number;
    downgradedStats: number;
    issuesRemaining: number;
}

export type CreateV2Outcome =
    | { kind: 'refused'; gate: GateResult; stage: 'input' | 'output' }
    | { kind: 'done'; result: CreateResultV2; reply: string; stats: CreateV2Stats };

const clampCount = (n: unknown) => Math.max(2, Math.min(20, Math.round(Number(n) || 7)));

/** A usable brief when the Creative Director didn't run (API clients, evals). */
export const defaultBrief = (topic: string, language = 'English', count = 7): CreativeBrief => ({
    topic,
    contentType: 'EDUCATIONAL',
    suggestedSlideCount: count,
    outputLanguage: language,
    audience: { type: 'GENERAL', description: 'curious people who want the useful version fast' },
    creativeStyle: { toneDescription: 'clear, confident and specific', vocabulary: 'CASUAL', humorAllowed: false, popCultureAllowed: false },
    contentStrategy: { approachMode: 'FACTUAL_SPINE', mustStayOnTopic: true, businessMetaphorsAllowed: false, stayFactuallyAccurate: true },
    visualStyle: { illustrationMode: 'LITERAL', emotionToConvey: 'informed' },
});

export const wantsEmoji = (text: string) => /\bemoji/i.test(text);

/** A stat slide whose number can't be traced to our material becomes a plain slide. */
const downgradeStat = (d: DraftSlide) => {
    d.blockType = 'body';
    d.body = [d.statLabel, d.body].filter(Boolean).join('. ').replace(/\.\./g, '.');
    d.statNumber = undefined;
    d.statLabel = undefined;
};

export const buildBrief = (params: {
    premise: string;
    takeaway: string;
    brief: CreativeBrief;
    slides: SlideContent[];
    sources: SourceRef[];
    facts: Fact[];
}): StoredBrief => {
    const base: StoredBrief = {
        premise: params.premise.slice(0, 1200) || 'A focused carousel on the requested topic.',
        audience: params.brief.audience?.description?.trim() || 'a general audience',
        voice: params.brief.creativeStyle?.toneDescription?.trim() || 'clear, knowledgeable and helpful',
        keyPoints: params.slides.map((s) => (s.headline || '').trim()).filter(Boolean),
        takeaway: params.takeaway.slice(0, 400),
        sources: params.sources.slice(0, 8).map((s) => ({ title: s.title.slice(0, 120), url: s.url.slice(0, 300) })),
        facts: params.facts.map((f) => `[${f.id}] ${f.text}`),
        pipeline: 'v2',
        creative: {
            contentType: params.brief.contentType,
            approachMode: params.brief.contentStrategy?.approachMode,
            audienceType: params.brief.audience?.type,
            vocabulary: params.brief.creativeStyle?.vocabulary,
            humorAllowed: params.brief.creativeStyle?.humorAllowed,
            stayFactuallyAccurate: params.brief.contentStrategy?.stayFactuallyAccurate,
            language: params.brief.outputLanguage,
            emotion: params.brief.visualStyle?.emotionToConvey,
        },
    };
    // The brief attribute holds 8000 chars: drop facts first, then sources, until it fits.
    while (JSON.stringify(base).length > 7800 && base.facts && base.facts.length) base.facts.pop();
    while (JSON.stringify(base).length > 7800 && base.sources && base.sources.length) base.sources.pop();
    return base;
};

const replyFor = (n: number, stats: CreateV2Stats): string => {
    const bits: string[] = [];
    if (stats.sources) bits.push(`pulled ${stats.facts} facts from ${stats.sources} source${stats.sources === 1 ? '' : 's'}`);
    else if (stats.facts) bits.push(`grounded it in ${stats.facts} facts from your material`);
    if (stats.hookCandidates > 1) bits.push(`tested ${stats.hookCandidates} cover hooks`);
    if (stats.revisedSlides.length) bits.push(`tightened ${stats.revisedSlides.length} slide${stats.revisedSlides.length === 1 ? '' : 's'} after an editor review`);
    const how = bits.length ? ` I ${bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}.` : '';
    return `Your ${n}-slide carousel is ready.${how} Tell me what to change: a slide, the tone, the angle or the design.`;
};


export interface ComposeEnv {
    userText: string;
    pool: Set<string>;
    strictGrounding: boolean;
    maxReflectPasses: number;
    progress: (statusMessage: string, progressPct: number) => Promise<void>;
    /** Maps this stage's nominal progress (30-85) into the caller's range. */
    at?: (pct: number) => number;
    /** Skip the hook tournament (e.g. a regenerate that must keep the cover). */
    skipHook?: boolean;
    /** Wording for the first progress line (regenerate reuses this path). */
    outlineLabel?: string;
    /** The outline is ready: slow side work (the Design Director) can start. */
    onOutline?: (outline: Outline) => void;
    /** A complete, rule-checked first draft exists, before the editor review (a copy). */
    onDraft?: (drafts: DraftSlide[], hook: HookChoice | null) => void;
    /** The reviewed copy, just before the revised slides are proofread (a copy). */
    beforeProofread?: (drafts: DraftSlide[]) => void;
}

export interface Composed {
    drafts: DraftSlide[];
    outline: Outline;
    hook: HookChoice | null;
    reflect: ReflectOutcome;
    proof: { corrected: number; rejected: number };
    tightened: number;
    forcedFits: number;
    downgradedStats: number;
    remaining: Issue[];
}

const cloneDrafts = (drafts: DraftSlide[]) => drafts.map((d) => ({ ...d, listItems: d.listItems ? [...d.listItems] : undefined }));

const PROOF_FIELDS = ['preHeader', 'headline', 'body', 'footer', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight', 'accentPhrase'] as const;
const slideWords = (d: DraftSlide) => JSON.stringify([d.blockType, ...PROOF_FIELDS.map((k) => d[k] || ''), d.statNumber || '', d.listItems || []]);

/**
 * Outline → (hook tournament ‖ writer) → rules → grounding →
 * (critic ⇄ revision ‖ proofread) → proofread of revised slides.
 * Shared by create and by whole-deck regenerate edits, so both get the same
 * guarantees.
 *
 * What runs at the same time, and why it's safe:
 *  - The hook tournament and the writer both work from the outline. The
 *    writer drafts its own cover; the tournament's winner replaces it.
 *  - The proofreader checks the first draft while the editor reviews it.
 *    Slides the editor leaves alone keep those corrections; slides it rewrote
 *    are proofread again at the end (usually a few).
 */
export const composeDeck = async (ctx: PipelineContext, env: ComposeEnv): Promise<Composed> => {
    const { templateId, slideCount, outputLanguage, memory, facts } = ctx;
    const at = env.at || ((p: number) => p);
    const progress = (m: string, p: number) => env.progress(m, at(p));
    const { pool, strictGrounding, userText } = env;

    // ── PLAN: outline ───────────────────────────────────────────────────────
    await progress(env.outlineLabel || `PLAN: Outlining the story, beat by beat (${slideCount} slides)...`, 32);
    const outline = await withSpan('outline', { slideCount, facts: facts.length }, () => buildOutline(ctx));
    env.onOutline?.(outline);

    // ── EXECUTE: hook tournament ‖ writer ───────────────────────────────────
    await progress(env.skipHook ? 'EXECUTE: Writing every slide from the outline...' : 'EXECUTE: Writing every slide while a hook tournament picks the cover...', 40);
    const hookP = env.skipHook ? Promise.resolve<HookChoice | null>(null) : withSpan('hooks', { premise: outline.premise }, () => runHookTournament(ctx, outline));
    // The tournament writes the cover, so the writer starts at slide 2.
    const coverFromHook = !env.skipHook;
    const writerP = withSpan('writer', { beats: outline.beats.length }, () => writeSlides(ctx, outline, null, { coverFromHook }));
    const [hook, written] = await Promise.all([hookP, writerP]);
    let drafts = applyHook(written, hook);
    if (coverFromHook && !hook) drafts = await withSpan('writer.cover', {}, () => writeCover(ctx, outline, drafts));

    // ── EXECUTE: deterministic rules + tighten ──────────────────────────────
    await progress('EXECUTE: Enforcing limits, layouts & your brand rules...', 58);
    const { terms: banned, noEmoji } = bannedTerms(memory);
    const allowEmoji = !noEmoji && wantsEmoji(userText);
    const tidy = () => {
        drafts = fixStructure(drafts, templateId);
        if (!allowEmoji) drafts.forEach(stripEmoji);
    };
    tidy();
    let tightened = 0;
    let forcedFits = 0;
    const tightenPass = async (label: string) => {
        const issues = validateDeck(drafts, templateId, { banned });
        const t = await withSpan(label, { issues: issues.length }, () => tightenDeck(drafts, templateId, issues, { banned, outputLanguage }));
        tightened += t.rewritten;
        forcedFits += t.forced;
    };
    await tightenPass('tighten');

    // ── Grounding: numbers must come from our material ──────────────────────
    let downgradedStats = 0;
    const downgradeUnsupportedStats = () => {
        for (const iss of groundingIssues(drafts, pool, strictGrounding)) {
            const d = drafts[iss.index];
            if (iss.field === 'statNumber' && d?.blockType === 'stat') {
                downgradeStat(d);
                downgradedStats++;
            }
        }
    };
    downgradeUnsupportedStats();
    env.onDraft?.(cloneDrafts(drafts), hook);

    // ── REFLECT: critic ⇄ targeted revision ‖ proofread of the draft ────────
    await progress('REFLECT: Editor reviewing hook, flow, specificity & accuracy...', 66);
    const reviewed = cloneDrafts(drafts);
    const proofCopy = cloneDrafts(drafts);
    const proofP = withSpan('proofread', { slides: proofCopy.length }, () => proofreadDeck(proofCopy, templateId, outputLanguage));
    const reflectP = withSpan('reflect', { slides: drafts.length }, () =>
        reflectLoop(ctx, drafts, outline, {
            templateId,
            banned,
            pool,
            strictGrounding,
            hook,
            maxPasses: env.maxReflectPasses,
            onPass: (pass, total, flagged) => progress(`REFLECT: Revising ${flagged} slide${flagged === 1 ? '' : 's'}${total > 1 ? ` (pass ${pass}/${total})` : ''}...`, 70 + pass * 4),
        }));
    const [firstProof, reflect] = await Promise.all([proofP, reflectP]);
    drafts = reflect.drafts;
    tidy();
    await tightenPass('tighten.final');
    downgradeUnsupportedStats();

    // Slides nobody touched since the proofread take its corrections; the rest get proofread now.
    const changed: number[] = [];
    drafts.forEach((d, i) => {
        if (reviewed[i] && proofCopy[i] && slideWords(d) === slideWords(reviewed[i])) {
            const p = proofCopy[i];
            for (const k of PROOF_FIELDS) (d as any)[k] = p[k];
            d.listItems = p.listItems ? [...p.listItems] : undefined;
        } else {
            changed.push(i);
        }
    });

    // ── EXECUTE: proofread what the editor rewrote ──────────────────────────
    env.beforeProofread?.(cloneDrafts(drafts));
    let secondProof = { corrected: 0, rejected: 0 };
    if (changed.length) {
        await progress(`EXECUTE: Proofreading ${changed.length} revised slide${changed.length === 1 ? '' : 's'}...`, 82);
        secondProof = await withSpan('proofread.revised', { slides: changed.length }, () => proofreadDeck(drafts, templateId, outputLanguage, changed));
    }
    const proof = { corrected: firstProof.corrected + secondProof.corrected, rejected: firstProof.rejected + secondProof.rejected };
    forcedFits += clampDeck(drafts, templateId);
    drafts.forEach((d) => removeBannedTerms(d, banned));

    const remaining: Issue[] = [
        ...validateDeck(drafts, templateId, { count: slideCount, banned }),
        ...groundingIssues(drafts, pool, strictGrounding),
    ];

    return { drafts, outline, hook, reflect, proof, tightened, forcedFits, downgradedStats, remaining };
};

export const runCreatePipelineV2 = async (params: CreateV2Params): Promise<CreateV2Outcome> => {
    const { jobId, userId, payload, store, progress } = params;
    const opts = params.options || {};
    const templateId = (payload.selectedTemplate || 'template-1') as TemplateId;
    const sourceContent = (payload.sourceContent || '').trim();
    const userText = [payload.topic, payload.userMessage, payload.customInstructions].filter(Boolean).join('\n');
    const requestText = payload.userMessage || payload.topic;
    // No brief from the client: the Creative Director runs here, next to the gate and research.
    const needBrief = !payload.creativeBrief && !!payload.briefInWorker;
    let outputLanguage = payload.creativeBrief?.outputLanguage || payload.outputLanguage || 'English';
    let brief: CreativeBrief = payload.creativeBrief || defaultBrief(payload.topic, outputLanguage, clampCount(payload.slideCount));
    let slideCountNote = '';
    const ALLOWED: GateResult = { allowed: true, category: 'ok', reason: '' };
    const quiet = <T>(p: Promise<T>) => { p.catch(() => undefined); return p; };

    // ── PLAN: gate ‖ memory ‖ creative brief ‖ research ─────────────────────
    await progress(needBrief ? 'PLAN: Reading your request & loading your preferences...' : 'PLAN: Checking your request & loading your preferences...', 8);
    const gateP = quiet(opts.skipGate
        ? Promise.resolve<GateResult>(ALLOWED)
        : withSpan('gate', { topic: payload.topic }, () => GatekeeperAgent.gate({ topic: payload.topic, sourceContent })));
    const memoryP = quiet(store.loadMemory(userId).catch(() => ({ brandRules: [], bannedWords: [], tonePrefs: [], pastDecisions: [] })));
    const briefP = quiet(needBrief
        ? withSpan('creativeDirector', { topic: payload.topic }, () =>
            CreativeDirectorAgent.synthesiseBrief(requestText, 'No extra answers. Use sensible defaults for anything unstated.', sourceContent))
        : Promise.resolve<CreativeBrief | null>(null));
    const researchP = quiet((async () => {
        // With the brief still being written, the plan works from a neutral one;
        // the search itself waits for the real brief (entertainment skips it).
        const plan = await withSpan('research.plan', { topic: payload.topic }, () => planResearch(payload.topic, sourceContent, brief));
        if (!plan.needsResearch) return { plan, results: [] as SearchResult[] };
        const finalBrief = (await briefP) || brief;
        if (finalBrief.contentType === 'ENTERTAINMENT' && !finalBrief.contentStrategy?.stayFactuallyAccurate) {
            return { plan: { ...plan, needsResearch: false }, results: [] as SearchResult[] };
        }
        await progress(`EXECUTE: Researching ${plan.queries.length} angle${plan.queries.length === 1 ? '' : 's'} for facts & sources...`, 16);
        const deep = !!finalBrief.contentStrategy?.stayFactuallyAccurate && finalBrief.contentType !== 'ENTERTAINMENT';
        const results = await withSpan('research.search', { queries: plan.queries }, () => runSearch(plan.queries, deep));
        return { plan, results };
    })());

    const gate = await gateP;
    if (!gate.allowed) return { kind: 'refused', gate, stage: 'input' };
    const [memory, cdBrief, research] = await Promise.all([memoryP, briefP, researchP]);
    if (cdBrief) {
        brief = cdBrief;
        outputLanguage = cdBrief.outputLanguage || payload.outputLanguage || 'English';
        // "N slides" in the request always wins over the Creative Director's estimate.
        const asked = parseExplicitSlideCount(requestText);
        if (asked !== null) {
            brief.suggestedSlideCount = clampCount(asked);
            if (asked < 2) slideCountNote = 'The minimum is 2 slides, so I made 2.';
            else if (asked > 20) slideCountNote = 'The maximum is 20 slides, so I made 20. We can always add more.';
        }
    }
    const slideCount = clampCount(brief.suggestedSlideCount ?? payload.slideCount);
    const researchPlan = research.plan;

    // ── EXECUTE: research → fact sheet ──────────────────────────────────────
    let facts: Fact[] = [];
    let sources: SourceRef[] = [];
    if (researchPlan.needsResearch) {
        await progress('EXECUTE: Distilling a verified fact sheet...', 24);
        ({ facts, sources } = await withSpan('research.facts', { results: research.results.length }, () =>
            buildFactSheet({ topic: payload.topic, sourceContent, results: research.results })));
    } else if (sourceContent.length >= 300) {
        await progress('EXECUTE: Extracting the key facts from your material...', 20);
        ({ facts, sources } = await withSpan('research.facts', { source: sourceContent.length }, () =>
            buildFactSheet({ topic: payload.topic, sourceContent, results: [] })));
    }

    const ctx: PipelineContext = {
        topic: payload.topic,
        brief,
        templateId,
        slideCount,
        outputLanguage,
        sourceContent,
        memory,
        facts,
        customInstructions: payload.customInstructions || undefined,
    };

    // Ground truth is what the writer was given: the fact sheet, the user's source and request.
    // Raw search text is not: a number that is only in a search snippet never reached the writer,
    // so a slide that has it made it up (and matched by coincidence).
    const pool = numberPool(facts, sourceContent, userText);
    const strictGrounding = !!brief.contentStrategy?.stayFactuallyAccurate && brief.contentType !== 'ENTERTAINMENT';

    // ── Theme ───────────────────────────────────────────────────────────────
    const preset = getPresetById(payload.presetId || 'ocean-tech') || getPresetById('ocean-tech');
    const theme: CarouselTheme = preset ? resolveTheme(preset.seeds, templateId) : (payload.existingTheme as CarouselTheme);

    // ── Work that overlaps the copy: sketches, moderation, preview ──
    const wantsImages = templateId === 'template-3' && !opts.skipImages;
    const seed = Math.abs(Array.from(jobId).reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 0));
    const moderate = (label: string, texts: string[]) => (opts.skipModeration || !texts.length
        ? Promise.resolve<GateResult>(ALLOWED)
        : withSpan(label, { texts: texts.length }, () => GatekeeperAgent.moderateOutput(texts)));
    const toSaved = (list: DraftSlide[]) => list.map((d, i) => draftToSaved(d, templateId, i));

    let finished = false;
    const emitPreview = async (stage: CreatePreview['stage'], list: DraftSlide[]) => {
        if (!params.preview || finished) return;
        try {
            await params.preview({ stage, slides: toSaved(list), theme, templateId });
        } catch (err) {
            console.warn('[v2.create] preview failed (ignored):', err);
        }
    };

    let draftSnapshot: DraftSlide[] = [];
    let earlyModP: Promise<GateResult> = Promise.resolve(ALLOWED);
    let deltaModP: Promise<GateResult> = Promise.resolve(ALLOWED);
    let imagesP: Promise<{ url?: string; prompt: string }[]> | null = null;
    let refuse: ((g: GateResult) => void) | null = null;
    const refusedP = new Promise<GateResult>((resolve) => { refuse = resolve; });

    const onDraft = (draft: DraftSlide[], _hook: HookChoice | null) => {
        draftSnapshot = draft;
        earlyModP = quiet(moderate('moderate.draft', slideTexts(toSaved(draft))));
        void earlyModP.then((g) => { if (!g.allowed) refuse?.(g); });

        if (wantsImages) {
            // Sketch prompts and images start on the draft (after it passes moderation), alongside the review.
            imagesP = quiet(earlyModP.then(async (g) => {
                if (!g.allowed) return [];
                const saved = toSaved(draft);
                const prompts = await withSpan('artDirector', { slides: saved.length }, () =>
                    ArtDirectorAgent.generatePrompts(saved as SlideContent[], (draftOutline?.premise) || payload.topic)
                        .catch(() => saved.map((x) => x.doodlePrompt || '')));
                const out: { url?: string; prompt: string }[] = prompts.map((p) => ({ prompt: p || '' }));
                const queue = prompts.map((p, i) => ({ p, i })).filter((x) => !!x.p);
                const worker = async () => {
                    for (let next = queue.shift(); next; next = queue.shift()) {
                        const { p, i } = next;
                        try {
                            out[i].url = await withSpan('doodle', { index: i }, () => store.generateDoodle(p, '2:3', seed % 2_147_483_647));
                        } catch (err) {
                            if (/cancel/i.test(String((err as any)?.message || err))) throw err;
                            console.error(`[v2.create] doodle ${i + 1} failed:`, err);
                        }
                    }
                };
                await Promise.all(Array.from({ length: Math.min(3, Math.max(1, queue.length)) }, worker));
                return out;
            }));
        }

        // The draft on screen once it has passed moderation.
        void earlyModP.then(async (g) => {
            if (!g.allowed || finished) return;
            await emitPreview('draft', draft);
        }).catch(() => undefined);
    };

    const beforeProofread = (reviewed: DraftSlide[]) => {
        // Words that changed since the draft was moderated are checked now, alongside the last proofread.
        const changed = reviewed.map((_, i) => i).filter((i) => !draftSnapshot[i] || slideWords(reviewed[i]) !== slideWords(draftSnapshot[i]));
        deltaModP = quiet(moderate('moderate.revised', slideTexts(changed.map((i) => draftToSaved(reviewed[i], templateId, i)))));
    };

    let draftOutline: Outline | null = null;
    // Once the pipeline has decided (refused, or finished), leftover side work stops at its next call.
    const composedP = quiet(withCancel(() => finished, () => composeDeck(ctx, {
        userText,
        pool,
        strictGrounding,
        maxReflectPasses: opts.maxReflectPasses ?? 1,
        progress,
        onOutline: (o) => { draftOutline = o; },
        onDraft,
        beforeProofread,
    })));
    const first = await Promise.race([composedP.then((c) => ({ c })), refusedP.then((g) => ({ g }))]);
    if ('g' in first) {
        finished = true;
        return { kind: 'refused', gate: first.g, stage: 'output' };
    }
    const composed = first.c;
    const { outline, hook, reflect, proof, tightened, forcedFits, downgradedStats, remaining } = composed;
    let { drafts } = composed;

    // ── Sketches (template-3): started on the draft ─────────────────────────
    if (wantsImages && imagesP) {
        await progress('Art Director: finishing the sketches...', 88);
        const images = await imagesP;
        images.forEach((img, i) => {
            if (!drafts[i]) return;
            drafts[i].doodlePrompt = img.prompt || drafts[i].doodlePrompt;
            if (img.url) drafts[i].doodleUrl = img.url;
        });
    }

    // ── Moderation: the draft was checked early; revised words now ─────────
    const [early, delta] = await Promise.all([earlyModP, deltaModP]);
    const blocked = [early, delta].find((g) => !g.allowed);
    if (blocked) {
        finished = true;
        return { kind: 'refused', gate: blocked, stage: 'output' };
    }
    finished = true;
    const saved = toSaved(drafts);

    const stats: CreateV2Stats = {
        pipeline: 'v2',
        score: reflect.critique.score,
        dimensions: reflect.critique.dimensions,
        hookCandidates: hook?.candidates || 0,
        hookScore: hook?.score || 0,
        facts: facts.length,
        sources: sources.length,
        researched: researchPlan.needsResearch,
        revisedSlides: reflect.revised.map((i) => i + 1),
        factCheckFindings: reflect.factIssues.map((i) => `Slide ${i.index + 1}${i.field ? ` (${i.field})` : ''}: ${i.message}`),
        rejectedRevisions: reflect.rejected,
        tightened,
        forcedFits,
        proofreadFixes: proof.corrected,
        downgradedStats,
        issuesRemaining: remaining.length,
    };
    const reply = `${slideCountNote ? `${slideCountNote} ` : ''}${replyFor(saved.length, stats)}`;

    // ── Save ────────────────────────────────────────────────────────────────
    let carouselId = 'dry-run';
    let versionId: string | undefined;
    const assistantMessageId = `msg-${Date.now()}-a`;
    if (!opts.dryRun) {
        await progress('Saving carousel & finalizing...', 95);
        carouselId = await store.createCarousel({
            userId,
            title: payload.topic.length > 80 ? `${payload.topic.slice(0, 77)}…` : payload.topic,
            templateId,
            theme,
            slides: saved as SlideContent[],
            brandMode: payload.brandMode,
            presetId: payload.presetId,
            brandKit: payload.brandKit,
            signaturePosition: payload.signaturePosition,
            format: payload.format,
            selectedPattern: payload.selectedPattern,
            patternOpacity: payload.patternOpacity,
        });

        // Restore point: the deck as created, so the studio can always go back to it.
        versionId = (await store.saveVersion(carouselId, userId, {
            slides: saved as SlideContent[], theme, templateId, format: payload.format, presetId: payload.presetId,
            selectedPattern: payload.selectedPattern, signaturePosition: payload.signaturePosition, brandMode: payload.brandMode,
            label: 'Created the carousel', kind: 'point',
        }).catch(() => null)) || undefined;

        // Best-effort: a thread/brief write must never fail a finished create.
        const turn: ChatMessage[] = [
            { id: `msg-${Date.now()}-u`, role: 'user', text: payload.userMessage || payload.topic },
            { id: assistantMessageId, role: 'assistant', text: reply, tokenUsage: params.usage?.() as any, ...(versionId ? { versionId } : {}) },
        ];
        await Promise.all([
            (async () => {
                for (const m of turn) await store.appendMessage(carouselId, userId, m).catch((err) => console.warn('[v2.create] thread write failed:', err));
            })(),
            store
                .saveBrief(carouselId, userId, buildBrief({ premise: outline.premise, takeaway: outline.takeaway, brief, slides: saved as SlideContent[], sources, facts }))
                .catch((err) => console.warn('[v2.create] brief write failed:', err)),
        ]);
    }

    return {
        kind: 'done',
        reply,
        stats,
        result: {
            carouselId,
            slides: saved,
            theme,
            outline,
            facts,
            sources,
            critique: reflect.critique,
            hook: hook || undefined,
            issuesRemaining: remaining,
            ...(versionId ? { versionId, messageId: assistantMessageId } : {}),
        },
    };
};
