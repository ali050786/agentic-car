/**
 * Edit pipeline v2: one message → a plan of one or more actions → executors.
 *
 * v1 classified every message into exactly ONE intent, so "switch to the
 * sketch template and make the hook punchier" did half the job. It also ran
 * the safety check before loading anything (serial latency), rewrote copy with
 * prose limits, uppercased headlines on templates that use sentence case, saved
 * before moderating (then reverted), and had no undo.
 *
 * v2:
 *  - safety check ‖ (load deck/thread/brief/memory → plan)
 *  - the planner returns an ordered list of actions (copy, design, structure,
 *    regenerate, image, undo, answer) plus an optional memory note
 *  - each executor re-uses the create pipeline's guarantees: limits from the
 *    same table, banned terms, accent, block-aware slides, grounding notes
 *  - template switches re-fit the copy to the new template's limits and blocks
 *  - moderation runs BEFORE saving; every reply that changes the deck saves a
 *    restore point (the deck right after it), so the studio can put the
 *    carousel back to any reply, and "undo" walks back through them
 *  - the honesty guard still refuses to claim changes that didn't happen
 */

import type { CarouselFormat, CarouselTheme, ChatMessage, ChatRunEvent, CreativeBrief, StructuredMemory, TemplateId, TokenUsage } from '../../../types';
import { UNDO_RE, previousPoint, restorePoints } from '../undo';
import type { BlockKind, DraftSlide, Fact, PipelineContext } from './types';
import { withSpan } from '../../llm/agentGateway';
import { GatekeeperAgent, type GateResult, slideTexts } from '../GatekeeperAgent';
import { ArtDirectorAgent, buildFluxPrompt } from '../ArtDirectorAgent';
import { HONESTY_GUARD_REPLY, messageHeuristics, parseDesignActionsFallback, type DesignAction } from '../guards';
import { getPresetById, getPresetIds } from '../../../config/colorPresets';
import { resolveTheme } from '../../../utils/brandUtils';
import { allowedBlocks, limitsForPrompt } from './limits';
import { ask, briefBlock, factsBlock, languageRule, memoryBlock, untrusted } from './prompting';
import { asList, asText, draftToSaved, draftText, dumpDraft, savedToDraft } from './slides';
import { bannedTerms, fixAccent, fixStructure, removeBannedTerms, stripEmoji, validateDeck } from './validate';
import { clampDeck, tightenDeck } from './tighten';
import { groundingIssues, numberPool } from './grounding';
import { proofreadDeck } from './proofread';
import { SLIDES_SCHEMA } from './writer';
import { composeDeck, defaultBrief, wantsEmoji } from './createPipeline';
import type { PipelineStore, StoredBrief } from './persistence';
import { stampTheme } from '../../../utils/templateConverter';

export type EditActionType = 'copy' | 'design' | 'structure' | 'regenerate' | 'image' | 'undo' | 'answer';

export interface EditV2Params {
    carouselId: string;
    userId: string;
    message: string;
    selectedSlideIndices?: number[];
    /** Rolling summary of older turns, kept by the client. */
    conversationSummary?: string;
    store: PipelineStore;
    progress: (statusMessage: string, progressPct: number) => Promise<void>;
    options?: { dryRun?: boolean; skipImages?: boolean; skipSafety?: boolean };
    /** The user restored the carousel to this reply in the studio: later messages are dropped first. */
    restoredTo?: string;
    /** Ids the studio already shows for this turn's messages, so they stay the same once saved. */
    messageIds?: { user?: string; assistant?: string };
    /** The turn's activity and token usage, saved with the reply. */
    turnEvents?: () => ChatRunEvent[] | undefined;
    usage?: () => TokenUsage | undefined;
}

export interface EditResultV2 {
    carouselId: string;
    slides: ReturnType<typeof draftToSaved>[];
    theme: CarouselTheme;
    templateId: TemplateId;
    /** Primary intent, for v1-compatible consumers. */
    intent: EditActionType;
    actions: EditActionType[];
    reply: string;
    changedIndices: number[];
    slidesChanged: boolean;
    designActions: DesignAction[];
    memoryNote: { note: string; category: keyof StructuredMemory } | null;
    refused?: GateResult;
    /** Restore point for this reply: the deck right after it (unset when nothing changed). */
    versionId?: string;
    /** The reply's message id in the thread. */
    messageId?: string;
    /** Older clients: true when this reply has a restore point. */
    undoable: boolean;
}

// ── Planning ─────────────────────────────────────────────────────────────────

const PLAN_SCHEMA = {
    type: 'object',
    properties: {
        actions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['copy', 'design', 'structure', 'regenerate', 'image', 'undo', 'answer'] },
                    slides: { type: 'array', items: { type: 'number' } },
                    instruction: { type: 'string' },
                    design: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                action: { type: 'string', enum: ['set_template', 'set_format', 'set_preset', 'set_pattern', 'set_signature_position'] },
                                value: { type: 'string' },
                            },
                            required: ['action', 'value'],
                        },
                    },
                    removeSlides: { type: 'array', items: { type: 'number' } },
                    insertAfter: { type: 'number' },
                    insertAbout: { type: 'string' },
                    targetSlideCount: { type: 'number' },
                    imageBrief: { type: 'string' },
                    imageSlide: { type: 'number' },
                },
                required: ['type'],
            },
        },
        reply: { type: 'string' },
        memory: {
            type: 'object',
            properties: {
                note: { type: 'string' },
                category: { type: 'string', enum: ['brandRules', 'bannedWords', 'tonePrefs', 'pastDecisions'] },
            },
        },
    },
    required: ['actions', 'reply'],
};

export interface PlannedAction {
    type: EditActionType;
    slides?: number[];
    instruction?: string;
    design?: DesignAction[];
    removeSlides?: number[];
    insertAfter?: number;
    insertAbout?: string;
    targetSlideCount?: number;
    imageBrief?: string;
    imageSlide?: number;
}

export interface EditPlan {
    actions: PlannedAction[];
    reply: string;
    memory?: { note?: string; category?: keyof StructuredMemory };
}

const POLITE_ASK_RE = /^\s*(can|could|would|will) you\b|^\s*please\b/i;
const EDIT_VERB_RE = /\b(rewrite|re-write|rephrase|reword|change|make|shorten|lengthen|expand|add|insert|remove|delete|drop|switch|replace|fix|update|turn|move|swap|redo|regenerate|redraw|tighten|simplify|translate)\b/i;
const COMMAND_START_RE = /^\s*(please\s+)?(rewrite|re-write|rephrase|reword|change|make|shorten|lengthen|expand|add|insert|remove|delete|drop|switch|replace|fix|update|turn|move|swap|redo|regenerate|redraw|tighten|simplify|translate|use)\b/i;

/** Deterministic memory backstop for explicit "never use X" style instructions. */
export const memoryFromMessage = (message: string): { note: string; category: keyof StructuredMemory } | null => {
    const m = message.match(/\b(?:never|don'?t|do not|stop)\s+(?:ever\s+)?(?:use|using|say|saying|write|writing)\s+(?:the\s+(?:word|phrase|term)\s+)?["'“‘]?([^"'”’.,!?\n]{2,40})["'”’]?/i);
    if (m && /\b(never|always|ever|again|anymore|any more|in future|from now on|stop)\b/i.test(message)) {
        const term = m[1].trim().replace(/\s+(again|anymore|ever|in future|from now on)$/i, '');
        if (/emoji/i.test(term)) return { note: 'No emojis', category: 'bannedWords' };
        return { note: term, category: 'bannedWords' };
    }
    return null;
};

const designOptions = () => `Design values you can set:
- set_template: template-1 (The Truth: bold, modern, clean), template-3 (The Sketch: hand-drawn sketch doodles), template-4 (The Statement: typographic statement)
- set_format: portrait | square
- set_preset (color palette): ${getPresetIds().join(', ')}
- set_pattern: 1-12 (background pattern)
- set_signature_position: bottom-left | top-left | top-right`;

export const planEdit = async (params: {
    message: string;
    drafts: DraftSlide[];
    templateId: TemplateId;
    selected: number[];
    brief: StoredBrief | null;
    memory: StructuredMemory;
    history: string;
    summary: string;
}): Promise<EditPlan> => {
    const { message, drafts, templateId, selected } = params;
    const sel = selected.map((i) => i + 1);
    const prompt = `You plan edits inside a carousel studio. Read the user's message and return the ordered list of actions that does EVERYTHING it asks. You don't write slide copy here; executors do.

${params.brief ? `CAROUSEL BRIEF:\n- Premise: ${params.brief.premise}\n- Audience: ${params.brief.audience}\n- Voice: ${params.brief.voice}` : ''}
${memoryBlock(params.memory)}
${params.summary ? `EARLIER CONVERSATION (summary):\n${params.summary.slice(0, 1500)}` : ''}
RECENT CONVERSATION:
${params.history || '(none yet)'}

CURRENT DECK (template ${templateId}, ${drafts.length} slides${sel.length ? `; the user has slide${sel.length > 1 ? 's' : ''} ${sel.join(', ')} selected` : ''}):
${drafts.map(dumpDraft).join('\n')}

${designOptions()}

${untrusted('user_message', message, 2000)}

Action types:
- copy: change the text of specific slides that stay in place. "slides" = 1-based numbers${sel.length ? ` (default to the selected slide${sel.length > 1 ? 's' : ''} unless the message clearly means others)` : ''}; empty = every slide. "instruction" = exactly what to change on them.
- design: visual settings. Fill "design" with the settings above.
- structure: remove specific slides ("removeSlides", 1-based) and/or add ONE new slide ("insertAfter" = 1-based slide it follows, "insertAbout" = what it should say). Use one structure action per new slide.
- regenerate: rebuild the WHOLE deck: a new length ("make it 10 slides", "shorter"), much more depth, a new angle, or a tone change across every slide. "targetSlideCount" (2-20; keep the current count unless asked) and "instruction".
- image: template-3 only. Redraw one slide's sketch. "imageSlide" (1-based) and "imageBrief" (the scene: one person, one oversized object, one action).
- undo: revert the previous change.
- answer: a question or discussion. Change nothing.
Rules:
- Multiple requests → multiple actions, in the order given. Don't add actions the user didn't ask for.
- Prefer copy over regenerate when only some slides need to change.
- "reply": one or two short sentences to the user, first person. For answer, the actual answer. Otherwise say what you're changing. Plain words, no em dashes.
- "memory": ONLY when the user states a lasting preference for future carousels (e.g. "never use the word X", "always keep it casual", "our brand color is teal"). category: bannedWords (words/emoji to avoid), tonePrefs (voice/style), brandRules (brand facts), pastDecisions (other). Otherwise omit it.

Return JSON: { "actions": [ { "type", ... } ], "reply": string, "memory"?: { "note", "category" } }`;

    try {
        const r = await ask<EditPlan>({ role: 'planner', label: 'edit.plan' }, prompt, PLAN_SCHEMA);
        const actions = (r.actions || []).filter((a) => a && typeof a.type === 'string');
        return { actions: actions.length ? actions : [{ type: 'answer' }], reply: String(r.reply || '').trim(), memory: r.memory };
    } catch (err) {
        console.warn('[v2.edit] planning failed:', err);
        return { actions: [], reply: '' };
    }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEMPLATES: TemplateId[] = ['template-1', 'template-3', 'template-4'];
/** Template names users say ("the sketch") → ids. */
const TEMPLATE_NAMES: [RegExp, TemplateId][] = [[/truth/, 'template-1'], [/sketch/, 'template-3'], [/statement/, 'template-4']];

export const sanitizeDesign = (actions: DesignAction[] = []): DesignAction[] => {
    const presets = new Set(getPresetIds());
    const out: DesignAction[] = [];
    for (const a of actions) {
        if (!a || typeof a.value !== 'string') continue;
        const v = a.value.trim().toLowerCase();
        if (a.action === 'set_template') {
            const named = TEMPLATE_NAMES.find(([re]) => re.test(v))?.[1];
            const t = (named || v.replace(/^template\s*-?\s*/, 'template-')) as TemplateId;
            if (TEMPLATES.includes(t)) out.push({ action: 'set_template', value: t });
        } else if (a.action === 'set_format' && (v === 'portrait' || v === 'square')) {
            out.push({ action: 'set_format', value: v });
        } else if (a.action === 'set_preset' && presets.has(v.replace(/\s+/g, '-'))) {
            out.push({ action: 'set_preset', value: v.replace(/\s+/g, '-') });
        } else if (a.action === 'set_pattern' && Number(v) >= 1 && Number(v) <= 12) {
            out.push({ action: 'set_pattern', value: String(Math.round(Number(v))) });
        } else if (a.action === 'set_signature_position' && ['bottom-left', 'top-left', 'top-right'].includes(v.replace(/\s+/g, '-'))) {
            out.push({ action: 'set_signature_position', value: v.replace(/\s+/g, '-') });
        }
    }
    // Last write wins per setting.
    return Array.from(new Map(out.map((a) => [a.action, a])).values());
};

const factsFromBrief = (brief: StoredBrief | null): Fact[] =>
    (brief?.facts || []).map((line, i) => {
        const m = line.match(/^\[(F\d+)\]\s*(.*)$/);
        return { id: m ? m[1] : `F${i + 1}`, text: (m ? m[2] : line).trim(), origin: 'source' as const };
    }).filter((f) => f.text);

const creativeFromBrief = (brief: StoredBrief | null, topic: string, count: number): CreativeBrief => {
    const c = brief?.creative || {};
    const base = defaultBrief(topic, c.language || 'English', count);
    return {
        ...base,
        contentType: (c.contentType as CreativeBrief['contentType']) || base.contentType,
        audience: { type: (c.audienceType as CreativeBrief['audience']['type']) || base.audience.type, description: brief?.audience || base.audience.description },
        creativeStyle: {
            ...base.creativeStyle,
            toneDescription: brief?.voice || base.creativeStyle.toneDescription,
            vocabulary: (c.vocabulary as CreativeBrief['creativeStyle']['vocabulary']) || base.creativeStyle.vocabulary,
            humorAllowed: c.humorAllowed ?? base.creativeStyle.humorAllowed,
        },
        contentStrategy: {
            ...base.contentStrategy,
            approachMode: (c.approachMode as CreativeBrief['contentStrategy']['approachMode']) || base.contentStrategy.approachMode,
            stayFactuallyAccurate: c.stayFactuallyAccurate ?? base.contentStrategy.stayFactuallyAccurate,
        },
        visualStyle: { ...base.visualStyle, emotionToConvey: c.emotion || base.visualStyle.emotionToConvey },
    };
};

const sameDraft = (a: DraftSlide, b: DraftSlide) => draftText(a) === draftText(b) && a.blockType === b.blockType && (a.accentPhrase || '') === (b.accentPhrase || '');

const cloneDraft = (d: DraftSlide): DraftSlide => ({ ...d, listItems: d.listItems ? [...d.listItems] : undefined, factIds: d.factIds ? [...d.factIds] : undefined });

const seedFrom = (s: string) => Math.abs(Array.from(s).reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 0)) % 2_147_483_647;

// ── Executors ────────────────────────────────────────────────────────────────

interface EditEnv {
    ctx: PipelineContext;
    banned: string[];
    allowEmoji: boolean;
    pool: Set<string>;
}

/**
 * Rewrites the given slides (0-based) per the instruction, keeping block types.
 * `notes` adds a per-slide instruction (used for newly inserted slides).
 * Returns the indices that actually changed.
 */
export const rewriteSlides = async (
    env: EditEnv,
    drafts: DraftSlide[],
    targets: number[],
    instruction: string,
    notes: Map<number, string> = new Map(),
): Promise<number[]> => {
    const { ctx } = env;
    const all = targets.length ? targets : drafts.map((_, i) => i);
    const chunks: number[][] = [];
    for (let i = 0; i < all.length; i += 6) chunks.push(all.slice(i, i + 6));
    const before = drafts.map(cloneDraft);

    const results = await Promise.all(chunks.map(async (chunk) => {
        const blocks = Array.from(new Set(chunk.map((i) => drafts[i].blockType))) as BlockKind[];
        const prompt = `Edit an existing carousel. Change ONLY the slides listed under SLIDES TO EDIT, exactly as the user asked. Keep everything they didn't ask to change.

${briefBlock(ctx.brief, ctx.topic)}
${memoryBlock(ctx.memory)}
${factsBlock(ctx.facts)}

FULL DECK (for context):
${drafts.map(dumpDraft).join('\n')}

THE USER'S REQUEST:
${untrusted('request', instruction, 1500)}

SLIDES TO EDIT:
${chunk.map((i) => `Slide ${i + 1} [${drafts[i].blockType}]${notes.has(i) ? `: NEW SLIDE, write it about: ${notes.get(i)}` : ''}`).join('\n')}

LIMITS (hard, count characters):
${limitsForPrompt(ctx.templateId, blocks)}

Rules:
- Keep each slide's blockType and its role in the story. Don't repeat points made on other slides.
- Numbers, statistics and quotes only from FACTS or already in the deck.
- Headlines in sentence case. accentPhrase: 1-3 words copied EXACTLY from the new headline.
- No hashtags${env.allowEmoji ? '' : ', no emojis'}. ${languageRule(ctx.outputLanguage)}

Return JSON: { "slides": [ { "index" (1-based), "preHeader", "headline", "body", "listItems", "footer", "accentPhrase", "statNumber", "statLabel", "quoteAuthor", "splitLeft", "splitRight", "icon" } ] } with one entry per slide to edit.`;
        try {
            const r = await ask<{ slides: any[] }>({ role: 'writer', label: 'edit.copy', temperature: 0.6 }, prompt, SLIDES_SCHEMA);
            return (r?.slides || []).map((row, pos) => ({ row, fallback: chunk[pos], chunk }));
        } catch (err) {
            console.warn('[v2.edit] copy rewrite failed:', err);
            return [];
        }
    }));

    const touched = new Set<number>();
    for (const { row, fallback, chunk } of results.flat()) {
        let i = Number(row?.index) - 1;
        // A valid slide number outside the chunk is the model editing something it
        // wasn't asked to: ignore it. Only a missing/garbled index falls back to position.
        if (Number.isInteger(i) && i >= 0 && i < drafts.length && !chunk.includes(i)) continue;
        if (!chunk.includes(i)) i = chunk.length === 1 ? chunk[0] : fallback;
        if (i === undefined || !drafts[i] || !(asText(row?.headline) || '').trim()) continue;
        const old = drafts[i];
        const pick = (k: string) => { const t = asText(row[k])?.trim(); return t ? t : (old as any)[k]; };
        // Mutate in place: callers track slides by identity across structure changes.
        Object.assign(old, {
            preHeader: pick('preHeader'),
            headline: (asText(row.headline) || '').trim(),
            body: pick('body'),
            listItems: asList(row.listItems) || old.listItems,
            footer: pick('footer'),
            accentPhrase: asText(row.accentPhrase) || old.accentPhrase,
            statNumber: pick('statNumber'),
            statLabel: pick('statLabel'),
            quoteAuthor: pick('quoteAuthor'),
            splitLeft: pick('splitLeft'),
            splitRight: pick('splitRight'),
            icon: asText(row.icon) || old.icon,
        });
        fixAccent(old);
        touched.add(i);
    }
    if (!touched.size) return [];

    // Same guarantees as create, scoped to what changed.
    const idx = Array.from(touched);
    if (!env.allowEmoji) idx.forEach((i) => stripEmoji(drafts[i]));
    const issues = validateDeck(drafts, ctx.templateId, { banned: env.banned }).filter((x) => touched.has(x.index));
    await tightenDeck(drafts, ctx.templateId, issues, { banned: env.banned, outputLanguage: ctx.outputLanguage });
    const subset = idx.map((i) => drafts[i]);
    await proofreadDeck(subset, ctx.templateId, ctx.outputLanguage);
    idx.forEach((i, k) => { drafts[i] = subset[k]; removeBannedTerms(drafts[i], env.banned); });
    clampDeck(drafts, ctx.templateId, touched);
    return idx.filter((i) => !before[i] || !sameDraft(before[i], drafts[i])).sort((a, b) => a - b);
};

/** Re-fits a deck to another template's blocks and limits (on template switch). */
export const refitForTemplate = async (env: EditEnv, drafts: DraftSlide[], to: TemplateId): Promise<DraftSlide[]> => {
    const allowed = new Set(allowedBlocks(to));
    const next = fixStructure(drafts.map((d) => {
        const c = cloneDraft(d);
        if (!allowed.has(c.blockType)) c.blockType = 'body';
        return c;
    }), to);
    const issues = validateDeck(next, to, { banned: env.banned }).filter((i) => i.code === 'over_limit');
    if (issues.length) await tightenDeck(next, to, issues, { banned: env.banned, outputLanguage: env.ctx.outputLanguage });
    clampDeck(next, to);
    return next;
};

// ── The turn ────────────────────────────────────────────────────────────────

/**
 * One edit turn: drops messages after a studio restore, runs the edit, and
 * saves the turn (user message + reply with its restore point) to the thread.
 */
export const runEditPipelineV2 = async (params: EditV2Params): Promise<EditResultV2> => {
    const { carouselId, userId, store } = params;
    const dryRun = !!params.options?.dryRun;
    if (params.restoredTo && !dryRun) {
        await store.truncateThreadAfter(carouselId, params.restoredTo).catch((err) => console.warn('[v2.edit] thread trim failed:', err));
    }
    const result = await runEditTurn(params);
    if (result.refused || dryRun) return result;
    const now = Date.now();
    const assistantId = params.messageIds?.assistant || `msg-${now}-a`;
    const turn: ChatMessage[] = [
        { id: params.messageIds?.user || `msg-${now}-u`, role: 'user', text: params.message },
        {
            id: assistantId, role: 'assistant', text: result.reply,
            events: params.turnEvents?.(), tokenUsage: params.usage?.(),
            ...(result.versionId ? { versionId: result.versionId } : {}),
        },
    ];
    for (const m of turn) await store.appendMessage(carouselId, userId, m).catch((err) => console.warn('[v2.edit] thread write failed:', err));
    return { ...result, messageId: assistantId };
};

const runEditTurn = async (params: EditV2Params): Promise<EditResultV2> => {
    const { carouselId, userId, message, store, progress } = params;
    const opts = params.options || {};

    await progress('PLAN: Reading the thread & planning your edit...', 15);

    // Safety check runs alongside loading + planning; its verdict gates everything after.
    const isUndo = UNDO_RE.test(message);
    // A bare "undo" carries no new content to screen.
    const safetyP: Promise<GateResult> = opts.skipSafety || isUndo
        ? Promise.resolve({ allowed: true, category: 'ok', reason: '' })
        : withSpan('safety', { length: message.length }, () => GatekeeperAgent.classifySafety(message));

    const [deck, thread, brief, memory] = await Promise.all([
        store.loadDeck(carouselId),
        store.loadThread(carouselId).catch(() => []),
        store.loadBrief(carouselId).catch(() => null),
        store.loadMemory(userId).catch(() => ({ brandRules: [], bannedWords: [], tonePrefs: [], pastDecisions: [] }) as StructuredMemory),
    ]);

    let templateId: TemplateId = deck.templateId;
    let theme: CarouselTheme = deck.theme;
    let format: CarouselFormat = deck.format;
    let presetId = deck.presetId;
    const original = deck.slides.map(savedToDraft);
    let drafts = original.map(cloneDraft);
    const selected = (params.selectedSlideIndices || []).filter((i) => Number.isInteger(i) && i >= 0 && i < drafts.length);
    const history = thread.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${(m.text || '').slice(0, 300)}`).join('\n');

    const planP: Promise<EditPlan> = isUndo
        ? Promise.resolve({ actions: [{ type: 'undo' as const }], reply: '' })
        : withSpan('edit.plan', { message: message.slice(0, 200) }, () =>
            planEdit({ message, drafts, templateId, selected, brief, memory, history, summary: params.conversationSummary || '' }));

    const [safety, plan] = await Promise.all([safetyP, planP]);

    const base: Omit<EditResultV2, 'intent' | 'reply'> = {
        carouselId,
        slides: deck.slides.map((s, i) => draftToSaved(savedToDraft(s), templateId, i)),
        theme,
        templateId,
        actions: [],
        changedIndices: [],
        slidesChanged: false,
        designActions: [],
        memoryNote: null,
        undoable: false,
    };
    if (!safety.allowed) return { ...base, intent: 'answer', reply: safety.reason, refused: safety };

    const topic = brief?.premise || original[0]?.headline || 'this carousel';
    const facts = factsFromBrief(brief);
    const creative = creativeFromBrief(brief, topic, drafts.length);
    const { terms: banned, noEmoji } = bannedTerms(memory);
    const env: EditEnv = {
        ctx: {
            topic,
            brief: creative,
            templateId,
            slideCount: drafts.length,
            // Decks made before v2 have no stored language: keep whatever the deck is in.
            outputLanguage: brief?.creative?.language || '',
            sourceContent: '',
            memory,
            facts,
        },
        banned,
        allowEmoji: !noEmoji && wantsEmoji(message),
        pool: numberPool(facts, original.map(draftText).join('\n'), message),
    };

    const executed: EditActionType[] = [];
    const replies: string[] = [];
    const notes: string[] = [];
    /** Parts of the request that were planned but not applied; always stated in the reply. */
    const failed: string[] = [];
    let designActions: DesignAction[] = [];
    let changed = new Set<number>();
    const labels: string[] = [];
    let selectedPattern = deck.selectedPattern;
    let signaturePosition = deck.signaturePosition;
    let brandMode = deck.brandMode;

    const actions = plan.actions;
    const has = (t: EditActionType) => actions.some((a) => a.type === t);
    const isCancel = (err: any) => /cancel/i.test(String(err?.message || err));

    // ── undo (exclusive): back to the restore point before the current state ──
    if (has('undo')) {
        await progress('EXECUTE: Restoring the previous version...', 55);
        const others = actions.some((a) => a.type !== 'undo' && a.type !== 'answer');
        const points = restorePoints(thread);
        let snap: (Awaited<ReturnType<PipelineStore['getVersion']>>) = null;
        let versionId: string | undefined;
        if (points.length) {
            const target = previousPoint(thread);
            if (target?.versionId && !opts.dryRun) {
                snap = await store.getVersion(target.versionId);
                versionId = snap ? target.versionId : undefined;
            }
        } else if (!opts.dryRun) {
            // A deck from before restore points: its older before-change snapshots.
            snap = await store.peekVersion(carouselId);
        }
        if (!snap) {
            return { ...base, intent: 'undo', reply: "There's nothing to undo: this is the earliest version I have." };
        }
        await store.updateDeck(carouselId, {
            slides: snap.slides, theme: snap.theme, templateId: snap.templateId, format: snap.format,
            presetId: snap.presetId ?? '', selectedPattern: snap.selectedPattern ?? (typeof deck.selectedPattern === 'number' ? 1 : undefined),
        });
        // An older before-change snapshot is used once; restore points stay (other replies point at them).
        if (!points.length) await store.dropVersion(carouselId, snap.id);
        const restore: DesignAction[] = [];
        if (snap.templateId !== deck.templateId) restore.push({ action: 'set_template', value: snap.templateId });
        if (snap.format !== deck.format) restore.push({ action: 'set_format', value: snap.format });
        if (snap.presetId && snap.presetId !== deck.presetId) restore.push({ action: 'set_preset', value: snap.presetId });
        if (snap.brandMode && snap.brandMode !== deck.brandMode) restore.push({ action: 'set_brand_mode' as DesignAction['action'], value: snap.brandMode });
        // Decks saved without a pattern use the studio default (1).
        const snapPattern = typeof snap.selectedPattern === 'number' ? snap.selectedPattern : 1;
        if (snapPattern !== (deck.selectedPattern ?? 1)) restore.push({ action: 'set_pattern', value: String(snapPattern) });
        if (snap.signaturePosition && snap.signaturePosition !== deck.signaturePosition) restore.push({ action: 'set_signature_position', value: snap.signaturePosition });
        const restored = snap.slides.map((s, i) => draftToSaved(savedToDraft(s), snap!.templateId, i));
        const what = snap.label && points.length ? `the version after: ${snap.label.charAt(0).toLowerCase() + snap.label.slice(1)}` : snap.label ? `before: ${snap.label.charAt(0).toLowerCase() + snap.label.slice(1)}` : 'the previous version';
        return {
            ...base,
            slides: restored,
            theme: snap.theme,
            templateId: snap.templateId,
            intent: 'undo',
            actions: ['undo'],
            reply: `Restored ${what}.${others ? ' Send your other changes as a new message and I\'ll apply them to this version.' : ''}`,
            changedIndices: restored.map((_, i) => i),
            slidesChanged: true,
            designActions: restore,
            ...(versionId ? { versionId } : {}),
            undoable: !!versionId,
        };
    }

    // ── regenerate (replaces copy/structure) ─────────────────────────────────
    const regen = actions.find((a) => a.type === 'regenerate');
    if (regen) {
        const count = Math.max(2, Math.min(20, Math.round(Number(regen.targetSlideCount) || drafts.length)));
        const instruction = [message, regen.instruction && regen.instruction !== message ? `(planner: ${regen.instruction})` : ''].filter(Boolean).join('\n');
        const ctx: PipelineContext = {
            ...env.ctx,
            slideCount: count,
            brief: { ...creative, suggestedSlideCount: count },
            sourceContent: `CURRENT DECK (reference for topic and voice; the user wants it changed):\n${drafts.map(dumpDraft).join('\n')}`,
            customInstructions: instruction,
        };
        try {
            const composed = await withSpan('edit.regenerate', { count }, () => composeDeck(ctx, {
                userText: message,
                pool: env.pool,
                strictGrounding: !!creative.contentStrategy.stayFactuallyAccurate && creative.contentType !== 'ENTERTAINMENT',
                maxReflectPasses: 1,
                progress,
                at: (p) => 20 + Math.round((p - 30) * 0.9),
                outlineLabel: `PLAN: Re-outlining the deck (${count} slides)...`,
            }));
            if (composed.drafts.length >= 2) {
                drafts = composed.drafts;
                changed = new Set(drafts.map((_, i) => i));
                executed.push('regenerate');
                labels.push(`Rebuilt the deck as ${drafts.length} slides`);
                replies.push(count === original.length ? 'I rebuilt the deck with your changes.' : `I rebuilt the deck as ${drafts.length} slides.`);
                if (templateId === 'template-3' && !opts.skipImages) {
                    await progress('Art Director: sketching the new slides...', 84);
                    const saved = drafts.map((d, i) => draftToSaved(d, templateId, i));
                    const prompts = await ArtDirectorAgent.generatePrompts(saved, topic).catch(() => [] as string[]);
                    const seed = seedFrom(`${carouselId}:${Date.now()}`);
                    const queue = prompts.map((p, i) => ({ p, i })).filter((x) => x.p && drafts[x.i]);
                    const worker = async () => {
                        for (let next = queue.shift(); next; next = queue.shift()) {
                            try {
                                drafts[next.i].doodleUrl = await store.generateDoodle(next.p, '2:3', seed);
                                drafts[next.i].doodlePrompt = next.p;
                            } catch (err) {
                                console.warn('[v2.edit] doodle failed:', err);
                            }
                        }
                    };
                    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
                }
            } else {
                failed.push('rebuild the deck');
            }
        } catch (err) {
            if (isCancel(err)) throw err;
            console.warn('[v2.edit] regenerate failed:', err);
            failed.push('rebuild the deck');
        }
    }

    // Slide numbers in the plan refer to the deck as the user saw it. Track each
    // working slide's original position so they survive removals and inserts.
    const origin = new Map<DraftSlide, number>();
    drafts.forEach((d, i) => origin.set(d, i));
    const posOf = (orig: number) => drafts.findIndex((d) => origin.get(d) === orig);
    const nums = (xs: number[]) => xs.map((i) => i + 1).join(', ');

    // ── structure ─────────────────────────────────────────────────────────────
    if (!regen) {
        const placeholders = new Map<DraftSlide, string>();
        for (const a of actions.filter((x) => x.type === 'structure')) {
            await progress('EXECUTE: Adjusting the deck structure...', 45);
            const asked = (a.removeSlides || []).map((n) => Math.round(n) - 1).filter((i) => Number.isInteger(i) && i >= 0 && i < original.length);
            // Never remove the cover or the closing slide.
            const protectedAsked = asked.filter((i) => i === 0 || i === original.length - 1);
            if (protectedAsked.length) failed.push(`remove slide ${nums(protectedAsked)} (the cover and closing slides always stay)`);
            const removals = new Set(asked.filter((i) => i > 0 && i < original.length - 1));
            if (removals.size) {
                const kept = drafts.filter((d) => !removals.has(origin.get(d) ?? -1));
                if (kept.length >= 2 && kept.length < drafts.length) {
                    labels.push(`Removed slide${removals.size > 1 ? 's' : ''} ${nums(Array.from(removals))}`);
                    drafts = kept;
                    executed.push('structure');
                } else {
                    failed.push(`remove slide ${nums(Array.from(removals))}`);
                }
            }
            if (a.insertAbout && a.insertAbout.trim()) {
                if (drafts.length + placeholders.size >= 20) {
                    failed.push('add another slide (20 is the maximum)');
                    continue;
                }
                const afterOrig = Math.round(Number(a.insertAfter)) - 1;
                const anchor = Number.isInteger(afterOrig) ? posOf(afterOrig) : -1;
                const at = Math.max(1, Math.min(drafts.length - 1, anchor >= 0 ? anchor + 1 : drafts.length - 1));
                const placeholder: DraftSlide = { blockType: 'body', headline: '', body: '' };
                drafts.splice(at, 0, placeholder);
                placeholders.set(placeholder, a.insertAbout.trim());
            }
        }
        if (placeholders.size) {
            const idx = drafts.map((d, i) => (placeholders.has(d) ? i : -1)).filter((i) => i >= 0);
            const noteMap = new Map(idx.map((i) => [i, placeholders.get(drafts[i])!]));
            const wrote = await withSpan('edit.insert', { count: idx.length }, () => rewriteSlides(env, drafts, idx, message, noteMap));
            // Never keep an empty placeholder.
            drafts = drafts.filter((d) => !placeholders.has(d) || !!d.headline?.trim());
            if (wrote.length) {
                executed.push('structure');
                labels.push(`Added ${wrote.length} slide${wrote.length > 1 ? 's' : ''}`);
            }
            if (wrote.length < idx.length) failed.push(idx.length - wrote.length > 1 ? 'add the new slides' : 'add the new slide');
        }
    }

    // ── copy ──────────────────────────────────────────────────────────────────
    if (!regen) {
        for (const a of actions.filter((x) => x.type === 'copy')) {
            await progress('EXECUTE: Rewriting the copy you asked for...', 55);
            const requested = (a.slides || []).map((n) => Math.round(n) - 1);
            const wanted = requested.filter((i) => Number.isInteger(i) && i >= 0 && i < original.length);
            // Named slides that don't exist must never widen into "rewrite everything".
            if (requested.length && !wanted.length) { failed.push(`rewrite slide ${nums(requested)} (no such slide)`); continue; }
            const scope = wanted.length ? wanted : selected;
            const targets = scope.map(posOf).filter((i) => i >= 0);
            if (scope.length && !targets.length) { failed.push(`rewrite slide ${nums(scope)} (it was removed)`); continue; }
            const instruction = a.instruction && a.instruction !== message ? `${message}\n(${a.instruction})` : message;
            const did = await withSpan('edit.copy', { targets }, () => rewriteSlides(env, drafts, targets, instruction));
            if (did.length) {
                did.forEach((i) => changed.add(i));
                executed.push('copy');
                labels.push(did.length === drafts.length ? 'Rewrote every slide' : `Rewrote slide${did.length > 1 ? 's' : ''} ${nums(did)}`);
            } else {
                failed.push(targets.length ? `rewrite slide ${nums(targets)}` : 'rewrite the slides');
            }
        }
    }

    // ── design ────────────────────────────────────────────────────────────────
    const runDesign = async (list: DesignAction[]) => {
        if (!list.length) return;
        designActions = list;
        executed.push('design');
        // Template first, so the other settings apply to the new template.
        const ordered = [...list.filter((d) => d.action === 'set_template'), ...list.filter((d) => d.action !== 'set_template')];
        for (const d of ordered) {
            if (d.action === 'set_template' && d.value !== templateId) {
                await progress('EXECUTE: Re-fitting the copy to the new template...', 65);
                const to = d.value as TemplateId;
                const refit = await withSpan('edit.refit', { to }, () => refitForTemplate(env, drafts, to));
                refit.forEach((r, i) => { if (!drafts[i] || !sameDraft(drafts[i], r)) changed.add(i); });
                drafts = refit;
                templateId = to;
                theme = stampTheme(theme, templateId);
                labels.push(`Switched to ${to}`);
            }
            if (d.action === 'set_format') { format = d.value as CarouselFormat; labels.push(`Changed format to ${d.value}`); }
            if (d.action === 'set_preset') { presetId = d.value; brandMode = 'preset'; labels.push(`Changed colors to ${d.value}`); }
            if (d.action === 'set_pattern') { selectedPattern = Number(d.value); labels.push(`Changed pattern to ${d.value}`); }
            if (d.action === 'set_signature_position') { signaturePosition = d.value as typeof signaturePosition; labels.push(`Moved the signature to ${d.value}`); }
        }
        if (list.some((d) => d.action === 'set_template' || d.action === 'set_preset')) {
            const preset = getPresetById(presetId);
            if (preset) theme = resolveTheme(preset.seeds, templateId);
            theme = stampTheme(theme, templateId);
        }
    };
    const designWanted = actions.filter((a) => a.type === 'design').flatMap((a) => a.design || []);
    if (has('design') || designWanted.length) {
        let list = sanitizeDesign(designWanted);
        if (designWanted.length > list.length && list.length) failed.push('apply one of the design settings (it isn\'t an available option)');
        if (!list.length) list = sanitizeDesign(parseDesignActionsFallback(message));
        if (list.length) await runDesign(list);
        else failed.push('change the design (I couldn\'t match it to an available template, format, palette or pattern)');
    }

    // ── image ─────────────────────────────────────────────────────────────────
    const img = actions.find((a) => a.type === 'image');
    const onlyImage = actions.length > 0 && actions.every((a) => a.type === 'image' || a.type === 'answer') && !!img;
    if (img && templateId !== 'template-3') {
        if (onlyImage) {
            return { ...base, intent: 'answer', reply: 'Sketches only exist on the hand-drawn template. Want me to switch this carousel to it? Say "switch to the sketch template".' };
        }
        failed.push('redraw the sketch (sketches only exist on the hand-drawn template)');
    } else if (img) {
        const requested = img.imageSlide ? Math.round(img.imageSlide) - 1 : (selected[0] ?? -1);
        const idx = requested >= 0 && requested < original.length ? posOf(requested) : -1;
        if (idx < 0) {
            failed.push(requested < 0 ? 'redraw a sketch (tell me which slide)' : `redraw the sketch on slide ${requested + 1}`);
        } else if (!img.imageBrief?.trim() || opts.skipImages) {
            failed.push(`redraw the sketch on slide ${idx + 1}`);
        } else {
            await progress(`EXECUTE: Sketching a new image for slide ${idx + 1}...`, 70);
            const scene = img.imageBrief.trim();
            const prompt = /ink|line art|illustration/i.test(scene) ? scene : buildFluxPrompt(scene);
            try {
                const url = await withSpan('edit.image', { index: idx }, () => store.generateDoodle(prompt, '2:3', seedFrom(`${carouselId}:${idx}:${Date.now()}`)));
                drafts[idx] = { ...drafts[idx], doodleUrl: url, doodlePrompt: prompt };
                changed.add(idx);
                executed.push('image');
                labels.push(`Redrew the sketch on slide ${idx + 1}`);
            } catch (err) {
                if (isCancel(err)) throw err;
                console.warn('[v2.edit] image failed:', err);
                failed.push(`redraw the sketch on slide ${idx + 1}`);
            }
        }
    }

    // ── Honesty guard ────────────────────────────────────────────────────────
    const heur = messageHeuristics(message);
    // A clear edit command the planner treated as chat is still a failed edit.
    const command = !heur.isQuestion && (COMMAND_START_RE.test(message) || (POLITE_ASK_RE.test(message) && EDIT_VERB_RE.test(message)));
    const wantedChange = actions.some((a) => a.type !== 'answer');
    let intent: EditActionType = executed[0] || 'answer';
    if (!executed.length && !wantedChange && !command && !plan.reply) {
        return { ...base, intent: 'answer', reply: "I'm not sure what to change. Tell me which slide and what you'd like different, or ask me anything about the deck." };
    }
    if (!executed.length && (wantedChange || command)) {
        const fallback = heur.isDesignCommand ? sanitizeDesign(parseDesignActionsFallback(message)) : [];
        if (fallback.length && !has('design')) {
            await runDesign(fallback);
            intent = 'design';
        } else {
            const reply = failed.length ? `I couldn't ${failed.join(', or ')}. Nothing was changed.` : HONESTY_GUARD_REPLY;
            return { ...base, intent: 'answer', reply };
        }
    }

    // Compare by content and position: a removal plus an insert keeps the count but changes the deck.
    drafts.forEach((d, i) => { if (!original[i] || !sameDraft(d, original[i]) || (d.doodleUrl || '') !== (original[i].doodleUrl || '')) changed.add(i); });
    const slidesChanged = changed.size > 0 || drafts.length !== original.length;

    // Numbers the edit introduced that we can't trace: say so rather than silently ship them.
    if (slidesChanged) {
        const unsupported = groundingIssues(drafts, env.pool, false).filter((i) => changed.has(i.index));
        for (const u of unsupported.slice(0, 2)) notes.push(`Slide ${u.index + 1} now mentions ${u.message.split('"')[1]}, which isn't in your sources, so double-check it.`);
    }

    const saved = drafts.map((d, i) => draftToSaved(d, templateId, i));

    // ── Moderate BEFORE saving ───────────────────────────────────────────────
    if (slidesChanged && !opts.skipSafety) {
        const texts = slideTexts(saved.filter((_, i) => changed.has(i) || drafts.length !== original.length));
        const mod = await withSpan('moderate', { slides: texts.length }, () => GatekeeperAgent.moderateOutput(texts));
        if (!mod.allowed) return { ...base, intent: 'answer', reply: mod.reason, refused: mod };
    }

    // ── Snapshot → persist ──────────────────────────────────────────────────
    const designChanged = templateId !== deck.templateId || format !== deck.format || presetId !== deck.presetId
        || selectedPattern !== deck.selectedPattern || signaturePosition !== deck.signaturePosition || brandMode !== deck.brandMode;
    const deckChanged = slidesChanged || designChanged;
    let versionId: string | undefined;
    if (deckChanged && !opts.dryRun) {
        await progress('Saving...', 90);
        const label = labels.join('; ') || 'Edited the deck';
        // A deck from before restore points gets one for how it looks now, on its last reply.
        const lastReply = [...thread].reverse().find((m) => m.role === 'assistant');
        if (lastReply && !restorePoints(thread).length) {
            const before = await store.saveVersion(carouselId, userId, {
                slides: deck.slides, theme: deck.theme, templateId: deck.templateId, format: deck.format, presetId: deck.presetId,
                selectedPattern: deck.selectedPattern, signaturePosition: deck.signaturePosition, brandMode: deck.brandMode, label: 'Before restore points', kind: 'point',
            });
            if (before) await store.setMessageVersion(carouselId, lastReply.id, before).catch(() => undefined);
        }
        await store.updateDeck(carouselId, {
            slides: slidesChanged || templateId !== deck.templateId ? saved : undefined,
            theme: theme !== deck.theme ? theme : undefined,
            templateId: templateId !== deck.templateId ? templateId : undefined,
            format: format !== deck.format ? format : undefined,
            presetId: presetId !== deck.presetId ? presetId : undefined,
            selectedPattern: selectedPattern !== deck.selectedPattern ? selectedPattern : undefined,
        });
        if (slidesChanged && brief) {
            await store.saveBrief(carouselId, userId, { ...brief, keyPoints: saved.map((s) => s.headline).filter(Boolean) }).catch(() => undefined);
        }
        // Restore point: the deck right after this reply.
        versionId = (await store.saveVersion(carouselId, userId, {
            slides: slidesChanged || templateId !== deck.templateId ? saved : deck.slides,
            theme, templateId, format, presetId, selectedPattern, signaturePosition, brandMode, label, kind: 'point',
        })) || undefined;
    }

    // ── Memory ───────────────────────────────────────────────────────────────
    const planned = plan.memory?.note?.trim() && plan.memory.category ? { note: plan.memory.note.trim(), category: plan.memory.category } : null;
    const categories: (keyof StructuredMemory)[] = ['brandRules', 'bannedWords', 'tonePrefs', 'pastDecisions'];
    const memoryNote: EditResultV2['memoryNote'] = memoryFromMessage(message) || (planned && categories.includes(planned.category) ? planned : null);
    if (memoryNote && !opts.dryRun) {
        await store.remember(userId, memoryNote.note.slice(0, 200), memoryNote.category).catch(() => undefined);
    }

    // The planner's reply was written before anything ran: only trust it when everything applied.
    let reply = !failed.length && plan.reply ? plan.reply : (replies.join(' ') || (labels.length ? `${labels.join('. ')}.` : plan.reply || 'Done.'));
    if (failed.length) reply += ` I couldn't ${failed.join(', or ')}, so that part is unchanged.`;
    if (memoryNote) reply += memoryNote.category === 'bannedWords' ? ` I'll avoid "${memoryNote.note}" in future carousels too.` : ' I saved that preference for future carousels.';
    if (notes.length) reply += ` ${notes.join(' ')}`;
    reply = reply.replace(/\s*—\s*/g, ', ');

    return {
        carouselId,
        slides: saved,
        theme,
        templateId,
        intent,
        actions: Array.from(new Set(executed)),
        reply,
        changedIndices: Array.from(changed).filter((i) => i < saved.length).sort((a, b) => a - b),
        slidesChanged,
        designActions,
        memoryNote,
        ...(versionId ? { versionId } : {}),
        undoable: !!versionId,
    };
};
