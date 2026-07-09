export type TemplateId = 'template-1' | 'template-3' | 'template-4';
export type SlideVariant = 'hero' | 'body' | 'list' | 'cta' | 'closing';  // 'closing' is what LLM generates, 'cta' is template name
export type AIModel = 'groq-llama' | 'claude-haiku';
export type SignaturePosition = 'bottom-left' | 'top-left' | 'top-right';
export type CarouselFormat = 'portrait' | 'square';

// ============================================================================
// BRAND KIT SYSTEM - Unified Branding with Global/Local Inheritance
// ============================================================================

/**
 * Brand identity components (name, title, image)
 */
export interface BrandIdentity {
  name: string;
  title: string;
  imageUrl: string;
}

/**
 * Brand color palette (primary, secondary, text, background)
 * These are the 4 seed colors that generate full theme via brandUtils
 */
export interface BrandColors {
  primary: string;
  secondary: string;
  text: string;
  background: string;
}

/**
 * Complete Brand Kit container
 * Stored in user profile (global) and can be overridden per carousel (local)
 */
export interface BrandKit {
  enabled: boolean;
  identity: BrandIdentity;
  colors: BrandColors;
}

/**
 * Brand mode determines the source of branding for a carousel
 * - preset: Use color preset from config/colorPresets.ts (identity from global)
 * - custom: Use carousel-specific brand kit (synced with global profile)
 */
export type BrandMode = 'preset' | 'custom';

/**
 * Legacy branding config - kept for backward compatibility
 * @deprecated Use BrandKit instead
 */
export interface BrandingConfig {
  enabled: boolean;
  name: string;
  title: string;
  imageUrl: string;
  position: SignaturePosition;
}

export interface ListItemObject {
  bullet: string;
  description: string;
}

export interface SlideContent {
  id: string;
  variant: SlideVariant;
  preHeader?: string;
  headline: string;
  body?: string;
  listItems?: (string | ListItemObject)[];
  footer?: string;
  icon?: string;  // Lucide icon name (e.g., "Lightbulb", "Target", "TrendingUp")
  doodlePrompt?: string; // AI image prompt for Template-3 doodles
  doodleUrl?: string;    // Resulting Replicate/Appwrite image URL
  accentPhrase?: string; // Template-4: exact substring of headline rendered in the accent color
}

export interface CarouselTheme {
  // Common / Template 1 & 2 Shared
  textDefault?: string;      // --text-default
  textHighlight?: string;    // --text-highlight
  background?: string;       // --background
  background2?: string;      // --background-2 (Secondary/Accent)
  patternColor?: string;     // --pattern-color (white or black)
  patternOpacity?: string;   // --pattern-opacity (0.1 or 0.2)

  // Template 2 Specific Gradient Stops
  bgGradStart?: string;      // --bg-grad-start
  bgGradEnd?: string;        // --bg-grad-end
  buttonColor?: string;      // --button-color (Template 2 Swipe/Follow buttons)

  // Customization flag (future use)
  customized?: boolean;
}

/**
 * One agent activity line inside a chat run (e.g. "Researched 4 sources")
 */
export interface ChatRunEvent {
  label: string;
  done: boolean;
}

/**
 * A clickable quick-reply chip rendered inside an assistant message.
 * The user clicks one or more chips to answer a clarifying question
 * from the Creative Director, then hits Go.
 */
export interface QuickReplyChip {
  label: string;   // e.g. "😂 Funny & casual"
  value: string;   // e.g. "funny and casual"
}

/**
 * A message in the chat-driven editor
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Agent activity timeline shown while/after this assistant turn runs */
  events?: ChatRunEvent[];
  /** True while this assistant turn is still producing output */
  running?: boolean;
  error?: boolean;
  /**
   * When set, the assistant message includes interactive quick-reply chips.
   * The user selects chips (and/or types a free-text answer) then submits.
   * The ChatPanel handles rendering and submission; once submitted this
   * field is cleared so it becomes a normal read-only message.
   */
  quickReplies?: {
    groups: Array<{
      question: string;
      chips: QuickReplyChip[];
      multiSelect?: boolean;
    }>;
    /** Callback identifier the ChatPanel uses to resume generation */
    resumeToken: string;
  };
}

// ============================================================================
// CREATIVE BRIEF — output of the Creative Director Agent
// ============================================================================

export type ContentType =
  | 'EDUCATIONAL'     // Factual explainer — stay on topic, no business metaphors
  | 'ENTERTAINMENT'   // Comedy / fun — factual accuracy nice but not critical
  | 'EDUTAINMENT'     // Educational + funny (e.g. Tanmay Bhat style science)
  | 'PROFESSIONAL'    // LinkedIn thought leadership — viral angle appropriate
  | 'STORYTELLING'    // Narrative arc — personal or historical story
  | 'HOW_TO'          // Step-by-step tutorial
  | 'OPINION';        // Contrarian / debate take

export type ApproachMode =
  | 'VIRAL_ANGLE'     // Strategist generates a LinkedIn hook (current default)
  | 'FACTUAL_SPINE'   // Strategist generates ordered key facts (educational)
  | 'NARRATIVE_ARC'   // Strategist generates a story arc (storytelling)
  | 'HOW_TO_STEPS';   // Strategist generates a step list (how-to)

export type IllustrationMode =
  | 'LITERAL'         // Draw actual subject matter (dinosaurs, asteroids)
  | 'METAPHORICAL'    // Abstract business metaphor scenes (current default)
  | 'CHARACTER';      // Expressive cartoon characters (comedy/entertainment)

export interface CreativeBrief {
  topic: string;
  contentType: ContentType;
  /**
   * How many slides this carousel should have.
   * The Creative Director decides based on content type and complexity.
   * Hard bounds: min 2, max 20. Falls back to 7 if not provided.
   */
  suggestedSlideCount?: number;
  /**
   * Detected or requested language for the final carousel.
   * e.g., "Spanish", "French", "German", "Portuguese", "Hindi", "English".
   */
  outputLanguage?: string;
  /**
   * Optional message shown to the user when the requested slide count
   * was out of bounds and had to be adjusted (e.g. capped at 20).
   */
  slideCountNote?: string;
  audience: {
    type: 'GENERAL' | 'KIDS' | 'STUDENTS' | 'PROFESSIONALS' | 'NICHE';
    description: string;          // e.g. "curious adults and teenagers"
  };

  creativeStyle: {
    styleReference?: string;      // "Tanmay Bhat", "Paul Graham", etc.
    toneDescription: string;      // Prose description of voice/tone
    vocabulary: 'SIMPLE' | 'CASUAL' | 'PROFESSIONAL' | 'ACADEMIC';
    humorAllowed: boolean;
    popCultureAllowed: boolean;
  };
  contentStrategy: {
    approachMode: ApproachMode;
    mustStayOnTopic: boolean;         // false only for PROFESSIONAL viral angles
    businessMetaphorsAllowed: boolean;
    stayFactuallyAccurate: boolean;
  };
  visualStyle: {
    illustrationMode: IllustrationMode;
    emotionToConvey: string;          // e.g. "Awe, curiosity, humor"
  };
}

export interface CarouselState {
  topic: string;
  selectedTemplate: TemplateId;
  selectedModel: string;
  selectedFormat: CarouselFormat;
  selectedPattern: number;  // Background pattern ID (1-12)
  patternOpacity: number;   // User-controlled pattern opacity (0-1)
  patternScale: number;     // User-controlled pattern scale (0.5-2.0)
  patternSpacing: number;   // User-controlled pattern spacing (scale factor)
  slides: SlideContent[];
  theme: CarouselTheme | null;
  isGenerating: boolean;
  error: string | null;

  generationStatus: string;
  generationProgress: number;  // 0-100

  /**
   * Slide indices whose Template-3 doodle is still being generated in the
   * background (placeholder currently shown). Not persisted.
   */
  pendingDoodleSlides: number[];

  /**
   * Chat-driven editor conversation (persisted per carousel via chatService).
   */
  chatMessages: ChatMessage[];

  /**
   * Rolling conversation memory for this carousel — durable notes the
   * orchestrator extracted from earlier turns, plus a compacted account of
   * older messages once they scroll out of the raw history window.
   */
  chatSummary: string;

  /**
   * How many of the oldest chatMessages have already been folded into
   * chatSummary — lets the compaction pass fold only the new backlog
   * instead of re-summarizing messages it already covered.
   */
  chatSummarizedUpTo: number;

  /**
   * The single source of truth for "which carousel document am I pointed at" —
   * null for an unsaved/new carousel. Read directly by useAutoSave, the
   * history sidebar, and anything else that needs carousel identity, instead
   * of being threaded through component props (that split was the root cause
   * of a duplicate-carousel-creation bug and a carousel-switch race).
   */
  activeCarouselId: string | null;

  /**
   * The background job (generation_jobs doc id) the currently-open carousel
   * view is watching, or null if nothing is in flight. Set the moment a
   * create/edit job is dispatched; cleared when it resolves or a different
   * carousel is loaded. The App-level job watcher uses this to know which
   * job's updates should be applied to the live UI — see hooks/useJobWatcher.ts.
   */
  activeJobId: string | null;

  // Multi-modal Input State
  inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf';
  slideCount: number;
  customInstructions?: string;
  outputLanguage: string;
  sourceContent: string;

  // ============================================================================
  // BRAND KIT STATE - Unified Branding System
  // ============================================================================

  /**
   * Brand mode: determines the source of branding
   * - 'preset': Use color preset (for colors only, identity from brandKit/global)
   * - 'custom': Use custom brand kit specific to this carousel (synced with global)
   */
  brandMode: BrandMode;

  /**
   * Brand kit (used in both preset and custom modes)
   * - In 'custom' mode: used for identity AND colors
   * - In 'preset' mode: used for identity only
   * This is always kept in sync with the global profile brand kit.
   */
  brandKit: BrandKit;

  /**
   * Active preset ID (only used when brandMode === 'preset')
   */
  presetId: string;

  /**
   * Signature position (carousel-specific, always shown)
   */
  signaturePosition: SignaturePosition;

  // UI State for Floating Toolbars
  selectedSlideIndex: number | null;
  rightPanelOpen: boolean;

  // Actions
  setTopic: (topic: string) => void;
  setTemplate: (selectedTemplate: TemplateId) => void;
  setModel: (selectedModel: string) => void;
  setFormat: (selectedFormat: CarouselFormat) => void;
  setPattern: (selectedPattern: number) => void;
  setPatternOpacity: (opacity: number) => void;
  setPatternScale: (scale: number) => void;
  setPatternSpacing: (spacing: number) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGenerationStatus: (status: string) => void;
  setGenerationProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setSlides: (slides: SlideContent[]) => void;
  setTheme: (theme: CarouselTheme) => void;
  updateSlide: (index: number, content: Partial<SlideContent>) => void;
  setPendingDoodleSlides: (indices: number[]) => void;
  removePendingDoodleSlide: (index: number) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setChatSummary: (summary: string) => void;
  setChatSummarizedUpTo: (index: number) => void;
  setActiveCarouselId: (id: string | null) => void;
  setActiveJobId: (id: string | null) => void;

  // Multi-modal Input Actions
  setInputMode: (inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf') => void;
  setSlideCount: (slideCount: number) => void;
  setCustomInstructions: (customInstructions: string) => void;
  setOutputLanguage: (outputLanguage: string) => void;
  setSourceContent: (sourceContent: string) => void;

  // ============================================================================
  // BRAND KIT ACTIONS - Unified Branding System
  // ============================================================================

  /**
   * Set brand mode (global, preset, or custom)
   */
  setBrandMode: (mode: BrandMode) => void;

  /**
   * Update brand kit (used for custom mode)
   */
  setBrandKit: (brandKit: Partial<BrandKit>) => void;

  /**
   * Set active preset ID (used for preset mode)
   */
  setPresetId: (presetId: string) => void;

  /**
   * Set signature position
   */
  setSignaturePosition: (position: SignaturePosition) => void;

  /**
   * Reset brand to default state
   * Sets brandMode to 'preset'
   */
  resetToGlobalBrand: () => void;

  // UI Actions
  setSelectedSlideIndex: (index: number | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  reset: () => void;
}

export interface TemplateAgent {
  id: TemplateId;
  name: string;
  description: string;
  constraints: {
    headlineCharLimit: number;
    bodyCharLimit: number;
  };
}