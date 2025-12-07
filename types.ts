export type TemplateId = 'template-1' | 'template-2';
export type SlideVariant = 'hero' | 'body' | 'list' | 'cta';
export type AIModel = 'groq-llama' | 'claude-haiku';
export type SignaturePosition = 'bottom-left' | 'top-left' | 'top-right';
export type CarouselFormat = 'portrait' | 'square';

export interface BrandingConfig {
  enabled: boolean;
  name: string;
  title: string;
  imageUrl: string;
  position: SignaturePosition;
}

export interface SlideContent {
  id: string;
  variant: SlideVariant;
  preHeader?: string;
  headline: string;
  body?: string;
  listItems?: string[];
  footer?: string;
}

export interface CarouselTheme {
  // Common / Template 1 & 2 Shared
  textDefault?: string;      // --text-default
  textHighlight?: string;    // --text-highlight
  background?: string;       // --background
  background2?: string;      // --background-2 (Secondary/Accent)

  // Template 2 Specific Gradient Stops
  bgGradStart?: string;      // --bg-grad-start
  bgGradEnd?: string;        // --bg-grad-end
}

export interface CarouselState {
  topic: string;
  selectedTemplate: string;
  selectedModel: string;
  selectedFormat: CarouselFormat;
  slides: SlideContent[];
  theme: CarouselTheme | null;
  isGenerating: boolean;
  error: string | null;

  // Brand Kit State
  activePresetId: string;
  isBrandKitActive: boolean;

  // Branding (Signature Card) State
  branding: BrandingConfig;

  // Actions
  setTopic: (topic: string) => void;
  setTemplate: (selectedTemplate: string) => void;
  setModel: (selectedModel: string) => void;
  setFormat: (selectedFormat: CarouselFormat) => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  setSlides: (slides: SlideContent[]) => void;
  setTheme: (theme: CarouselTheme) => void;
  updateSlide: (index: number, content: Partial<SlideContent>) => void;

  // Brand Kit Actions
  setActivePreset: (presetId: string | null) => void;
  toggleBrandKit: (isActive: boolean) => void;

  // Branding Actions
  setBranding: (branding: Partial<BrandingConfig>) => void;
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