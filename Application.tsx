import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useCarouselStore } from './store/useCarouselStore';
import { useAuthStore } from './store/useAuthStore';
import { repairVisualAssets } from './core/agents/MainAgent';
import { exportAllSlidesToPdf } from './utils/pdfExportAll';
import { exportSlideToJpg } from './utils/jpgExporter';
import { UserMenu } from './components/UserMenu';
import { updateCarouselContent, Carousel } from './services/carouselService';
import { resolveAppTemplate } from './utils/templateConverter';
import { resolveTheme } from './utils/brandUtils';
import { getPresetById } from './config/colorPresets';
import { useAutoSave } from './hooks/useAutoSave';
import { rehydrateRestore } from './services/restoreService';
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
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { AuthModal } from './components/AuthModal';
import { AnimatePresence, motion } from 'framer-motion';
import { Library, MessageSquare, GalleryHorizontalEnd } from 'lucide-react';
import { LogoMark } from './components/landing/primitives';
import './components/landing/landing.css';
import './components/studio/studio.css';

type MobileTab = 'library' | 'chat' | 'preview';

const MOBILE_TABS: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: 'library', label: 'Library', icon: Library },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'preview', label: 'Preview', icon: GalleryHorizontalEnd },
];

/** Branded full-screen loader (auth bootstrap). */
const StudioLoader: React.FC<{ label?: string }> = ({ label = 'Warming up the studio' }) => (
  <div className="lp st grid place-items-center">
    <div className="st-ambient" />
    <div className="relative flex flex-col items-center gap-5">
      <motion.div animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
        <LogoMark size={46} />
      </motion.div>
      <span className="lp-shimmer text-[13px] tracking-wide">{label}</span>
    </div>
  </div>
);

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
    selectedSlideIndex,
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

  // Mobile: one panel at a time, switched by the bottom tab bar
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const [previewUnseen, setPreviewUnseen] = useState(false);
  const prevSlideCount = useRef(slides.length);
  useEffect(() => {
    if (prevSlideCount.current === 0 && slides.length > 0) setPreviewUnseen(true);
    prevSlideCount.current = slides.length;
  }, [slides.length]);

  // Share Modal state (moved here from the retired My Carousels dashboard)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [carouselToShare, setCarouselToShare] = useState<Carousel | null>(null);

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
    setTemplate(resolveAppTemplate(carousel.templateType, carousel.theme));
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
        // The user may have opened another carousel while the chat loaded.
        if (store.activeCarouselId !== carousel.$id) return;
        store.setChatMessages(messages);
        store.setChatSummary(summary);
        store.setChatSummarizedUpTo(summarizedUpTo);
        // A restore made earlier on this device (replies after it show faded).
        rehydrateRestore(carousel.$id, messages);
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
  const handleFirstPrompt = async (text: string, creativeBrief?: import('./types').CreativeBrief, userMessage?: string, options?: { briefInWorker?: boolean }) => {

    setTopic(text.length > 80 ? text.slice(0, 77) + '…' : text);

    const state = useCarouselStore.getState();

    const { jobId } = await createJob({
      type: 'create',
      payload: {
        topic: text,
        userMessage: userMessage ?? text,
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
        creativeBrief,
        briefInWorker: !creativeBrief && !!options?.briefInWorker,
      },

    });

    useCarouselStore.getState().setActiveJobId(jobId);
    useCarouselStore.getState().setGenerating(true);
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
    // The stage can browse independently of the selection (arrow keys), so
    // prefer the slide actually on stage; fall back to the selection.
    const stageAttr = document.querySelector('[data-stage-index]')?.getAttribute('data-stage-index');
    const slideIndex = stageAttr != null ? Number(stageAttr) : (selectedSlideIndex ?? 0);

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
    <div className="lp st relative">
      <div className="st-ambient" />

      {/* Floating Top Bar */}
      <FloatingTopBar
        slidesCount={slides.length}
        hasUser={!!user}
        saveStatus={saveStatus}
        onDownload={handleDownload}
        onDownloadPdf={handleDownloadAllPdf}
        isExportingPdf={isExportingPdf}
        onOpenAuthModal={() => {
          setAuthModalMessage('Sign in to save your carousels and pick up where you left off');
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
      />

      {/* Library + Chat + Stage as floating panels (chat is the control plane, the carousel is the hero) */}
      <main className="relative z-10 h-[100dvh] pt-16 px-2 pb-[76px] md:pb-2 flex gap-2">
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
        {mobileTab === 'library' && (
          <div className="md:hidden flex-1 min-w-0">
            <CarouselHistorySidebar
              fullWidth
              isOpen
              onToggle={() => {}}
              userId={user?.$id ?? null}
              saveStatus={saveStatus}
              onSelectCarousel={(c) => { handleLoadCarousel(c); setMobileTab('preview'); }}
              onNewCarousel={() => { handleNewCarousel(); setMobileTab('chat'); }}
              onShare={(carousel) => {
                setCarouselToShare(carousel);
                setShareModalOpen(true);
              }}
            />
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] lg:w-[420px] md:min-w-[380px] h-full min-h-0`}
        >
          <ChatPanel onFirstPrompt={handleFirstPrompt} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 h-full min-h-0`}
        >
          <ArtifactPanel
            onOpenBrandEditor={handleOpenBrandEditor}
            onShowToast={showToast}
          />
        </motion.div>
      </main>

      {/* Mobile tab bar */}
      <nav className="md:hidden fixed bottom-2 inset-x-2 z-50 st-panel rounded-2xl p-1.5 grid grid-cols-3 gap-1" aria-label="Studio sections">
        {MOBILE_TABS.map(t => {
          const on = mobileTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setMobileTab(t.id); if (t.id === 'preview') setPreviewUnseen(false); }}
              className={`relative flex flex-col items-center justify-center gap-1 h-12 rounded-xl text-[11px] font-medium transition-colors ${on ? 'text-white' : 'text-white/45'}`}
              aria-current={on ? 'page' : undefined}
            >
              {on && <motion.span layoutId="mobile-tab" className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/10" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
              <t.icon size={17} className="relative" />
              <span className="relative">{t.label}</span>
              <AnimatePresence>
                {t.id === 'preview' && previewUnseen && !on && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute top-2 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-violet-400 ring-2 ring-[#0c0c14]" />
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

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
    return <StudioLoader />;
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