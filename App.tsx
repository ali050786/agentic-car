/**
 * App Component - Phase 6 Complete
 * 
 * Main application with public carousel viewing and sharing.
 * 
 * Location: src/App.tsx
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useCarouselStore } from './store/useCarouselStore';
import { useAuthStore } from './store/useAuthStore';
import { runAgentWorkflow } from './core/agents/MainAgent';
import { CarouselPreview } from './components/CarouselPreview';
import { downloadAllSvgs } from './utils/downloadUtils';
import { UserMenu } from './components/UserMenu';
import { ProtectedRoute } from './components/ProtectedRoute';
import { updateCarouselContent, Carousel } from './services/carouselService';
import { dbToAppTemplate } from './utils/templateConverter';
import { ThemeSelector } from './components/ThemeSelector';
import { BrandingSelector } from './components/BrandingSelector';
import { FormatSelector } from './components/FormatSelector';
import { PatternSelector } from './components/PatternSelector';
import { resolveTheme } from './utils/brandUtils';
import { getPresetById } from './config/colorPresets';
import { useAutoSave } from './hooks/useAutoSave';

// Auth Pages
import { SignUp } from './pages/SignUp';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AuthCallback } from './pages/AuthCallback';

// Carousel Pages
import CarouselLibrary from './pages/CarouselLibrary';
import { PublicCarouselViewer } from './pages/PublicCarouselViewer';

// Components
import { CollapsibleSection } from './components/CollapsibleSection';
import { FloatingTopBar } from './components/FloatingTopBar';
import { FloatingSidebar } from './components/FloatingSidebar';
import { FloatingBottomBar } from './components/FloatingBottomBar';
import { SlideEditPanel } from './components/SlideEditPanel';

import {
  Layout,
  Sparkles,
  AlertCircle,
  Download,
  Save,
  Library as LibraryIcon,
  Plus,
  CheckCircle,
  Settings,
  Palette,
  Wand2,
} from 'lucide-react';

const SUGGESTED_TOPICS = [
  "Mental Models for Junior Devs",
  "How to Scale a SaaS to $10k MRR",
  "Why TypeScript is Winning",
  "The Art of Salary Negotiation"
];

// Main carousel generator (protected)
const CarouselGenerator: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    topic,
    setTopic,
    selectedTemplate,
    setTemplate,
    selectedModel,
    setModel,
    selectedFormat,
    setFormat,
    isGenerating,
    error,
    slides,
    setSlides,
    activePresetId,
    setActivePreset,
    setTheme,
    updateSlide,
    selectedSlideIndex,
    setSelectedSlideIndex,
    bottomToolExpanded,
    setBottomToolExpanded,
    rightPanelOpen,
    setRightPanelOpen,
    selectedPattern,
    setPattern,
    patternOpacity,
    setPatternOpacity,
    branding,
    setBranding
  } = useCarouselStore();

  const [localTopic, setLocalTopic] = useState('');
  const [currentCarouselId, setCurrentCarouselId] = useState<string | null>(null);
  const [editingCarousel, setEditingCarousel] = useState<Carousel | null>(null);

  // Load carousel if navigating from library with edit mode
  useEffect(() => {
    const state = location.state as any;
    if (state?.editMode && state?.carousel) {
      const carousel = state.carousel;
      setEditingCarousel(carousel);
      setCurrentCarouselId(carousel.$id);
      setLocalTopic(carousel.title || '');
      setTopic(carousel.title || '');
      setTemplate(dbToAppTemplate(carousel.templateType));
      setSlides(carousel.slides as any);

      // Restore the color preset if it was saved
      if (carousel.presetId) {
        setActivePreset(carousel.presetId);
      }

      // Restore the format if it was saved
      if (carousel.format) {
        setFormat(carousel.format);
      }

      // Restore pattern and opacity if saved
      if (carousel.selectedPattern !== undefined) {
        setPattern(carousel.selectedPattern);
      }
      if (carousel.patternOpacity !== undefined) {
        setPatternOpacity(carousel.patternOpacity);
      }

      // Restore branding if saved
      if (carousel.branding) {
        setBranding(carousel.branding);
      }

      // Clear the state so refresh doesn't reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Reactive Theme Update: Recalculate theme when template or preset changes
  useEffect(() => {
    // Only update if we have slides (carousel already generated)
    if (slides.length > 0 && !isGenerating) {
      const preset = getPresetById(activePresetId || 'ocean-tech');

      if (preset) {
        const newTheme = resolveTheme(preset.seeds, selectedTemplate);
        setTheme(newTheme);
        console.log(`[App] Theme updated reactively: ${preset.name} + ${selectedTemplate}`);
      }
    }
  }, [selectedTemplate, activePresetId, slides.length, isGenerating]);

  const handleGenerate = () => {
    // Get sourceContent from store to support multi-modal inputs
    const { sourceContent, inputMode } = useCarouselStore.getState();

    // For topic mode, use localTopic. For other modes, sourceContent should already be set by FloatingSidebar
    if (inputMode === 'topic' && !localTopic) return;
    if (inputMode !== 'topic' && !sourceContent) return;

    // Set topic for display purposes (will show in UI/save modal)
    setTopic(localTopic || 'AI Generated Carousel');

    // Trigger the workflow (MainAgent will use context including sourceContent)
    runAgentWorkflow(localTopic);
  };

  const handleRandomTopic = () => {
    const random = SUGGESTED_TOPICS[Math.floor(Math.random() * SUGGESTED_TOPICS.length)];
    setLocalTopic(random);
  };

  // Helper to get theme for auto-save
  const getTheme = () => {
    if (editingCarousel?.theme) {
      return editingCarousel.theme;
    }
    // Default themes
    return selectedTemplate === 'template-1'
      ? { background: '#000000', textColor: '#ffffff', accentColor: '#3b82f6' }
      : { background: '#ffffff', textColor: '#000000', accentColor: '#8b5cf6' };
  };

  // Auto-save hook integration
  const { saveStatus, currentCarouselId: autoSavedId, errorMessage } = useAutoSave({
    carouselId: editingCarousel?.$id || currentCarouselId,
    slides,
    theme: getTheme(),
    topic: topic || localTopic,
    userId: user?.$id || '',
    templateType: selectedTemplate,
    presetId: activePresetId,
    format: selectedFormat,
    selectedPattern,
    patternOpacity,
    branding
  });

  // Watch auto-saved ID and update local state
  useEffect(() => {
    if (autoSavedId && autoSavedId !== currentCarouselId) {
      console.log('[App] Carousel auto-saved with ID:', autoSavedId);
      setCurrentCarouselId(autoSavedId);
    }
  }, [autoSavedId]);

  const handleDownload = () => {
    downloadAllSvgs(slides, selectedTemplate);
  };

  const handleNewCarousel = () => {
    // Clear edit mode and start fresh
    setEditingCarousel(null);
    setCurrentCarouselId(null);
    setLocalTopic('');
    setTopic('');
    setSlides([]);
  };

  return (
    <div className="h-screen bg-neutral-950 relative">
      {/* Floating Top Bar */}
      <FloatingTopBar
        slidesCount={slides.length}
        hasUser={!!user}
        saveStatus={saveStatus}
        onDownload={handleDownload}
      />

      {/* Floating Left Sidebar */}
      <FloatingSidebar
        editMode={!!editingCarousel}
        editingCarousel={editingCarousel}
        localTopic={localTopic}
        setLocalTopic={setLocalTopic}
        selectedModel={selectedModel}
        setModel={setModel}
        isGenerating={isGenerating}
        error={error}
        onGenerate={handleGenerate}
        onRandomTopic={handleRandomTopic}
        onNewCarousel={handleNewCarousel}
      />

      {/* Center: Preview Area */}
      <main className="pt-16 pb-24 pl-[20rem] pr-6 h-full bg-neutral-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950 to-neutral-950">
        <CarouselPreview />
      </main>

      {/* Floating Bottom Bar */}
      <FloatingBottomBar
        expandedTool={bottomToolExpanded}
        setExpandedTool={setBottomToolExpanded}
        selectedTemplate={selectedTemplate}
        setTemplate={setTemplate}
      />

      {/* Right Edit Panel */}
      <SlideEditPanel
        isOpen={rightPanelOpen && selectedSlideIndex !== null}
        slide={selectedSlideIndex !== null ? slides[selectedSlideIndex] : null}
        slideIndex={selectedSlideIndex}
        onClose={() => {
          setRightPanelOpen(false);
          setSelectedSlideIndex(null);
        }}
        onSave={(index, content) => {
          updateSlide(index, content);
        }}
      />
    </div>
  );
};

// Main App with Router
const App: React.FC = () => {
  const { initialize, initialized, loading: authLoading } = useAuthStore();

  // Initialize auth when app loads
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading state while auth is initializing
  if (!initialized || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/view/:id" element={<PublicCarouselViewer />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <CarouselGenerator />
            </ProtectedRoute>
          }
        />

        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <CarouselLibrary />
            </ProtectedRoute>
          }
        />

        {/* Auth Routes */}
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;