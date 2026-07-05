import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useCarouselStore } from './store/useCarouselStore';
import { useAuthStore } from './store/useAuthStore';
import { repairVisualAssets } from './core/agents/MainAgent';
import { exportAllSlidesToPdf } from './utils/pdfExportAll';
import { exportSlideToJpg } from './utils/jpgExporter';
import { UserMenu } from './components/UserMenu';
import { updateCarouselContent, Carousel } from './services/carouselService';
import { dbToAppTemplate } from './utils/templateConverter';
import { resolveTheme } from './utils/brandUtils';
import { getPresetById } from './config/colorPresets';
import { useAutoSave } from './hooks/useAutoSave';
import { useJobWatcher } from './hooks/useJobWatcher';
import { createJob, getActiveJobForCarousel } from './services/jobService';
import BrandEditorPanel from './components/BrandEditorPanel';

// Auth Pages
import { SignUp } from './pages/SignUp';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AuthCallback } from './pages/AuthCallback';

// Carousel Pages
import { PublicCarouselViewer } from './pages/PublicCarouselViewer';
import LandingPage from './pages/LandingPage';


// Components
import { FloatingTopBar } from './components/FloatingTopBar';
import { ChatPanel } from './components/chat/ChatPanel';
import { ArtifactPanel } from './components/artifact/ArtifactPanel';
import { CarouselHistorySidebar } from './components/sidebar/CarouselHistorySidebar';
import { ShareModal } from './components/ShareModal';
import { loadChat } from './services/chatService';
import { SlideEditPanel } from './components/SlideEditPanel';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { AuthModal } from './components/AuthModal';
import { FreeLimitError } from './services/aiService';

// Main carousel generator (protected)
const CarouselGenerator: React.FC = () => {
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
    rightPanelOpen,
    setRightPanelOpen,
    selectedPattern,
    setPattern,
    patternOpacity,
    setPatternOpacity,
    activeCarouselId,
    setActiveCarouselId,
  } = useCarouselStore();

  // Toast notifications
  const { toasts, showToast, removeToast } = useToast();

  const [editingCarousel, setEditingCarousel] = useState<Carousel | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Brand Editor Panel state
  const [brandEditorOpen, setBrandEditorOpen] = useState(false);

  // Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState('Create an account to save your work');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');

  // Determine "Studio Mode" (Has slides)
  const hasSlides = slides.length > 0;

  // Carousel history rail — hidden by default, remembers the user's last choice
  const [historyOpen, setHistoryOpen] = useState(() => localStorage.getItem('carouselHistoryOpen') === 'true');
  useEffect(() => {
    localStorage.setItem('carouselHistoryOpen', String(historyOpen));
  }, [historyOpen]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setHistoryOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Share Modal state (moved here from the retired My Carousels dashboard)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [carouselToShare, setCarouselToShare] = useState<Carousel | null>(null);

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

  // Load a carousel into the editor in place (from the history sidebar) — no
  // navigation, no route change, just swaps the working state like switching
  // a chat thread.
  const handleLoadCarousel = (carousel: Carousel) => {
    // Clear the previous carousel's chat synchronously — otherwise there's a
    // window where these new slides are on screen next to the OLD carousel's
    // conversation, until the async loadChat() below resolves.
    useCarouselStore.getState().clearChat();
    useCarouselStore.getState().setError(null);

    setEditingCarousel(carousel);
    setActiveCarouselId(carousel.$id);
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

    // Rehydrate the conversation that belongs to this carousel
    if (user?.$id) {
      loadChat(carousel.$id, user.$id).then(({ messages, summary, summarizedUpTo }) => {
        const store = useCarouselStore.getState();
        store.setChatMessages(messages);
        store.setChatSummary(summary);
        store.setChatSummarizedUpTo(summarizedUpTo);
        console.log(`[App] Restored ${messages.length} chat messages for carousel ${carousel.$id}`);
      });
    }

    // Check if there is an active background job running for this carousel, and subscribe to it
    getActiveJobForCarousel(carousel.$id).then((job) => {
      const store = useCarouselStore.getState();
      if (job) {
        console.log(`[App] Found active running job for loaded carousel: ${job.$id}`);
        store.setActiveJobId(job.$id);
        store.setGenerating(true);
        store.setGenerationStatus(job.statusMessage);
        store.setGenerationProgress(job.progress);
      } else {
        store.setActiveJobId(null);
        store.setGenerating(false);
      }
    });
  };

  // T3: Auto-switch to light variant if dark preset is active
  useEffect(() => {
    if (selectedTemplate === 'template-3' && brandMode === 'preset') {
      if (!presetId.endsWith('-light')) {
        const lightVariant = `${presetId}-light`;
        // Verify if it exists in PRESETS
        const exists = getPresetById(lightVariant);
        if (exists) {
          console.log(`[App] T3 Autocorrect: Switching ${presetId} -> ${lightVariant}`);
          setPresetId(lightVariant);
        } else {
          // Fallback to default light theme if no direct variant
          console.log(`[App] T3 Autocorrect: Fallback to ocean-tech-light`);
          setPresetId('ocean-tech-light');
        }
      }
    }
  }, [selectedTemplate, brandMode, presetId, setPresetId]);

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

  // Reactive Visual Asset Repair: Fix missing icons/doodles on template switch
  useEffect(() => {
    if (hasSlides && !isGenerating) {
      repairVisualAssets();
    }
  }, [selectedTemplate, hasSlides, isGenerating]);

  // Chat-driven creation: the first chat message dispatches a background job
  // (hooks/useJobWatcher.ts, mounted below, applies the result once it's done)
  // instead of running the agent pipeline in this tab.
  const handleFirstPrompt = async (text: string) => {
    if (!checkGuestLimit()) return;
    setTopic(text.length > 80 ? text.slice(0, 77) + '…' : text);

    const state = useCarouselStore.getState();

    const { jobId } = await createJob({
      type: 'create',
      payload: {
        topic: text,
        inputMode: state.inputMode,
        sourceContent: state.sourceContent,
        customInstructions: state.customInstructions,
        outputLanguage: state.outputLanguage,
        slideCount: state.slideCount,
        selectedModel: state.selectedModel,
        selectedTemplate: state.selectedTemplate,
        presetId: state.presetId,
        brandMode: state.brandMode,
        brandKit: state.brandKit,
        signaturePosition: state.signaturePosition,
        format: state.selectedFormat,
        selectedPattern: state.selectedPattern,
        patternOpacity: state.patternOpacity,
      },
    });

    useCarouselStore.getState().setActiveJobId(jobId);
    useCarouselStore.getState().setGenerating(true);
    incrementGuestUsage();
  };

  // Applies background job updates (create + edit) to the live UI — keeps
  // watching whatever job was last dispatched even as the user switches
  // carousels or navigates elsewhere in the app.
  useJobWatcher();

  // Helper to get theme for auto-save
  const getTheme = () => {
    if (editingCarousel?.theme) {
      return editingCarousel.theme;
    }
    // Return a minimal theme object for auto-save
    return { background: '#000000', textColor: '#ffffff', accentColor: '#3b82f6' };
  };

  // Auto-save hook integration — reads/writes activeCarouselId in the store
  // directly, so there's a single source of truth for carousel identity.
  const { saveStatus, errorMessage } = useAutoSave({
    slides,
    theme: getTheme(),
    topic,
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

  // Conversation persistence is owned by the worker now — it saves chat_history
  // as part of every create/edit job (see worker/chatStoreServer.ts), so there's
  // a single writer instead of racing with a separate client-side autosave.

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
    let currentToastId: string | null = null;

    // Require auth for downloading PDF
    if (!requireAuth('Sign up to download PDF')) return;

    try {
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
    }
  };

  const handleNewCarousel = () => {
    // Clear edit mode and start fresh
    setEditingCarousel(null);
    setActiveCarouselId(null);
    setTopic('');
    setSlides([]);
    useCarouselStore.getState().clearChat();
    // Detach from whatever job the carousel we're leaving was watching —
    // it keeps generating in the background regardless (see handleLoadCarousel).
    useCarouselStore.getState().setActiveJobId(null);
    useCarouselStore.getState().setGenerating(false);
    useCarouselStore.getState().setError(null);
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
        onOpenAuthModal={() => {
          setAuthModalMessage('Sign in to access all features');
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {/* History + Chat + Artifact split (chat is the control plane, the carousel is the hero) */}
      <main className="pt-12 h-screen flex bg-neutral-950">
        <CarouselHistorySidebar
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(o => !o)}
          userId={user?.$id ?? null}
          saveStatus={saveStatus}
          onSelectCarousel={handleLoadCarousel}
          onNewCarousel={handleNewCarousel}
          onShare={(carousel) => {
            setCarouselToShare(carousel);
            setShareModalOpen(true);
          }}
        />
        <div className="w-full md:w-[400px] md:min-w-[400px] h-full">
          <ChatPanel
            onFirstPrompt={handleFirstPrompt}
          />
        </div>
        <div className="hidden md:flex flex-1 min-w-0">
          <ArtifactPanel
            onOpenBrandEditor={handleOpenBrandEditor}
            onShowToast={showToast}
          />
        </div>
      </main>

      {/* Share Modal */}
      {carouselToShare && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setCarouselToShare(null);
          }}
          carousel={carouselToShare}
        />
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