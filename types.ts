export type TemplateId = 'template-1' | 'template-2';
export type SlideVariant = 'hero' | 'body' | 'list' | 'closing';

export interface SlideContent {
  id: string;
  variant: SlideVariant;
  preHeader?: string;
  headline: string;
  headlineHighlight?: string;
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
  selectedTemplate: TemplateId;
  slides: SlideContent[];
  theme: CarouselTheme | null;
  isGenerating: boolean;
  error: string | null;
  
  // Actions
  setTopic: (topic: string) => void;
  setTemplate: (templateId: TemplateId) => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  setSlides: (slides: SlideContent[]) => void;
  setTheme: (theme: CarouselTheme) => void;
  updateSlide: (index: number, content: Partial<SlideContent>) => void;
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