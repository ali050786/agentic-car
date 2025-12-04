import { create } from 'zustand';
import { CarouselState } from '../types';

export const useCarouselStore = create<CarouselState>((set) => ({
  topic: '',
  selectedTemplate: 'template-1',
  slides: [],
  theme: null,
  isGenerating: false,
  error: null,

  setTopic: (topic) => set({ topic }),
  setTemplate: (selectedTemplate) => set({ selectedTemplate }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  setSlides: (slides) => set({ slides }),
  setTheme: (theme) => set({ theme }),
  updateSlide: (index, content) => set((state) => {
    const newSlides = [...state.slides];
    newSlides[index] = { ...newSlides[index], ...content };
    return { slides: newSlides };
  }),
}));