import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useCarouselStore } from './store/useCarouselStore';
import { useAuthStore } from './store/useAuthStore';
import { runAgentWorkflow, repairVisualAssets } from './core/agents/MainAgent';
import { exportAllSlidesToPdf } from './utils/pdfExportAll';
import { exportSlideToJpg } from './utils/jpgExporter';
import { UserMenu } from './components/UserMenu';
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
import { PublicCarouselViewer } from './pages/PublicCarouselViewer';
import LandingPage from './pages/LandingPage';
import GenerateDoodles from './pages/GenerateDoodles';
import ImageRefinement from './pages/ImageRefinement';


// Components
import { CollapsibleSection } from './components/CollapsibleSection';
import { FloatingTopBar } from './components/FloatingTopBar';
import { ChatPanel } from './components/chat/ChatPanel';
import { ArtifactPanel } from './components/artifact/ArtifactPanel';
import { CarouselHistorySidebar } from './components/sidebar/CarouselHistorySidebar';
import { ShareModal } from './components/ShareModal';
import { loadChat, saveChat } from './services/chatService';
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

  // Chat-driven creation: the first chat message is the generation prompt
  const handleFirstPrompt = async (text: string) => {
    if (!checkGuestLimit()) return;
    setLocalTopic(text);
    setTopic(text.length > 80 ? text.slice(0, 77) + '…' : text);
    await runAgentWorkflow(text);
    incrementGuestUsage();
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

  // Persist the conversation alongside the carousel (debounced, fire-and-forget)
  const chatMessages = useCarouselStore(s => s.chatMessages);
  const chatSummary = useCarouselStore(s => s.chatSummary);
  const chatSummarizedUpTo = useCarouselStore(s => s.chatSummarizedUpTo);
  useEffect(() => {
    const carouselId = editingCarousel?.$id || currentCarouselId;
    if (!carouselId || !user?.$id || chatMessages.length === 0) return;
    if (chatMessages.some(m => m.running)) return; // wait for turns to finish

    const t = setTimeout(() => {
      saveChat(carouselId, user.$id, chatMessages, chatSummary, chatSummarizedUpTo);
    }, 1200);
    return () => clearTimeout(t);
  }, [chatMessages, chatSummary, chatSummarizedUpTo, editingCarousel?.$id, currentCarouselId, user?.$id]);

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
    // Clear edit mode and start fresh
    setEditingCarousel(null);
    setCurrentCarouselId(null);
    setLocalTopic('');
    setTopic('');
    setSlides([]);
    useCarouselStore.getState().clearChat();
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
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {/* History + Chat + Artifact split (chat is the control plane, the carousel is the hero) */}
      <main className="pt-16 h-screen flex bg-neutral-950">
        <CarouselHistorySidebar
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(o => !o)}
          userId={user?.$id ?? null}
          currentCarouselId={editingCarousel?.$id || currentCarouselId}
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
            onOpenApiKeyModal={() => setApiKeyModalOpen(true)}
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

        {/* Auth Routes */}
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/generate" element={<GenerateDoodles />} />
        <Route path="/image-refinement" element={<ImageRefinement />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;