/**
 * Draft ↔ saved slide conversion.
 *
 * v1 converted Layout IR → legacy SlideContent → IR during creation, and the
 * legacy shape has no blockType, so every stat/quote/split slide came back as a
 * plain "body". v2 converts exactly once, into a HYBRID saved slide that carries
 * both the legacy fields (so every existing reader keeps working) and the IR
 * (blockType + slots + visual) the renderer prefers. See utils/slideMigration.ts
 * → slideToLayout, which reads hybrids natively.
 */

import type { TemplateId, BlockType } from '../../../types';
import type { BlockKind, DraftSlide, SavedSlide } from './types';
import { toStoredDesign } from '../../design/canvas';

const legacyVariant = (b: BlockKind): SavedSlide['variant'] =>
    b === 'hero' ? 'hero' : b === 'list' ? 'list' : b === 'closing' ? 'closing' : 'body';

const clean = (s?: string) => (typeof s === 'string' ? s.trim() : undefined);
const nonEmpty = (s?: string) => (s && s.trim() ? s.trim() : undefined);

let seq = 0;
const newId = (templateId: string, i: number) => `${templateId}-s${i}-${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Draft → saved hybrid slide. */
export const draftToSaved = (d: DraftSlide, templateId: TemplateId, index: number): SavedSlide => {
    const preHeader = d.preHeader ? d.preHeader.toUpperCase().trim() : '';
    const headline = clean(d.headline) || '';
    const body = clean(d.body) || '';
    const listItems = d.blockType === 'list' ? (d.listItems || []).map((x) => String(x).trim()).filter(Boolean) : [];
    const footer = clean(d.footer) || '';
    const icon = d.icon || undefined;
    const visual = { icon, doodlePrompt: d.doodlePrompt, doodleUrl: d.doodleUrl };
    const extras = d.extras && Object.keys(d.extras).length ? { ...d.extras } : undefined;
    const design = toStoredDesign(d.design as any);

    return {
        id: d.id || newId(templateId, index),
        variant: legacyVariant(d.blockType),
        blockType: d.blockType as BlockType,
        preHeader,
        headline,
        body,
        listItems,
        footer,
        accentPhrase: nonEmpty(d.accentPhrase),
        icon,
        doodlePrompt: d.doodlePrompt,
        doodleUrl: d.doodleUrl,
        slots: {
            preHeader,
            headline,
            body,
            listItems,
            footer,
            accentPhrase: nonEmpty(d.accentPhrase),
            statNumber: nonEmpty(d.statNumber),
            statLabel: nonEmpty(d.statLabel),
            quoteAuthor: nonEmpty(d.quoteAuthor),
            splitLeft: nonEmpty(d.splitLeft),
            splitRight: nonEmpty(d.splitRight),
            ...(extras ? { extras } : {}),
        },
        visual,
        ...(design ? { design } : {}),
    };
};

const blockOf = (s: any): BlockKind => {
    const b = s?.blockType || s?.variant;
    if (b === 'cta') return 'closing';
    return (['hero', 'body', 'list', 'stat', 'quote', 'split', 'closing'].includes(b) ? b : 'body') as BlockKind;
};

/** Saved (legacy, IR, or hybrid) → draft. Top-level legacy fields win when non-empty (they're what edit paths write). */
export const savedToDraft = (s: any): DraftSlide => {
    const slots = s?.slots || {};
    const pick = (k: string) => {
        const top = s?.[k];
        if (typeof top === 'string' && top.trim()) return top;
        const slot = slots[k];
        return typeof slot === 'string' ? slot : undefined;
    };
    const rawItems = (Array.isArray(s?.listItems) && s.listItems.length ? s.listItems : slots.listItems) || [];
    return {
        id: s?.id,
        blockType: blockOf(s),
        preHeader: pick('preHeader'),
        headline: pick('headline') || '',
        body: pick('body'),
        listItems: rawItems.map((it: any) => (typeof it === 'string' ? it : it?.description ? `${it.bullet}: ${it.description}` : it?.bullet || '')).filter(Boolean),
        footer: pick('footer'),
        accentPhrase: pick('accentPhrase'),
        statNumber: slots.statNumber,
        statLabel: slots.statLabel,
        quoteAuthor: slots.quoteAuthor,
        splitLeft: slots.splitLeft,
        splitRight: slots.splitRight,
        icon: s?.icon || s?.visual?.icon,
        doodlePrompt: s?.doodlePrompt || s?.visual?.doodlePrompt,
        doodleUrl: s?.doodleUrl || s?.visual?.doodleUrl,
        design: s?.design && typeof s.design === 'object' ? s.design : undefined,
        extras: slots.extras && typeof slots.extras === 'object' && !Array.isArray(slots.extras) ? { ...slots.extras } : undefined,
    };
};

/** Re-sync slots/visual after something edited only the legacy top-level fields. */
export const normalizeSaved = (s: any, templateId: TemplateId, index: number): SavedSlide =>
    draftToSaved(savedToDraft(s), templateId, index);

/** Model output → string or undefined. Arrays/objects never reach a text field. */
export const asText = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' ') || undefined;
    if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return asText(o.text ?? o.value ?? o.label ?? o.content);
    }
    return undefined;
};

/** Model output → list of strings; {bullet, description} items become "bullet: description". */
export const asList = (v: unknown): string[] | undefined => {
    if (v === undefined || v === null) return undefined;
    const arr = Array.isArray(v) ? v : [v];
    const out = arr.map((it) => {
        if (it && typeof it === 'object' && !Array.isArray(it)) {
            const o = it as Record<string, unknown>;
            const key = asText(o.bullet ?? o.title ?? o.key ?? o.label);
            const val = asText(o.description ?? o.value ?? o.text ?? o.detail);
            return key && val ? `${key}: ${val}` : key || val || '';
        }
        return asText(it) || '';
    }).map((x) => x.trim()).filter(Boolean);
    return out.length ? out : undefined;
};

/** All human-visible text of a draft, for moderation/grounding/duplicate checks. */
export const draftText = (d: DraftSlide): string =>
    [d.preHeader, d.headline, d.body, ...(d.listItems || []), d.footer, d.statNumber, d.statLabel, d.quoteAuthor, d.splitLeft, d.splitRight, ...Object.values(d.extras || {})]
        .filter((x) => typeof x === 'string' && x.trim())
        .join(' \n ');

/** Compact one-line dump for prompts. */
export const dumpDraft = (d: DraftSlide, i: number): string => {
    const parts = [`Slide ${i + 1} [${d.blockType}]`];
    if (d.preHeader) parts.push(`preHeader: ${d.preHeader}`);
    parts.push(`headline: ${d.headline}`);
    if (d.body) parts.push(`body: ${d.body}`);
    if (d.listItems?.length) parts.push(`listItems: ${d.listItems.join(' | ')}`);
    if (d.statNumber) parts.push(`statNumber: ${d.statNumber}`);
    if (d.statLabel) parts.push(`statLabel: ${d.statLabel}`);
    if (d.quoteAuthor) parts.push(`quoteAuthor: ${d.quoteAuthor}`);
    if (d.splitLeft) parts.push(`splitLeft: ${d.splitLeft}`);
    if (d.splitRight) parts.push(`splitRight: ${d.splitRight}`);
    if (d.footer) parts.push(`footer: ${d.footer}`);
    return parts.join(' | ');
};
