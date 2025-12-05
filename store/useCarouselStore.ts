import { create } from 'zustand';
import { CarouselState } from '../types';

export const useCarouselStore = create<CarouselState>((set) => ({
  topic: '',
  selectedTemplate: 'template-1',
  selectedModel: 'groq-llama',
  slides: [],
  theme: null,
  isGenerating: false,
  error: null,

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

  setTopic: (topic) => set({ topic }),
  setTemplate: (selectedTemplate) => set({ selectedTemplate }),
  setModel: (selectedModel) => set({ selectedModel }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  setSlides: (slides) => set({ slides }),
  setTheme: (theme) => set({ theme }),
  updateSlide: (index, content) => set((state) => {
    const newSlides = [...state.slides];
    newSlides[index] = { ...newSlides[index], ...content };
    return { slides: newSlides };
  }),

  // Brand Kit Actions
  setActivePreset: (presetId) => set({ activePresetId: presetId }),
  toggleBrandKit: (isActive) => set({ isBrandKitActive: isActive }),

  // Branding Actions
  setBranding: (branding) => set((state) => ({
    branding: { ...state.branding, ...branding }
  })),
}));