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
}));