/**
 * Shared types for the v2 agent pipeline.
 *
 * A DraftSlide is the pipeline's working unit: a flat, block-aware slide that
 * every stage (outline → writer → validators → critic → proofread) reads and
 * writes. It is converted to the saved SlideContent shape exactly once, at the
 * end (see slides.ts), so rich blocks (stat/quote/split) are never flattened.
 */

import type { CreativeBrief, StructuredMemory, TemplateId, CarouselTheme, SlideContent, SlideLayoutSlots, SlideLayoutVisual, BlockType } from '../../../types';

export type BlockKind = 'hero' | 'body' | 'list' | 'stat' | 'quote' | 'split' | 'closing';

export interface DraftSlide {
    blockType: BlockKind;
    preHeader?: string;
    headline: string;
    body?: string;
    listItems?: string[];
    footer?: string;
    accentPhrase?: string;
    statNumber?: string;
    statLabel?: string;
    quoteAuthor?: string;
    splitLeft?: string;
    splitRight?: string;
    icon?: string;
    /** Fact ids (F1, F2…) this slide draws on, used by grounding checks. */
    factIds?: string[];
    /** Preserved from a saved slide so edits don't lose ids/images. */
    id?: string;
    doodlePrompt?: string;
    doodleUrl?: string;
    /** Short extra labels kept from older decks (key → text, "x.<key>" fields). */
    extras?: Record<string, string>;
}

/** The saved shape: legacy SlideContent fields plus the Layout IR (blockType/slots/visual). */
export type SavedSlide = SlideContent & {
    blockType?: BlockType;
    slots?: SlideLayoutSlots;
    visual?: SlideLayoutVisual;
};

export interface Fact {
    id: string;
    text: string;
    origin: 'source' | 'research';
    sourceTitle?: string;
    sourceUrl?: string;
}

export interface SourceRef {
    title: string;
    url: string;
}

export interface OutlineBeat {
    blockType: BlockKind;
    purpose: string;
    keyMessage: string;
    factIds: string[];
}

export interface Outline {
    premise: string;
    takeaway: string;
    beats: OutlineBeat[];
}

export interface HookChoice {
    preHeader: string;
    headline: string;
    subline: string;
    accentPhrase?: string;
    score: number;
    candidates: number;
}

export type IssueCode =
    | 'over_limit'
    | 'missing_field'
    | 'accent'
    | 'banned'
    | 'unsupported_number'
    | 'duplicate'
    | 'empty'
    | 'count'
    | 'fragment'
    | 'repeat_number'
    | 'unsupported_claim'
    | 'critic';

export interface Issue {
    /** 0-based slide index (-1 = whole deck). */
    index: number;
    field?: string;
    code: IssueCode;
    message: string;
    /** 'block' issues must be fixed before we ship; 'warn' are best-effort. */
    severity: 'block' | 'warn';
}

export interface CritiqueResult {
    score: number;
    dimensions: Record<string, number>;
    issues: Issue[];
    summary: string;
}

export interface PipelineContext {
    topic: string;
    brief: CreativeBrief;
    templateId: TemplateId;
    slideCount: number;
    outputLanguage: string;
    sourceContent: string;
    memory: StructuredMemory;
    facts: Fact[];
    customInstructions?: string;
}

export interface CreateResultV2 {
    carouselId: string;
    slides: SavedSlide[];
    theme: CarouselTheme;
    outline: Outline;
    facts: Fact[];
    sources: SourceRef[];
    critique?: CritiqueResult;
    hook?: HookChoice;
    issuesRemaining: Issue[];
    /** Restore point: the deck as created (attached to the first reply). */
    versionId?: string;
    /** The first reply's message id in the thread. */
    messageId?: string;
}
