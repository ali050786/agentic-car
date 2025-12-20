export type TemplateId = 'template-1' | 'template-2' | 'template-3';
export type SlideVariant = 'hero' | 'body' | 'list' | 'cta' | 'closing';  // 'closing' is what LLM generates, 'cta' is template name
export type AIModel = 'groq-llama' | 'claude-haiku';
export type SignaturePosition = 'bottom-left' | 'top-left' | 'top-right';
export type CarouselFormat = 'portrait' | 'square';
export type ViewMode = 'focus' | 'grid';

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
  bottomToolExpanded: string | null;
  rightPanelOpen: boolean;
  viewMode: ViewMode;
  isMobileMenuOpen: boolean;

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
  setBottomToolExpanded: (tool: string | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
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