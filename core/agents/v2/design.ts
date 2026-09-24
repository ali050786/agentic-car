/**
 * Design agents for the Canvas (template-5): the part that makes every deck
 * look composed for its content instead of poured into a fixed template.
 *
 *   Design Director (one call): reads the topic, audience, tone and the
 *   user's own words about the look, then picks the deck's direction, font
 *   pairing, corners and accent treatment, and plans every slide: which
 *   layout from the library to start from, the visual idea that makes that
 *   slide land, and which one or two slides get a full-color moment.
 *
 *   Composer (one call per slide, in parallel): starts from the planned
 *   layout's draft tree and shapes it for the slide's actual words:
 *   hierarchy, sizes, panels, decoration, sometimes a short extra label.
 *
 * Nothing the models return is trusted: styles are coerced to known values,
 * the plan is repaired for variety, and every composed tree is linted
 * (sanitized, coverage-checked, size-estimated). Anything unusable falls back
 * to the library draft, so a deck always renders, even with the models off.
 */

import type { CarouselFormat, CarouselTheme, CreativeBrief } from '../../../types';
import type { DraftSlide } from './types';
import type { CanvasContent, DesignStyle, Direction, SlideDesign, StoredDesign } from '../../design/canvas/types';
import { DIRECTIONS, isDesignRef } from '../../design/canvas/types';
import {
    ARCHETYPE_BY_ID, DIRECTION_PRESETS, FONT_PAIRS, FONT_PAIR_IDS, archetypesFor, chooseInversions, defaultStyle,
    designSlide, estimateFill, hashString, lintDesign, pickArchetype, resolvePalette, sanitizeExtras, sanitizeStyle, toBlock,
} from '../../design/canvas';
import { colord } from 'colord';
import { directionFromWords, heuristicStyle } from '../../design/canvas/style';
import { SHARED_ICONS } from '../../../config/constants';
import { withSpan } from '../../llm/agentGateway';
import { ask, languageRule, untrusted } from './prompting';

// ── content ────────────────────────────────────────────────────────────────

/** Draft → what the Canvas renderer reads. */
export const contentOfDraft = (d: DraftSlide, extras?: Record<string, string>): CanvasContent => ({
    blockType: d.blockType,
    preHeader: d.preHeader ? d.preHeader.toUpperCase().trim() : undefined,
    headline: d.headline,
    body: d.body,
    footer: d.footer,
    statNumber: d.statNumber,
    statLabel: d.statLabel,
    quoteAuthor: d.quoteAuthor,
    splitLeft: d.splitLeft,
    splitRight: d.splitRight,
    accentPhrase: d.accentPhrase,
    listItems: d.blockType === 'list' ? (d.listItems || []).filter(Boolean) : [],
    extras: extras ?? d.extras,
    icon: d.icon,
    doodleUrl: d.doodleUrl,
});

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}‍️]/gu;

/**
 * Extra labels are design copy: short, no invented numbers (digits only if
 * the same number is already on the slide), no banned terms, no emoji unless
 * the user asked for them.
 */
export const cleanExtras = (raw: unknown, d: DraftSlide, opts: { banned?: string[]; allowEmoji?: boolean } = {}): Record<string, string> => {
    const base = sanitizeExtras(raw, 28, 2);
    const slideText = [d.preHeader, d.headline, d.body, d.footer, d.statNumber, d.statLabel, d.quoteAuthor, d.splitLeft, d.splitRight, ...(d.listItems || [])].join(' ');
    const slideNumbers = new Set((slideText.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.')));
    const out: Record<string, string> = {};
    for (const [k, v0] of Object.entries(base)) {
        let v = opts.allowEmoji ? v0 : v0.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
        if (!v) continue;
        const nums = (v.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));
        if (nums.some((n) => !slideNumbers.has(n))) continue;
        const lower = v.toLowerCase();
        if ((opts.banned || []).some((t) => t && new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(lower))) continue;
        v = v.slice(0, 28);
        out[k] = v;
    }
    return out;
};

// ── style ──────────────────────────────────────────────────────────────────

export { directionFromWords, heuristicStyle } from '../../design/canvas/style';

const isDark = (theme: CarouselTheme | null) => colord(resolvePalette(theme).bg).brightness() < 0.5;

// ── Design Director ────────────────────────────────────────────────────────

const DIRECTOR_SCHEMA = {
    type: 'object',
    properties: {
        direction: { type: 'string', enum: DIRECTIONS },
        fonts: { type: 'string', enum: FONT_PAIR_IDS },
        radius: { type: 'string', enum: ['none', 'sm', 'md', 'lg'] },
        mark: { type: 'string', enum: ['color', 'highlight', 'underline', 'serif', 'box', 'none'] },
        headingCase: { type: 'string', enum: ['none', 'upper'] },
        rationale: { type: 'string' },
        slides: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'number' },
                    layout: { type: 'string' },
                    invert: { type: 'boolean' },
                    idea: { type: 'string' },
                },
                required: ['index', 'layout'],
            },
        },
    },
    required: ['direction', 'fonts', 'slides'],
};

export interface SlidePlan {
    archetype: string;
    invert?: 'accent' | 'ink';
    idea?: string;
}

export interface DeckPlan {
    style: DesignStyle;
    slides: SlidePlan[];
    rationale?: string;
    /** 'model' when the Design Director's plan was used, 'library' otherwise. */
    source: 'model' | 'library';
}

const slideLine = (d: DraftSlide, i: number) => {
    const bits = [`${i + 1} [${d.blockType}] headline: "${d.headline}" (${d.headline.length} chars)`];
    if (d.body) bits.push(`body ${d.body.length} chars`);
    if (d.listItems?.length) bits.push(`${d.listItems.length} list items, ~${Math.round(d.listItems.join('').length / d.listItems.length)} chars each${d.listItems.every((x) => /^[^:]{1,48}:\s*\S/.test(x)) ? ', "Key: detail" form' : ''}`);
    if (d.statNumber) bits.push(`number "${d.statNumber}"`);
    if (d.splitLeft) bits.push('two sides to compare');
    if (d.quoteAuthor) bits.push(`quote by ${d.quoteAuthor}`);
    if (d.footer) bits.push(`call to action "${d.footer}"`);
    if (d.icon) bits.push(`icon ${d.icon}`);
    if (d.doodleUrl) bits.push('has an illustration');
    return bits.join(' · ');
};

/** Repairs a plan: valid layouts for each slide, no neighbouring repeats, lawful inversions. */
export const repairPlan = (drafts: DraftSlide[], style: DesignStyle, proposed: (Partial<SlidePlan> | undefined)[], seed: number): SlidePlan[] => {
    const contents = drafts.map((d) => contentOfDraft(d));
    const plan: SlidePlan[] = [];
    const uses = new Map<string, number>();
    for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const options = archetypesFor(d.blockType, contents[i]);
        const want = proposed[i]?.archetype;
        const prev = plan[i - 1]?.archetype;
        let id = want && options.some((o) => o.id === want) ? want : '';
        if (!id || id === prev || (uses.get(id) || 0) >= 2) {
            const avoid = [prev || '', ...Array.from(uses.entries()).filter(([, n]) => n >= 2).map(([k]) => k)];
            id = pickArchetype(d.blockType, contents[i], style, hashString(`${seed}:${i}:${d.blockType}`), avoid).id;
        }
        uses.set(id, (uses.get(id) || 0) + 1);
        plan.push({ archetype: id, idea: proposed[i]?.idea?.slice(0, 200) });
    }
    // Inversions: honour the model's picks when lawful, else let the library choose.
    const color: 'accent' | 'ink' = style.direction === 'editorial' || style.direction === 'magazine' || style.direction === 'minimal' ? 'ink' : 'accent';
    const max = Math.min(style.direction === 'bold' || style.direction === 'playful' ? 2 : 1, Math.floor(drafts.length / 3));
    const wanted = proposed.map((p, i) => (p?.invert ? i : -1)).filter((i) => i >= 0);
    const lawful: number[] = [];
    const banded = (i: number) => !!ARCHETYPE_BY_ID.get(plan[i]?.archetype || '')?.banded;
    for (const i of wanted) {
        if (lawful.length >= max) break;
        const a = ARCHETYPE_BY_ID.get(plan[i].archetype);
        if (!a?.invertible) {
            // Swap to an invertible layout for this slide if there is one.
            const alt = archetypesFor(drafts[i].blockType, contents[i]).find((o) => o.invertible && o.id !== plan[i - 1]?.archetype && o.id !== plan[i + 1]?.archetype);
            if (!alt) continue;
            plan[i].archetype = alt.id;
        }
        if (lawful.some((j) => Math.abs(j - i) <= 1) || banded(i - 1) || banded(i + 1)) continue;
        lawful.push(i);
    }
    const chosen = wanted.length ? lawful : chooseInversions(drafts.map((d, i) => ({ blockType: d.blockType, content: contents[i] })), style, seed)
        .filter((i) => ARCHETYPE_BY_ID.get(plan[i].archetype)?.invertible && !banded(i - 1) && !banded(i + 1));
    for (const i of chosen) plan[i].invert = color;
    return plan;
};

/** What the Design Director decided, before the plan is fitted to the final copy. */
export interface DirectorOutput {
    style: DesignStyle;
    /** Per slide (0-based): the layout/invert/idea the director proposed. */
    proposed: (Partial<SlidePlan> | undefined)[];
    rationale?: string;
    source: 'model' | 'library';
}

/** One call: the deck's look plus a per-slide layout proposal. Never throws (except on cancel). */
const runDirector = async (params: {
    count: number;
    slideLines: string[];
    layoutLines: string[];
    fromOutline?: boolean;
    topic: string;
    brief?: CreativeBrief;
    userText?: string;
    theme: CarouselTheme | null;
    style?: DesignStyle;
    useModel?: boolean;
}): Promise<DirectorOutput> => {
    const { count, topic, brief, userText = '', theme } = params;
    const fallbackStyle = params.style || heuristicStyle(topic, brief, userText);
    const library: DirectorOutput = { style: fallbackStyle, proposed: [], source: 'library' };
    if (params.useModel === false) return library;

    const pal = resolvePalette(theme);
    const asked = directionFromWords(userText);
    const prompt = `You are the art director of a social media carousel (${count} slides, 1080×1350). ${params.style ? 'The look is already set; plan each slide\'s layout within it.' : 'Choose one visual direction for the whole deck, then plan each slide\'s layout.'}

DECK
Topic: ${topic}
Audience: ${brief?.audience?.description || 'a general audience'}
Tone: ${brief?.creativeStyle?.toneDescription || 'clear and confident'}
Feeling to leave: ${brief?.visualStyle?.emotionToConvey || 'informed'}
Colors (fixed by the user's palette, don't change them): ${isDark(theme) ? 'dark' : 'light'} background ${pal.bg}, accent ${pal.accent}.
${userText ? untrusted('user_words', userText, 800) : ''}
${asked ? `The user asked for a ${asked} look: use it.` : ''}
${params.style ? `LOOK (fixed): direction ${params.style.direction}, fonts ${params.style.fonts}, corners ${params.style.radius}, headline accent ${params.style.mark}.` : `
DIRECTIONS
${DIRECTIONS.map((d) => `- ${d}: ${DIRECTION_PRESETS[d].blurb} Fonts that suit it: ${DIRECTION_PRESETS[d].fonts.join(', ')}.`).join('\n')}

FONT PAIRS
${FONT_PAIR_IDS.map((f) => `- ${f}: ${FONT_PAIRS[f].label} (${FONT_PAIRS[f].display.family} + ${FONT_PAIRS[f].body.family})`).join('\n')}

Headline accent (how the key phrase is emphasised): color, highlight (marker), underline, serif (italic serif), box (filled block), none.`}

SLIDES${params.fromOutline ? ' (the copy is being written now; this is each slide\'s job and message)' : ''}
${params.slideLines.join('\n')}

LAYOUTS YOU CAN USE PER SLIDE
${params.layoutLines.join('\n')}

Rules:
- ${params.style ? 'Keep the fixed look.' : 'Pick the direction that fits the topic and audience: tech/dev → tech; finance, B2B, advice for professionals → corporate or editorial; kids, education, lighthearted → playful; culture, lifestyle, stories → editorial or magazine; opinions, manifestos, hot takes → bold or brutalist; calm, premium, wellness → minimal. The user\'s own words about the look win.'}
- Vary the layouts: never the same layout on two slides in a row, at most two of any layout in the deck.
- "invert": true on the 1-2 slides that deserve a full-color moment (a key quote, the big number, the turning point). Never two in a row and never next to a color-band layout.
- "idea": one short sentence per slide on the visual move that makes it land (what is biggest, what gets a panel, what gets emphasis). Be concrete.
- "index" is the 1-based slide number.

Return JSON: { ${params.style ? '' : '"direction", "fonts", "radius": none|sm|md|lg, "mark", "headingCase": none|upper, '}"rationale": one sentence, "slides": [ { "index", "layout", "invert", "idea" } ] }`;

    try {
        const r = await withSpan('design.director', { slides: count, fromOutline: !!params.fromOutline }, () =>
            ask<any>({ role: 'planner', label: 'design.director', temperature: 0.5 }, prompt, DIRECTOR_SCHEMA));
        const validDirection = (DIRECTIONS as string[]).includes(r?.direction);
        const base = validDirection ? defaultStyle(r.direction) : fallbackStyle;
        let style = params.style || sanitizeStyle({ ...base, ...(validDirection ? { fonts: r.fonts, radius: r.radius, mark: r.mark, headingCase: r.headingCase } : {}) }, base);
        if (!params.style) {
            // A font pair the direction can't carry (e.g. condensed caps on a minimal deck) gets the direction's first choice.
            if (!DIRECTION_PRESETS[style.direction].fonts.includes(style.fonts) && !FONT_PAIR_IDS.includes(r?.fonts)) style = { ...style, fonts: DIRECTION_PRESETS[style.direction].fonts[0] };
            if (asked && style.direction !== asked) style = defaultStyle(asked, style.fonts);
            style = { ...style, density: DIRECTION_PRESETS[style.direction].density };
        }
        const rows: any[] = Array.isArray(r?.slides) ? r.slides : [];
        const proposed: (Partial<SlidePlan> | undefined)[] = Array.from({ length: count }, () => undefined);
        rows.forEach((row, pos) => {
            let i = Number(row?.index) - 1;
            if (!Number.isInteger(i) || i < 0 || i >= count) i = pos;
            if (i >= 0 && i < count && !proposed[i]) {
                proposed[i] = { archetype: typeof row?.layout === 'string' ? row.layout.trim() : undefined, invert: row?.invert === true ? 'accent' : undefined, idea: typeof row?.idea === 'string' ? row.idea : undefined };
            }
        });
        return { style, proposed, rationale: typeof r?.rationale === 'string' ? r.rationale.slice(0, 300) : undefined, source: 'model' };
    } catch (err) {
        if (/cancel/i.test(String((err as any)?.message || err))) throw err;
        console.warn('[v2.design] director failed, using the layout library:', err);
        return library;
    }
};

/** Fits a director's proposal to the final copy (valid layouts, variety, lawful color moments). */
export const planFromDirector = (drafts: DraftSlide[], out: DirectorOutput, seed: number): DeckPlan => ({
    style: out.style,
    slides: repairPlan(drafts, out.style, drafts.map((_, i) => out.proposed[i]), seed),
    rationale: out.rationale,
    source: out.source,
});

export const directDeck = async (params: {
    drafts: DraftSlide[];
    topic: string;
    brief?: CreativeBrief;
    userText?: string;
    theme: CarouselTheme | null;
    seed: number;
    /** Keep this style (edits); only the per-slide plan is made. */
    style?: DesignStyle;
    useModel?: boolean;
}): Promise<DeckPlan> => {
    const { drafts, seed } = params;
    const contents = drafts.map((d) => contentOfDraft(d));
    const out = await runDirector({
        count: drafts.length,
        slideLines: drafts.map(slideLine),
        layoutLines: drafts.map((d, i) => `${i + 1}: ${archetypesFor(d.blockType, contents[i]).map((a) => `${a.id} (${a.label}${a.banded ? ', color band' : ''})`).join(', ')}`),
        topic: params.topic,
        brief: params.brief,
        userText: params.userText,
        theme: params.theme,
        style: params.style,
        useModel: params.useModel,
    });
    return planFromDirector(drafts, out, seed);
};

/**
 * The Design Director from the outline alone, so the deck's look is decided
 * while the copy is still being written. planFromDirector() later fits the
 * proposal to the final words (a layout the words can't use is replaced).
 */
export const directFromOutline = (params: {
    beats: { blockType: DraftSlide['blockType']; purpose?: string; keyMessage: string }[];
    topic: string;
    brief?: CreativeBrief;
    userText?: string;
    theme: CarouselTheme | null;
    useModel?: boolean;
}): Promise<DirectorOutput> => {
    const all = Array.from(ARCHETYPE_BY_ID.values());
    return runDirector({
        count: params.beats.length,
        fromOutline: true,
        slideLines: params.beats.map((b, i) => `${i + 1} [${b.blockType}]${b.purpose ? ` (${b.purpose})` : ''}: ${b.keyMessage}`),
        layoutLines: params.beats.map((b, i) => `${i + 1}: ${all.filter((a) => a.block === toBlock(b.blockType)).map((a) => `${a.id} (${a.label}${a.banded ? ', color band' : ''})`).join(', ')}`),
        topic: params.topic,
        brief: params.brief,
        userText: params.userText,
        theme: params.theme,
        useModel: params.useModel,
    });
};

// ── Composer ───────────────────────────────────────────────────────────────

const COMPOSER_SCHEMA = {
    type: 'object',
    properties: {
        root: { type: 'object' },
        bg: { type: 'object' },
        decor: { type: 'array', items: { type: 'object' } },
        extras: { type: 'object' },
    },
    required: ['root'],
};

const LANGUAGE_SPEC = `LAYOUT LANGUAGE (JSON nodes; "size" steps are about 15% each; spacing values are 0-120 in steps of 4)
stack  {type:"stack", dir:"col"|"row", gap, pad, padX, padY, align:start|center|end|stretch, justify:start|center|end|between|around, fill:ROLE, gradient:[ROLE,ROLE], radius:none|sm|md|lg|pill|theme, border:ROLE, borderW:1-6, width:full|1/4|1/3|2/5|1/2|3/5|2/3|3/4, basis:0.15-0.85 (share of the parent's length), grow:true, bleed:top|bottom|all (top-level stacks only: a color band running to the slide edges), shadow:soft|hard, rotate:-8..8, children:[...]}
grid   {type:"grid", cols:2|3, gap, children:[...]}
text   {type:"text", field, role:kicker|display|title|subtitle|body|small|label|quote|caption, size:-3..3, color:ROLE, align:left|center|right, weight:300-900, italic, upper, font:display|body|mono, part:key|value (for "Key: detail" text), mark:none|color|highlight|underline|serif|box (headline only), maxWidth:WIDTH, tracking:tight|wide}
number {type:"number", field:"statNumber", size:-3..3, color:ROLE, outline:true, align}
list   {type:"list", look:numbers|checks|dots|cards|steps|timeline|bignum|chips, cols:1-3, gap, size:-3..3, marker:ROLE, fill:ROLE, color:ROLE}  (shows ALL list items)
chart  {type:"chart", kind:ring|progress (a percentage statNumber) | bars (list items that contain numbers), size:s|m|l, color:ROLE, track:ROLE}
icon   {type:"icon", name:ICON, size:s|m|l|xl, color:ROLE, tile:ROLE, shape:circle|square|none}
image  {type:"image", src:"doodle", size:s|m|l, mask:none|circle|rounded|arch}  (only if the slide has an illustration)
rule   {type:"rule", color:ROLE, width:short|WIDTH, thick:1|2|4|6|8|12, vertical:true}
badge  {type:"badge", field, fill:ROLE, color:ROLE, outline:true, size:s|button, align:start|center|end}
meta   {type:"meta", kind:page|pageOfTotal|swipe|progress, color:ROLE, align}
quotemark {type:"quotemark", size:s|m|l, color:ROLE}
spacer {type:"spacer", size} or {type:"spacer", grow:true}
ROLE (colors come from the user's palette): bg, surface, surface2, ink, inkSoft, accent, accent2, accentSoft, onAccent, line
BACKGROUND {kind:solid|gradient|spot|frame, color:ROLE, color2:ROLE, angle:0-360}
DECOR (0-4 shapes behind the content; x,y = center in % of the slide; w,h in % of slide width): {shape:circle|ring|blob|rect|pill|arc|dots|grid|lines|wave|spark|star|arrow|cross|triangle|halftone|bignum, x, y, w, h, color:ROLE, opacity:0.05-1, rotate, outline:true}`;

const fieldsBlock = (c: CanvasContent) => {
    const rows: string[] = [];
    const add = (f: string, v?: string) => { if (v && v.trim()) rows.push(`- ${f}: "${v}" (${v.length} chars)`); };
    add('preHeader', c.preHeader); add('headline', c.headline); add('body', c.body);
    add('statNumber', c.statNumber); add('statLabel', c.statLabel); add('quoteAuthor', c.quoteAuthor);
    add('splitLeft', c.splitLeft); add('splitRight', c.splitRight); add('footer', c.footer);
    if (c.listItems?.length) rows.push(`- list items (one "list" node shows them all): ${c.listItems.map((x) => `"${x}"`).join(' | ')}`);
    if (c.accentPhrase) rows.push(`- accent phrase inside the headline: "${c.accentPhrase}"`);
    if (c.icon) rows.push(`- suggested icon: ${c.icon}`);
    if (c.doodleUrl) rows.push('- has an illustration (image node)');
    return rows.join('\n');
};

/** Strips the draft to what the composer needs to see (smaller prompt, same meaning). */
const draftJson = (d: SlideDesign) => JSON.stringify({ bg: d.bg, root: d.root, decor: d.decor || [] });

export interface ComposeOutcome {
    design: SlideDesign;
    extras?: Record<string, string>;
    /** Composer output was used (false: the library draft). */
    composed: boolean;
    reason?: string;
}

export const composeSlide = async (params: {
    draft: DraftSlide;
    index: number;
    total: number;
    style: DesignStyle;
    plan: SlidePlan;
    format: CarouselFormat;
    theme: CarouselTheme | null;
    instruction?: string;
    outputLanguage?: string;
    banned?: string[];
    allowEmoji?: boolean;
    signature?: boolean;
    seed: number;
}): Promise<ComposeOutcome> => {
    const { draft, index, total, style, plan, format } = params;
    const content = contentOfDraft(draft, {});
    const libDraft = designSlide(draft.blockType, content, style, { archetype: plan.archetype, seed: params.seed, invert: plan.invert, index, total });
    const libFit = estimateFill(libDraft, content, { format: format === 'square' ? 'square' : 'portrait', signature: params.signature !== false });
    const prompt = `You design ONE slide of a carousel as a layout tree. The words are final; you decide how they are arranged and emphasised.

SLIDE ${index + 1} of ${total} [${draft.blockType}] on a ${format === 'square' ? '1080×1080' : '1080×1350'} canvas. Margins, the author's signature (bottom-left) and shrinking text to fit are handled by the renderer.
DECK LOOK: ${style.direction} (${DIRECTION_PRESETS[style.direction].blurb}) · fonts ${FONT_PAIRS[style.fonts].label} · corners ${style.radius} · headline accent ${style.mark}${plan.invert ? ` · this slide is filled with the ${plan.invert} color: text on it uses onAccent/bg roles` : ''}.
${plan.idea ? `ART DIRECTOR'S IDEA FOR THIS SLIDE: ${plan.idea}` : ''}
${params.instruction ? `THE USER'S REQUEST FOR THIS SLIDE: ${untrusted('design_request', params.instruction, 600)}` : ''}

CONTENT (field: text)
${fieldsBlock(content)}

DRAFT (a solid starting point from the layout library; improve it for this content rather than starting over, unless the idea or request calls for something else):
${draftJson(libDraft)}

${LANGUAGE_SPEC}
ICON names: ${SHARED_ICONS.slice(0, 60).join(', ')}

EXTRAS (optional, at most 2): short labels you add for design, e.g. a sticker "vs", "Myth", "Try this". Put them in "extras" as {"key": "text"} and show them with field "x.key". Under 24 characters, ${languageRule(params.outputLanguage || '')} No numbers unless the same number is already on the slide.

RULES
- Show every content field above exactly once (all list items through one list node). Don't invent text.
- One focal point: the most important thing on this slide is clearly the biggest.
- Keep it readable: text on accent fills uses onAccent, body copy never sits on busy decoration, at most 3 colors of text.
- Leave room: long text gets smaller steps, short text can go big. Don't nest more than 4 levels. At most 40 nodes.
- Decoration stays at the edges and out of the bottom-left corner (the signature lives there).

Return JSON: { "root": {...}, "bg": {...}, "decor": [...], "extras": {...} }`;

    try {
        const raw = await ask<any>({ role: 'writer', label: 'design.compose', temperature: 0.7 }, prompt, COMPOSER_SCHEMA);
        const extras = cleanExtras(raw?.extras, draft, { banned: params.banned, allowEmoji: params.allowEmoji });
        const withExtras = contentOfDraft(draft, extras);
        const lint = lintDesign(raw, withExtras, { blockType: draft.blockType, style, archetype: plan.archetype, seed: params.seed, invert: plan.invert });
        if (lint.fatal) return { design: libDraft, composed: false, reason: 'no layout returned' };
        if (lint.problems.length > 8 || lint.added.length > 2) return { design: libDraft, composed: false, reason: `too many repairs (${[...lint.problems, ...lint.added].slice(0, 4).join(', ')})` };
        const fit = estimateFill(lint.design, withExtras, { format: format === 'square' ? 'square' : 'portrait', signature: params.signature !== false });
        // Reject layouts that would need heavy shrinking, or much more than the draft needs.
        if (fit.fit < 0.72 || fit.fit < libFit.fit - 0.2) return { design: libDraft, composed: false, reason: `would shrink text to ${Math.round(fit.fit * 100)}%` };
        // Only keep extras the tree actually shows.
        const shown = new Set(JSON.stringify(lint.design.root).match(/"x\.[a-zA-Z0-9]+"/g)?.map((m) => m.slice(3, -1)) || []);
        const kept = Object.fromEntries(Object.entries(extras).filter(([k]) => shown.has(k)));
        return { design: { ...lint.design, composed: true }, extras: Object.keys(kept).length ? kept : undefined, composed: true };
    } catch (err) {
        if (/cancel/i.test(String((err as any)?.message || err))) throw err;
        console.warn(`[v2.design] composer failed on slide ${index + 1}, using the library layout:`, err);
        return { design: libDraft, composed: false, reason: 'model call failed' };
    }
};

// ── deck ───────────────────────────────────────────────────────────────────

export interface DeckDesignResult {
    style: DesignStyle;
    designs: SlideDesign[];
    /** Extra labels per slide (undefined: none). */
    extras: (Record<string, string> | undefined)[];
    composed: number;
    fallbacks: number;
    rationale?: string;
    source: 'model' | 'library';
}

const envFlag = (key: string, fallback: boolean) => {
    try {
        const v = typeof process !== 'undefined' ? process.env?.[key] : undefined;
        if (!v) return fallback;
        return !/^(0|off|false|no)$/i.test(v.trim());
    } catch {
        return fallback;
    }
};

/** Runs async jobs with bounded concurrency, preserving order. */
const pool = async <T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> => {
    const out: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i], i);
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};

/**
 * Designs a deck (or some of its slides) for the Canvas.
 *  - no `style`: the Design Director picks the look; with `style`: it's kept.
 *  - `only`: redesign just these slides (0-based); the rest keep `existing`.
 */
export const designDeckWithAI = async (params: {
    drafts: DraftSlide[];
    topic: string;
    brief?: CreativeBrief;
    userText?: string;
    theme: CarouselTheme | null;
    format?: CarouselFormat;
    style?: DesignStyle;
    only?: number[];
    existing?: (StoredDesign | undefined)[];
    instruction?: string;
    seed?: number;
    outputLanguage?: string;
    banned?: string[];
    allowEmoji?: boolean;
    signature?: boolean;
    /** Defaults: DESIGN_DIRECTOR / DESIGN_COMPOSER env (on). */
    useDirector?: boolean;
    useComposer?: boolean;
    progress?: (done: number, total: number) => void | Promise<void>;
    /** A director call already under way (started from the outline). */
    director?: Promise<DirectorOutput>;
    /** Composer calls in flight at once (default 4). */
    concurrency?: number;
}): Promise<DeckDesignResult> => {
    const { drafts } = params;
    const format: CarouselFormat = params.format === 'square' ? 'square' : 'portrait';
    const seed = params.seed ?? hashString(`${params.topic}:${drafts.length}`);
    const useDirector = params.useDirector ?? envFlag('DESIGN_DIRECTOR', true);
    const useComposer = params.useComposer ?? envFlag('DESIGN_COMPOSER', true);
    const only = params.only?.filter((i) => Number.isInteger(i) && i >= 0 && i < drafts.length);
    const targets = only && only.length ? only : drafts.map((_, i) => i);

    const plan = params.director
        ? planFromDirector(drafts, await params.director, seed)
        : await directDeck({ drafts, topic: params.topic, brief: params.brief, userText: [params.userText, params.instruction].filter(Boolean).join('\n'), theme: params.theme, seed, style: params.style, useModel: useDirector });
    // A partial redesign keeps the other slides' layouts: the plan for them is what they have.
    if (only && only.length && params.existing) {
        params.existing.forEach((d, i) => {
            if (targets.includes(i) || !d) return;
            const id = (d as any).archetype;
            if (typeof id === 'string' && ARCHETYPE_BY_ID.get(id)?.block === toBlock(drafts[i].blockType)) plan.slides[i] = { ...plan.slides[i], archetype: id, invert: (d as any).invert };
        });
        // A redesigned slide should look different from what it was.
        for (const i of targets) {
            const was = (params.existing[i] as any)?.archetype;
            if (was && plan.slides[i].archetype === was && !params.instruction) {
                const alt = pickArchetype(drafts[i].blockType, contentOfDraft(drafts[i]), plan.style, seed + i + 1, [was, plan.slides[i - 1]?.archetype || '', plan.slides[i + 1]?.archetype || '']);
                plan.slides[i] = { ...plan.slides[i], archetype: alt.id };
            }
        }
    }

    const designs: SlideDesign[] = [];
    const extras: (Record<string, string> | undefined)[] = drafts.map((d) => d.extras);
    let composed = 0;
    let fallbacks = 0;
    let done = 0;
    const slideSeed = (i: number) => hashString(`${seed}:${i}:${drafts[i].blockType}`);

    // Slides we aren't touching keep what they have (rebuilt from recipes where needed).
    drafts.forEach((d, i) => {
        if (targets.includes(i)) return;
        const existing = params.existing?.[i];
        if (existing && !isDesignRef(existing) && (existing as SlideDesign).root) designs[i] = { ...(existing as SlideDesign), style: plan.style };
        else designs[i] = designSlide(d.blockType, contentOfDraft(d), plan.style, { archetype: plan.slides[i].archetype, seed: (existing as any)?.seed ?? slideSeed(i), invert: plan.slides[i].invert, index: i, total: drafts.length });
    });

    const results = await pool(targets, Math.max(1, params.concurrency ?? 4), async (i) => {
        const d = drafts[i];
        if (!useComposer) {
            return { i, out: { design: designSlide(d.blockType, contentOfDraft(d, {}), plan.style, { archetype: plan.slides[i].archetype, seed: slideSeed(i), invert: plan.slides[i].invert, index: i, total: drafts.length }), composed: false } as ComposeOutcome };
        }
        const out = await withSpan('design.compose', { index: i }, () => composeSlide({
            draft: d, index: i, total: drafts.length, style: plan.style, plan: plan.slides[i], format, theme: params.theme,
            instruction: params.instruction, outputLanguage: params.outputLanguage, banned: params.banned, allowEmoji: params.allowEmoji,
            signature: params.signature, seed: slideSeed(i),
        }));
        done++;
        await params.progress?.(done, targets.length);
        return { i, out };
    });
    for (const { i, out } of results) {
        designs[i] = out.design;
        // A redesigned slide's labels are replaced by what the new design shows.
        extras[i] = out.extras;
        if (out.composed) composed++;
        else if (useComposer) fallbacks++;
    }
    return { style: plan.style, designs, extras, composed, fallbacks, rationale: plan.rationale, source: plan.source };
};

/** Instant library designs for a whole deck (no model): used when a deck is switched to the Canvas. */
export const libraryDeckDesigns = (drafts: DraftSlide[], style: DesignStyle, seed = 1): SlideDesign[] => {
    const plan = repairPlan(drafts, style, [], seed);
    return drafts.map((d, i) => designSlide(d.blockType, contentOfDraft(d, {}), style, { archetype: plan[i].archetype, seed: hashString(`${seed}:${i}:${d.blockType}`), invert: plan[i].invert, index: i, total: drafts.length }));
};

/** Library designs that follow a director's plan (the Canvas draft preview, before the composers finish). */
export const designsFromPlan = (drafts: DraftSlide[], plan: DeckPlan, seed = 1): SlideDesign[] =>
    drafts.map((d, i) => designSlide(d.blockType, contentOfDraft(d, {}), plan.style, { archetype: plan.slides[i].archetype, seed: hashString(`${seed}:${i}:${d.blockType}`), invert: plan.slides[i].invert, index: i, total: drafts.length }));

export const designEnvFlag = envFlag;

const TEXT_KEYS = ['blockType', 'preHeader', 'headline', 'body', 'footer', 'statNumber', 'statLabel', 'quoteAuthor', 'splitLeft', 'splitRight', 'accentPhrase'] as const;
/** The words a slide shows (what a layout was shaped for). */
export const copyKey = (d: DraftSlide) => JSON.stringify([...TEXT_KEYS.map((k) => (d as any)[k] || ''), d.listItems || []]);

/**
 * Designs are composed while the editor is still reviewing the copy. This
 * brings them up to date with the final words: slides whose copy didn't
 * change keep their layout; a changed slide keeps it too if it still shows
 * every field, fits without heavy shrinking and its labels are still valid;
 * otherwise that slide alone is composed again.
 */
export const refitDesigns = async (params: {
    drafts: DraftSlide[];
    /** The copy the designs were composed for. */
    seen: DraftSlide[];
    result: DeckDesignResult;
    format?: CarouselFormat;
    theme: CarouselTheme | null;
    outputLanguage?: string;
    banned?: string[];
    allowEmoji?: boolean;
    signature?: boolean;
    seed?: number;
    useComposer?: boolean;
    concurrency?: number;
}): Promise<DeckDesignResult & { recomposed: number }> => {
    const { drafts, seen, result } = params;
    const style = result.style;
    const format: CarouselFormat = params.format === 'square' ? 'square' : 'portrait';
    const fmt = format === 'square' ? 'square' : 'portrait';
    const useComposer = params.useComposer ?? envFlag('DESIGN_COMPOSER', true);
    const seed = params.seed ?? 1;
    const designs = result.designs.slice();
    const extras = result.extras.slice();
    const redo: number[] = [];

    drafts.forEach((d, i) => {
        const before = seen[i];
        const design = designs[i];
        if (!design || !before) { redo.push(i); return; }
        if (copyKey(d) === copyKey(before)) return;
        if (d.blockType !== before.blockType) { redo.push(i); return; }
        const kept = extras[i] ? cleanExtras(extras[i], d, { banned: params.banned, allowEmoji: params.allowEmoji }) : undefined;
        if (extras[i] && Object.keys(kept || {}).length !== Object.keys(extras[i] || {}).length) { redo.push(i); return; }
        const content = contentOfDraft(d, kept);
        if (!design.composed) {
            // Library layout: rebuild it for the new words (same layout if it still suits them).
            const valid = archetypesFor(d.blockType, content).some((a) => a.id === design.archetype);
            designs[i] = designSlide(d.blockType, content, style, { archetype: valid ? design.archetype : undefined, seed: design.seed, invert: design.invert, index: i, total: drafts.length });
            return;
        }
        const lint = lintDesign(design, content, { blockType: d.blockType, style, archetype: design.archetype, seed: design.seed, invert: design.invert });
        const fit = estimateFill(lint.design, content, { format: fmt, signature: params.signature !== false });
        if (lint.fatal || lint.added.length || fit.fit < 0.72) redo.push(i);
    });

    let recomposed = 0;
    let composed = result.composed;
    let fallbacks = result.fallbacks;
    await pool(redo, Math.max(1, params.concurrency ?? 4), async (i) => {
        const d = drafts[i];
        const content = contentOfDraft(d, {});
        const old = designs[i];
        const valid = !!old && archetypesFor(d.blockType, content).some((a) => a.id === old.archetype);
        const plan: SlidePlan = {
            archetype: valid ? old!.archetype! : pickArchetype(d.blockType, content, style, hashString(`${seed}:${i}:${d.blockType}`), [designs[i - 1]?.archetype || '', designs[i + 1]?.archetype || '']).id,
            invert: old?.invert,
        };
        const slideSeed = old?.seed ?? hashString(`${seed}:${i}:${d.blockType}`);
        if (old?.composed) composed--;
        else if (useComposer) fallbacks--;
        const out: ComposeOutcome = useComposer
            ? await withSpan('design.recompose', { index: i }, () => composeSlide({
                draft: d, index: i, total: drafts.length, style, plan, format, theme: params.theme,
                outputLanguage: params.outputLanguage, banned: params.banned, allowEmoji: params.allowEmoji, signature: params.signature, seed: slideSeed,
            }))
            : { design: designSlide(d.blockType, content, style, { archetype: plan.archetype, seed: slideSeed, invert: plan.invert, index: i, total: drafts.length }), composed: false };
        designs[i] = out.design;
        extras[i] = out.extras;
        if (out.composed) composed++;
        else if (useComposer) fallbacks++;
        recomposed++;
    });
    // Labels on untouched layouts still have to be valid for the final words.
    drafts.forEach((d, i) => {
        if (redo.includes(i) || !extras[i]) return;
        const kept = cleanExtras(extras[i], d, { banned: params.banned, allowEmoji: params.allowEmoji });
        extras[i] = Object.keys(kept).length ? kept : undefined;
    });
    return { ...result, designs, extras, composed, fallbacks, recomposed };
};
