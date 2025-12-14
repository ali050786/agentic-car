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
import { SaveCarouselModal } from './components/SaveCarouselModal';
import { updateCarouselContent, Carousel } from './services/carouselService';
import { dbToAppTemplate } from './utils/templateConverter';
import { ThemeSelector } from './components/ThemeSelector';
import { BrandingSelector } from './components/BrandingSelector';
import { FormatSelector } from './components/FormatSelector';
import { PatternSelector } from './components/PatternSelector';
import { resolveTheme } from './utils/brandUtils';
import { getPresetById } from './config/colorPresets';

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
  const { topic, setTopic, selectedTemplate, setTemplate, selectedModel, setModel, selectedFormat, setFormat, isGenerating, error, slides, setSlides, activePresetId, setActivePreset, setTheme } = useCarouselStore();

  const [localTopic, setLocalTopic] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editingCarousel, setEditingCarousel] = useState<Carousel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load carousel if navigating from library with edit mode
  useEffect(() => {
    const state = location.state as any;
    if (state?.editMode && state?.carousel) {
      const carousel = state.carousel;
      setEditMode(true);
      setEditingCarousel(carousel);
      setLocalTopic(carousel.title || '');
      setTopic(carousel.title || '');
      setTemplate(dbToAppTemplate(carousel.template_type));
      setSlides(carousel.slides as any);

      // Restore the color preset if it was saved
      if (carousel.preset_id) {
        setActivePreset(carousel.preset_id);
      }

      // Restore the format if it was saved
      if (carousel.format) {
        setFormat(carousel.format);
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
    if (!localTopic) return;
    setTopic(localTopic);
    runAgentWorkflow(localTopic);
  };

  const handleRandomTopic = () => {
    const random = SUGGESTED_TOPICS[Math.floor(Math.random() * SUGGESTED_TOPICS.length)];
    setLocalTopic(random);
  };

  const handleDownload = () => {
    downloadAllSvgs(slides, selectedTemplate);
  };

  const handleSaveClick = () => {
    if (slides.length > 0 && user) {
      setShowSaveModal(true);
    }
  };

  const handleSaveChanges = async () => {
    if (!editingCarousel || !user) return;

    setIsSaving(true);

    const theme = editingCarousel.theme;
    const { data, error } = await updateCarouselContent(editingCarousel.$id, theme, slides);

    setIsSaving(false);

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleNewCarousel = () => {
    // Clear edit mode and start fresh
    setEditMode(false);
    setEditingCarousel(null);
    setLocalTopic('');
    setTopic('');
    setSlides([]);
    setSaveSuccess(false);
  };

  const getTheme = () => {
    if (editingCarousel?.theme) {
      return editingCarousel.theme;
    }
    // Default themes
    return selectedTemplate === 'template-1'
      ? { background: '#000000', textColor: '#ffffff', accentColor: '#3b82f6' }
      : { background: '#ffffff', textColor: '#000000', accentColor: '#8b5cf6' };
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
            <Layout className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Agentic Carousel</h1>
            <p className="text-[10px] text-neutral-500 -mt-0.5 uppercase tracking-wider font-medium">
              {editMode ? 'Edit Mode' : 'Generator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Edit Mode Success Indicator */}
          {editMode && saveSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
              <CheckCircle size={16} />
              Saved!
            </div>
          )}

          {/* Library Button */}
          <Link
            to="/library"
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <LibraryIcon size={16} />
            <span className="hidden sm:inline">My Carousels</span>
          </Link>

          {/* Save Button (only in generate mode when slides exist) */}
          {!editMode && slides.length > 0 && user && (
            <button
              onClick={handleSaveClick}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-sm font-medium text-white transition-all"
            >
              <Save size={16} />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}

          {/* Save Changes Button (only in edit mode) */}
          {editMode && (
            <button
              onClick={handleSaveChanges}
              disabled={isSaving || slides.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isSaving || slides.length === 0
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          )}

          {/* Download Button */}
          {slides.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          <UserMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Controls */}
        <aside className="w-80 border-r border-white/10 flex flex-col gap-5 p-6 bg-neutral-900 overflow-y-auto">
          {/* Edit Mode Alert */}
          {editMode && editingCarousel && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-400 text-sm">Editing</h3>
                  <p className="text-xs text-blue-200/80 mt-1">
                    {editingCarousel.title}
                  </p>
                </div>
              </div>
              <button
                onClick={handleNewCarousel}
                className="w-full mt-2 py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-xs font-medium text-blue-300 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                New Carousel
              </button>
            </div>
          )}

          {/* CONTENT SECTION - Always visible */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 py-2">
              <Layout size={14} className="text-neutral-400" />
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                Content
              </span>
            </div>

            {/* Topic Input (only in generate mode) */}
            {!editMode && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-500">
                    Your Topic
                  </label>
                  <button
                    onClick={handleRandomTopic}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    Random
                  </button>
                </div>
                <textarea
                  className="w-full h-24 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                  placeholder="What should this carousel be about?"
                  value={localTopic}
                  onChange={(e) => setLocalTopic(e.target.value)}
                />
              </div>
            )}

            {/* Topic Display (in edit mode) */}
            {editMode && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-neutral-500">
                  Topic
                </label>
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm">
                  {localTopic || 'No topic'}
                </div>
              </div>
            )}

            {/* Template Selection */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-neutral-500">
                Template
              </label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setTemplate('template-1')}
                  className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${selectedTemplate === 'template-1'
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-white mb-1 flex justify-between">
                      The Truth
                      {selectedTemplate === 'template-1' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-neutral-400 group-hover:text-neutral-300">Bold, industrial, high contrast.</div>
                  </div>
                </button>

                <button
                  onClick={() => setTemplate('template-2')}
                  className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${selectedTemplate === 'template-2'
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-white mb-1 flex justify-between">
                      The Clarity
                      {selectedTemplate === 'template-2' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-neutral-400 group-hover:text-neutral-300">Clean, tech-forward, gradients.</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* GENERATION SETTINGS - Collapsible, expanded by default */}
          <CollapsibleSection title="Generation Settings" icon={Settings} defaultExpanded={true}>
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-neutral-500">
                AI Model
              </label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setModel('groq-llama')}
                  className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${selectedModel === 'groq-llama'
                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-white mb-1 flex justify-between items-center">
                      <span>Groq Llama 3.3</span>
                      {selectedModel === 'groq-llama' && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-neutral-400 group-hover:text-neutral-300 flex items-center gap-1">
                      <span>⚡ Fast generation, generous limits</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setModel('claude-haiku')}
                  className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${selectedModel === 'claude-haiku'
                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-white mb-1 flex justify-between items-center">
                      <span>Claude Haiku 3.5</span>
                      {selectedModel === 'claude-haiku' && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-neutral-400 group-hover:text-neutral-300 flex items-center gap-1">
                      <span>🧠 Smart reasoning, better limits</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setModel('gemini-flash')}
                  className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${selectedModel === 'gemini-flash'
                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-white mb-1 flex justify-between items-center">
                      <span>Gemini 2.5 Flash</span>
                      {selectedModel === 'gemini-flash' && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-neutral-400 group-hover:text-neutral-300 flex items-center gap-1">
                      <span>🚀 Google direct API, latest</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setModel('openrouter-gemini')}
                  className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${selectedModel === 'openrouter-gemini'
                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                    }`}
                >
                  <div className="relative z-10">
                    <div className="font-bold text-white mb-1 flex justify-between items-center">
                      <span>Gemini 2.0 Flash (OpenRouter)</span>
                      {selectedModel === 'openrouter-gemini' && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                    </div>
                    <div className="text-xs text-neutral-400 group-hover:text-neutral-300 flex items-center gap-1">
                      <span>⚡ Via OpenRouter, experimental</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </CollapsibleSection>

          {/* STYLING - Collapsible, collapsed by default */}
          <CollapsibleSection title="Styling" icon={Palette} defaultExpanded={false}>
            {/* Theme/Color Preset Selection */}
            <ThemeSelector />

            {/* Format Selection */}
            <div className="mt-4">
              <FormatSelector />
            </div>

            {/* Pattern Selection */}
            <div className="mt-4">
              <PatternSelector />
            </div>
          </CollapsibleSection>

          {/* ADVANCED - Collapsible, collapsed by default */}
          <CollapsibleSection title="Advanced" icon={Wand2} defaultExpanded={false}>
            {/* Branding Settings */}
            <BrandingSelector />
          </CollapsibleSection>

          {/* Action Button */}
          <div className="mt-auto pt-6 border-t border-white/5">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-xs text-red-200">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {!editMode && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !localTopic}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${isGenerating || !localTopic
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate Carousel
                  </>
                )}
              </button>
            )}

            {editMode && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${isGenerating
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Regenerate
                  </>
                )}
              </button>
            )}
          </div>
        </aside>

        {/* Right Panel: Preview */}
        <main className="flex-1 relative bg-neutral-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950 to-neutral-950">
          <CarouselPreview />
        </main>
      </div>

      {/* Save Modal */}
      <SaveCarouselModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        templateType={selectedTemplate}
        theme={getTheme()}
        slides={slides}
        presetId={activePresetId}
        format={selectedFormat}
        defaultTitle={localTopic}
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