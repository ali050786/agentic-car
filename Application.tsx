import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useCarouselStore } from './store/useCarouselStore';
import { useAuthStore } from './store/useAuthStore';
import { runAgentWorkflow } from './core/agents/MainAgent';
import { CarouselPreview } from './components/CarouselPreview';
import { downloadAllSvgs } from './utils/downloadUtils';
import { exportAllSlidesToPdf } from './utils/pdfExportAll';
import { exportSlideToJpg } from './utils/jpgExporter';
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
import BrandEditorPanel from './components/BrandEditorPanel';

// Auth Pages
import { SignUp } from './pages/SignUp';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AuthCallback } from './pages/AuthCallback';

// Carousel Pages
import CarouselLibrary from './pages/CarouselLibrary';
import { PublicCarouselViewer } from './pages/PublicCarouselViewer';
import LandingPage from './pages/LandingPage';


// Components
import { CollapsibleSection } from './components/CollapsibleSection';
import { FloatingTopBar } from './components/FloatingTopBar';
import { FloatingSidebar } from './components/FloatingSidebar';
import { FloatingBottomBar } from './components/FloatingBottomBar';
import { SlideEditPanel } from './components/SlideEditPanel';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AuthModal } from './components/AuthModal';
import { FreeLimitError } from './services/aiService';

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
  Menu,
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
  const { user, globalBrandKit } = useAuthStore();
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
    brandMode,
    presetId,
    brandKit,
    setBrandMode,
    setPresetId,
    setBrandKit,
    signaturePosition,
    setSignaturePosition,
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
    viewMode,
    setViewMode,
    toggleMobileMenu
  } = useCarouselStore();

  // Toast notifications
  const { toasts, showToast, removeToast } = useToast();

  const [localTopic, setLocalTopic] = useState('');
  const [currentCarouselId, setCurrentCarouselId] = useState<string | null>(null);
  const [editingCarousel, setEditingCarousel] = useState<Carousel | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Brand Editor Panel state
  const [brandEditorOpen, setBrandEditorOpen] = useState(false);

  // API Key Modal state
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState('Create an account to save your work');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');

  // 1. Add Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 2. Determine "Studio Mode" (Has slides)
  const hasSlides = slides.length > 0;

  // 3. Auto-collapse sidebar when generation finishes (slides appear)
  useEffect(() => {
    if (hasSlides && !isGenerating) {
      setIsSidebarOpen(false);
    }
  }, [hasSlides, isGenerating]);

  // Check guest usage
  const checkGuestLimit = (): boolean => {
    if (user) return true; // Logged in users always pass

    const guestUsage = parseInt(localStorage.getItem('guest_usage_count') || '0');
    if (guestUsage >= 1) {
      setAuthModalMessage('Create an account to generate more carousels');
      setAuthMode('signup');
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const incrementGuestUsage = () => {
    if (!user) {
      const guestUsage = parseInt(localStorage.getItem('guest_usage_count') || '0');
      localStorage.setItem('guest_usage_count', (guestUsage + 1).toString());
    }
  };

  const requireAuth = (message: string = 'Sign up to continue'): boolean => {
    if (user) return true;
    setAuthModalMessage(message);
    setAuthMode('signup');
    setAuthModalOpen(true);
    return false;
  };

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

      // Restore brand mode and preset if saved
      if (carousel.brandMode) {
        setBrandMode(carousel.brandMode);
      }
      if (carousel.presetId) {
        setPresetId(carousel.presetId);
      }
      if (carousel.brandKit) {
        setBrandKit(carousel.brandKit);
      }
      if (carousel.signaturePosition) {
        setSignaturePosition(carousel.signaturePosition);
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

      // Clear the state so refresh doesn't reload
      window.history.replaceState({}, document.title);
    } else if (state?.createNew) {
      // Handle "New Carousel" action from library
      setEditingCarousel(null);
      setCurrentCarouselId(null);
      setLocalTopic('');
      setTopic('');
      setSlides([]);
      setIsSidebarOpen(true);

      // Reset history so refresh doesn't trigger this again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Reactive Theme Update: 2-Mode System (preset/custom)
  useEffect(() => {
    // Only update if we have slides (carousel already generated)
    if (slides.length > 0 && !isGenerating) {
      let newTheme;

      switch (brandMode) {
        case 'preset':
          // Use preset colors
          const preset = getPresetById(presetId || 'ocean-tech');
          if (preset) {
            newTheme = resolveTheme(preset.seeds, selectedTemplate);
            console.log(`[App] Theme updated: ${preset.name} + ${selectedTemplate}`);
          }
          break;

        case 'custom':
          // Use custom carousel brand kit colors (identities are merged)
          newTheme = resolveTheme(brandKit.colors, selectedTemplate);
          console.log('[App] Theme updated: Custom Brand + ' + selectedTemplate);
          break;
      }

      if (newTheme) {
        setTheme(newTheme);
      }
    }
  }, [selectedTemplate, brandMode, presetId, brandKit, globalBrandKit, slides.length, isGenerating]);

  const handleGenerate = async () => {
    // Get sourceContent from store to support multi-modal inputs
    const { sourceContent, inputMode } = useCarouselStore.getState();

    // For topic mode, use localTopic. For other modes, sourceContent should already be set by FloatingSidebar
    if (inputMode === 'topic' && !localTopic) return;
    if (inputMode !== 'topic' && !sourceContent) return;

    // Check guest limit
    if (!checkGuestLimit()) return;

    // Set topic for display purposes (will show in UI/save modal)
    setTopic(localTopic || 'AI Generated Carousel');

    // Trigger the workflow with error handling for free tier limit
    try {
      await runAgentWorkflow(localTopic);
      // Increment guest usage after successful generation trigger
      incrementGuestUsage();
    } catch (error) {
      // Check if it's a free tier limit error
      if (error instanceof FreeLimitError) {
        console.warn('[App] Free tier limit reached, opening API key modal');
        setApiKeyModalOpen(true);
      } else {
        // Re-throw other errors to be handled by the agent
        throw error;
      }
    }
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
    // Return a minimal theme object for auto-save
    return { background: '#000000', textColor: '#ffffff', accentColor: '#3b82f6' };
  };

  // Auto-save hook integration
  const { saveStatus, currentCarouselId: autoSavedId, errorMessage } = useAutoSave({
    carouselId: editingCarousel?.$id || currentCarouselId,
    slides,
    theme: getTheme(),
    topic: topic || localTopic,
    userId: user?.$id || '',
    templateType: selectedTemplate,
    brandMode,
    presetId,
    brandKit,
    signaturePosition,
    format: selectedFormat,
    selectedPattern,
    patternOpacity,
  });

  // Watch auto-saved ID and update local state
  useEffect(() => {
    if (autoSavedId && autoSavedId !== currentCarouselId) {
      console.log('[App] Carousel auto-saved with ID:', autoSavedId);
      setCurrentCarouselId(autoSavedId);
    }
  }, [autoSavedId]);

  const handleDownload = async () => {
    // Export current/selected slide as JPG
    const slideIndex = selectedSlideIndex ?? 0; // Default to first slide if none selected

    // Query the specific slide preview container
    const slideContainers = document.querySelectorAll('.svg-preview-container');

    if (slideContainers.length === 0) {
      alert('No slide elements found. Please ensure slides are generated.');
      return;
    }

    const slideElement = slideContainers[slideIndex] as HTMLElement;



    if (!slideElement) {
      alert('Selected slide element not found.');
      return;
    }

    // Require auth for downloading
    if (!requireAuth('Sign up to download your masterpiece')) return;

    try {
      await exportSlideToJpg(slideElement, slideIndex, selectedFormat);
    } catch (err) {
      console.error('Failed to export JPG:', err);
      alert('Failed to export JPG. Please try again.');
    }
  };

  const handleDownloadAllPdf = async () => {
    // Track if we need to switch back to focus view
    const wasInFocusMode = viewMode === 'focus';
    let currentToastId: string | null = null;

    // Require auth for downloading PDF
    if (!requireAuth('Sign up to download PDF')) return;

    try {
      // If in focus mode, switch to grid view first
      if (wasInFocusMode) {
        currentToastId = showToast('Switching to grid view for export...', 'info', 0); // Persistent toast
        setViewMode('grid');
        // Wait for DOM to update and render all slides
        await new Promise(resolve => setTimeout(resolve, 800));

        // Remove view switch toast
        if (currentToastId) removeToast(currentToastId);
      }

      // Directly query all slide preview containers
      const slideContainers = document.querySelectorAll('.svg-preview-container');

      if (slideContainers.length === 0) {
        showToast('No slide elements found. Please ensure slides are generated.', 'error', 5000);
        return;
      }

      if (slideContainers.length !== slides.length) {
        showToast(`Expected ${slides.length} slides but found ${slideContainers.length} in DOM.`, 'error', 5000);
        return;
      }

      const slideElements = Array.from(slideContainers) as HTMLElement[];

      console.log('Found', slideElements.length, 'slide elements for PDF export');

      // Show persistent exporting toast
      currentToastId = showToast(`Exporting ${slides.length} slides to PDF...`, 'info', 0);
      setIsExportingPdf(true);

      await exportAllSlidesToPdf(
        slideElements,
        selectedFormat,
        (current, total) => {
          console.log(`Exporting slide ${current}/${total}`);
          // Update the toast message with progress
          if (currentToastId) removeToast(currentToastId);
          currentToastId = showToast(`Exporting slide ${current}/${total}...`, 'info', 0);
        }
      );

      // Remove exporting toast
      if (currentToastId) removeToast(currentToastId);

      // Success!
      showToast('PDF downloaded successfully!', 'success', 4000);

    } catch (err) {
      console.error('Failed to export PDF:', err);
      if (currentToastId) removeToast(currentToastId);
      showToast('Failed to export PDF. Please try again.', 'error', 5000);
    } finally {
      setIsExportingPdf(false);

      // Switch back to focus mode if we auto-switched
      if (wasInFocusMode) {
        const switchBackToastId = showToast('Switching back to focus view...', 'info', 0);
        await new Promise(resolve => setTimeout(resolve, 300));
        setViewMode('focus');
        removeToast(switchBackToastId);
      }
    }
  };

  const handleNewCarousel = () => {
    // Expand sidebar so user can enter new topic
    setIsSidebarOpen(true);

    // Clear edit mode and start fresh
    setEditingCarousel(null);
    setCurrentCarouselId(null);
    setLocalTopic('');
    setTopic('');
    setSlides([]);
  };

  // Brand Editor Panel handlers
  const handleOpenBrandEditor = () => {
    setBrandEditorOpen(true);
  };

  const handleBrandSave = (brandKitData: any) => {
    // Update carousel brand kit (sync with global is handled in BrandEditorPanel)
    setBrandKit(brandKitData);
    showToast('Brand identity updated', 'success', 3000);
  };

  const getCurrentBrandKit = () => {
    return brandKit;
  };

  return (
    <div className="h-screen bg-neutral-950 relative">
      {/* Floating Top Bar */}
      <FloatingTopBar
        slidesCount={slides.length}
        hasUser={!!user}
        saveStatus={saveStatus}
        onDownload={handleDownload}
        onDownloadPdf={handleDownloadAllPdf}
        isExportingPdf={isExportingPdf}
        onOpenApiKeyModal={() => setApiKeyModalOpen(true)}
        onOpenAuthModal={() => {
          setAuthModalMessage('Sign in to access all features');
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
      />

      {/* Floating Left Sidebar */}
      <FloatingSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        hasSlides={slides.length > 0} // <--- NEW PROP
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

      {/* Mobile Menu Button - visible only on mobile */}
      <button
        onClick={toggleMobileMenu}
        className="fixed top-20 left-4 z-30 p-2 bg-neutral-900/90 border border-white/20 rounded-lg md:hidden text-white shadow-lg backdrop-blur-md"
      >
        <Menu size={20} />
      </button>

      {/* Center: Preview Area */}
      <main
        className={`
          pt-16 pb-24 px-4 h-full bg-neutral-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950 to-neutral-950 
          transition-all duration-500 ease-in-out
          ${isSidebarOpen ? 'md:pl-[21.5rem]' : 'md:pl-24'} 
        `}
      >
        <CarouselPreview />
      </main>

      {/* Floating Bottom Bar */}
      {slides.length > 0 && (
        <div className="animate-in slide-in-from-bottom-10 duration-700 fade-in">
          <FloatingBottomBar
            expandedTool={bottomToolExpanded}
            setExpandedTool={setBottomToolExpanded}
            selectedTemplate={selectedTemplate}
            setTemplate={setTemplate}
            onOpenBrandEditor={handleOpenBrandEditor}
          />
        </div>
      )}

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

      {/* Brand Editor Panel */}
      <BrandEditorPanel
        isOpen={brandEditorOpen}
        initialBrandKit={getCurrentBrandKit()}
        onSave={handleBrandSave}
        onClose={() => setBrandEditorOpen(false)}
      />

      {/* Toast Notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        message={authModalMessage}
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
        <Route path="/" element={<LandingPage />} />
        <Route path="/view/:id" element={<PublicCarouselViewer />} />

        {/* Protected Routes */}
        <Route
          path="/app"
          element={
            <CarouselGenerator />
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