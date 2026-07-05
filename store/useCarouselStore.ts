/**
 * Carousel Store - Zustand
 * 
 * Manages carousel generation state including slides, templates, themes,
 * branding, and UI state for the carousel generator.
 * 
 * Location: src/store/useCarouselStore.ts
 */

import { create } from 'zustand';
import { CarouselState, SlideContent, CarouselTheme, TemplateId, CarouselFormat, BrandKit, BrandMode, SignaturePosition } from '../types';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_BRAND_KIT: BrandKit = {
    enabled: false,
    identity: {
        name: 'Sikandar Ali',
        title: 'Founder',
        imageUrl: 'https://sgp.cloud.appwrite.io/v1/storage/buckets/693df05200140fb6514a/files/694278bd001f8831ffc8/view?project=6932ab3b00290095e2e1',
    },
    colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        text: '#ffffff',
        background: '#000000',
    },
};

// ============================================================================
// CREATE STORE
// ============================================================================

export const useCarouselStore = create<CarouselState>((set, get) => ({
    // ============================================================================
    // INITIAL STATE
    // ============================================================================

    // Core carousel data
    topic: '',
    selectedTemplate: 'template-1',
    selectedModel: 'gpt-oss-120b',
    selectedFormat: 'portrait',
    selectedPattern: 1,
    patternOpacity: 0.1,
    patternScale: 1,
    patternSpacing: 1,
    slides: [],
    theme: null,
    isGenerating: false,
    pendingDoodleSlides: [],
    chatMessages: [],
    chatSummary: '',
    chatSummarizedUpTo: 0,
    activeCarouselId: null,
    activeJobId: null,
    error: null,

    // Multi-modal input state
    inputMode: 'topic',
    slideCount: 10,
    customInstructions: '',
    outputLanguage: 'English',
    sourceContent: '',

    // Brand kit state
    brandMode: 'preset',
    brandKit: DEFAULT_BRAND_KIT,
    presetId: 'ocean-tech',
    signaturePosition: 'bottom-left',

    // Generation Progress State
    generationStatus: 'Initializing...',
    generationProgress: 0,

    // UI state
    selectedSlideIndex: null,
    rightPanelOpen: false,

    // Getter for activePresetId (for backward compatibility)
    get activePresetId() {
        return get().presetId;
    },

    // ============================================================================
    // CORE ACTIONS
    // ============================================================================

    setTopic: (topic: string) => set({ topic }),



    // ============================================================================
    // UI ACTIONS
    // ============================================================================

    setSelectedSlideIndex: (selectedSlideIndex: number | null) => set({ selectedSlideIndex }),

    setRightPanelOpen: (rightPanelOpen: boolean) => set({ rightPanelOpen }),

    setTemplate: (selectedTemplate: TemplateId) => set({ selectedTemplate }),

    setModel: (selectedModel: string) => set({ selectedModel }),

    setFormat: (selectedFormat: CarouselFormat) => set({ selectedFormat }),

    setPattern: (selectedPattern: number) => set({ selectedPattern }),

    setPatternOpacity: (patternOpacity: number) => set({ patternOpacity }),

    setPatternScale: (patternScale: number) => set({ patternScale }),

    setPatternSpacing: (patternSpacing: number) => set({ patternSpacing }),

    setGenerating: (isGenerating: boolean) => set({ isGenerating }),

    setGenerationStatus: (status: string) => set({ generationStatus: status }),
    setGenerationProgress: (progress: number) => set({ generationProgress: progress }),

    addChatMessage: (message) => set(state => ({ chatMessages: [...state.chatMessages, message] })),
    updateChatMessage: (id, patch) => set(state => ({
        chatMessages: state.chatMessages.map(m => m.id === id ? { ...m, ...patch } : m)
    })),
    clearChat: () => set({ chatMessages: [], chatSummary: '', chatSummarizedUpTo: 0 }),
    setChatMessages: (chatMessages) => set({ chatMessages }),
    setChatSummary: (chatSummary) => set({ chatSummary }),
    setChatSummarizedUpTo: (chatSummarizedUpTo) => set({ chatSummarizedUpTo }),
    setActiveCarouselId: (activeCarouselId) => set({ activeCarouselId }),
    setActiveJobId: (activeJobId) => set({ activeJobId }),

    setPendingDoodleSlides: (indices: number[]) => set({ pendingDoodleSlides: indices }),
    removePendingDoodleSlide: (index: number) => set(state => ({
        pendingDoodleSlides: state.pendingDoodleSlides.filter(i => i !== index)
    })),

    setError: (error: string | null) => set({ error }),

    setSlides: (slides: SlideContent[]) => set({ slides }),

    setTheme: (theme: CarouselTheme) => set({ theme }),

    updateSlide: (index: number, content: Partial<SlideContent>) => {
        const slides = get().slides;
        if (index >= 0 && index < slides.length) {
            const updatedSlides = [...slides];
            updatedSlides[index] = { ...updatedSlides[index], ...content };
            set({ slides: updatedSlides });
        }
    },

    // ============================================================================
    // MULTI-MODAL INPUT ACTIONS
    // ============================================================================

    setInputMode: (inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf') => set({ inputMode }),

    setSlideCount: (slideCount: number) => set({ slideCount }),

    setCustomInstructions: (customInstructions: string) => set({ customInstructions }),

    setOutputLanguage: (outputLanguage: string) => set({ outputLanguage }),

    setSourceContent: (sourceContent: string) => set({ sourceContent }),

    // ============================================================================
    // BRAND KIT ACTIONS
    // ============================================================================

    setBrandMode: (brandMode: BrandMode) => set({ brandMode }),

    setBrandKit: (brandKit: Partial<BrandKit>) => {
        const currentBrandKit = get().brandKit;
        set({
            brandKit: {
                ...currentBrandKit,
                ...brandKit,
                identity: {
                    ...currentBrandKit.identity,
                    ...(brandKit.identity || {}),
                },
                colors: {
                    ...currentBrandKit.colors,
                    ...(brandKit.colors || {}),
                },
            },
        });
    },

    setPresetId: (presetId: string) => set({ presetId }),

    setSignaturePosition: (signaturePosition: SignaturePosition) => set({ signaturePosition }),

    resetToGlobalBrand: () => {
        set({
            brandMode: 'preset',
            // Note: brandKit should be loaded from global profile in the component using this hook
        });
    },

    reset: () => {
        set({
            topic: '',
            selectedTemplate: 'template-1',
            selectedModel: 'gpt-oss-120b',
            selectedFormat: 'portrait',
            selectedPattern: 1,
            patternOpacity: 0.1,
            patternScale: 1,
            patternSpacing: 1,
            slides: [],
            theme: null,
            isGenerating: false,
    pendingDoodleSlides: [],
            chatMessages: [],
            chatSummary: '',
            chatSummarizedUpTo: 0,
            activeCarouselId: null,
            activeJobId: null,
            error: null,
            inputMode: 'topic',
            slideCount: 10,
            customInstructions: '',
            outputLanguage: 'English',
            sourceContent: '',
            brandMode: 'preset',
            brandKit: DEFAULT_BRAND_KIT,
            presetId: 'ocean-tech',
            signaturePosition: 'bottom-left',
            generationStatus: 'Initializing...',
            generationProgress: 0,
            selectedSlideIndex: null,
            rightPanelOpen: false,
        });
    },

}));

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get carousel generation status
 */
export const useIsGenerating = () => {
    return useCarouselStore(state => state.isGenerating);
};

/**
 * Hook to get slides
 */
export const useSlides = () => {
    return useCarouselStore(state => state.slides);
};

/**
 * Hook to get current theme
 */
export const useTheme = () => {
    return useCarouselStore(state => state.theme);
};
