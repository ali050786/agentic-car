import { create } from 'zustand';
import { CarouselState } from '../types';

export const useCarouselStore = create<CarouselState>((set) => ({
  topic: '',
  selectedTemplate: 'template-1',
  selectedModel: 'groq-llama',
  selectedFormat: 'portrait',
  selectedPattern: 1,  // Default pattern (Diagonal Lines)
  patternOpacity: 0.2,  // Default pattern opacity
  slides: [],
  theme: null,
  isGenerating: false,
  error: null,

  // Multi-modal Input State
  inputMode: 'topic',
  slideCount: 8,
  customInstructions: '',
  outputLanguage: 'English',
  sourceContent: '',

  // Brand Kit State - Default to 'ocean-tech' preset, inactive
  activePresetId: 'ocean-tech',
  isBrandKitActive: false,

  // Branding State - Always enabled by default
  branding: {
    enabled: true,
    name: 'Sikandar Ali',
    title: 'Founder',
    imageUrl: 'https://images.unsplash.com/photo-1695927621677-ec96e048dce2?q=80&w=870',
    position: 'bottom-left'
  },

  // UI State for Floating Toolbars
  selectedSlideIndex: null,
  bottomToolExpanded: null,
  rightPanelOpen: false,
  viewMode: 'focus',

  setTopic: (topic) => set({ topic }),
  setTemplate: (selectedTemplate) => set({ selectedTemplate }),
  setModel: (selectedModel) => set({ selectedModel }),
  setFormat: (selectedFormat) => set({ selectedFormat }),
  setPattern: (selectedPattern) => set({ selectedPattern }),
  setPatternOpacity: (patternOpacity) => set({ patternOpacity }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  setSlides: (slides) => set({ slides }),
  setTheme: (theme) => set({ theme }),
  updateSlide: (index, content) => set((state) => {
    const newSlides = [...state.slides];
    newSlides[index] = { ...newSlides[index], ...content };
    return { slides: newSlides };
  }),

  // Multi-modal Input Actions
  setInputMode: (inputMode) => set({ inputMode }),
  setSlideCount: (slideCount) => set({ slideCount }),
  setCustomInstructions: (customInstructions) => set({ customInstructions }),
  setOutputLanguage: (outputLanguage) => set({ outputLanguage }),
  setSourceContent: (sourceContent) => set({ sourceContent }),

  // Brand Kit Actions
  setActivePreset: (presetId) => set({ activePresetId: presetId }),
  toggleBrandKit: (isActive) => set({ isBrandKitActive: isActive }),

  // Branding Actions
  setBranding: (branding) => set((state) => ({
    branding: { ...state.branding, ...branding }
  })),

  // UI Actions
  setSelectedSlideIndex: (index) => set({ selectedSlideIndex: index }),
  setBottomToolExpanded: (tool) => set({ bottomToolExpanded: tool }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));