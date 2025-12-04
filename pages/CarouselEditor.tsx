/**
 * Carousel Editor Page - FIXED VERSION
 * 
 * Load and edit existing saved carousels.
 * Similar to main generator but pre-fills with saved data.
 * 
 * Location: src/pages/CarouselEditor.tsx
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useCarouselStore } from '../store/useCarouselStore';
import { getCarouselById, updateCarouselContent } from '../services/carouselService';
import { Carousel } from '../lib/supabaseClient';
import { CarouselPreview } from '../components/CarouselPreview';
import { runAgentWorkflow } from '../core/agents/MainAgent';
import { 
  Layout, 
  Sparkles, 
  AlertCircle, 
  Save, 
  ArrowLeft,
  Loader,
  CheckCircle 
} from 'lucide-react';

export const CarouselEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    topic, 
    setTopic, 
    selectedTemplate, 
    setTemplate, 
    isGenerating, 
    error,
    slides,
    setSlides 
  } = useCarouselStore();

  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [localTopic, setLocalTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load carousel on mount
  useEffect(() => {
    if (id && user) {
      loadCarousel();
    }
  }, [id, user]);

  const loadCarousel = async () => {
    if (!id || !user) return;

    setLoading(true);
    setLoadError('');

    const { data, error } = await getCarouselById(id);

    if (error || !data) {
      setLoadError('Failed to load carousel');
      setLoading(false);
      return;
    }

    // Check ownership
    if (data.user_id !== user.id) {
      setLoadError('You do not have permission to edit this carousel');
      setLoading(false);
      return;
    }

    // Set carousel data
    setCarousel(data);
    setLocalTopic(data.title || '');
    setTopic(data.title || '');
    setTemplate(data.template_type === 'template1' ? 'template-1' : 'template-2');
    
    // FIX: Cast slides to proper type to avoid TypeScript error
    setSlides(data.slides as any);

    setLoading(false);
  };

  const handleRegenerate = async () => {
    if (!localTopic.trim()) return;

    setTopic(localTopic);
    await runAgentWorkflow(localTopic);
  };

  const handleSaveChanges = async () => {
    if (!carousel || !user) return;

    setIsSaving(true);

    const theme = carousel.theme; // Use existing theme
    const { data, error } = await updateCarouselContent(carousel.id, theme, slides);

    setIsSaving(false);

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading carousel...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Carousel</h2>
          <p className="text-neutral-400 mb-6">{loadError}</p>
          <button
            onClick={() => navigate('/library')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium transition-all"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/library')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
              <Layout className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{carousel?.title}</h1>
              <p className="text-xs text-neutral-500">Editing carousel</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
              <CheckCircle size={16} />
              Saved!
            </div>
          )}
          <button
            onClick={handleSaveChanges}
            disabled={isSaving || slides.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isSaving || slides.length === 0
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
            }`}
          >
            {isSaving ? (
              <>
                <Loader size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
          <Link
            to="/library"
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium transition-colors"
          >
            Library
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        {/* Info Alert */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-400 mb-1">Editing Mode</h3>
            <p className="text-sm text-blue-200/80">
              You're editing an existing carousel. Make changes below and click "Save Changes" to update it.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Editor */}
          <div className="space-y-6">
            {/* Topic Input */}
            <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
              <label className="block text-sm font-medium text-neutral-300 mb-3">
                Carousel Topic
              </label>
              <textarea
                value={localTopic}
                onChange={(e) => setLocalTopic(e.target.value)}
                placeholder="Enter your topic or question here..."
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                rows={4}
              />
            </div>

            {/* Template Selection */}
            <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
              <label className="block text-sm font-medium text-neutral-300 mb-3">
                Carousel Template
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTemplate('template-1')}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedTemplate === 'template-1'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 bg-black/20 hover:border-white/30'
                  }`}
                >
                  <div className="font-medium text-white mb-1">The Truth</div>
                  <div className="text-xs text-neutral-400">Clean & minimal</div>
                </button>

                <button
                  onClick={() => setTemplate('template-2')}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedTemplate === 'template-2'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 bg-black/20 hover:border-white/30'
                  }`}
                >
                  <div className="font-medium text-white mb-1">The Clarity</div>
                  <div className="text-xs text-neutral-400">Bold & vibrant</div>
                </button>
              </div>
            </div>

            {/* Regenerate Button */}
            <button
              onClick={handleRegenerate}
              disabled={isGenerating || !localTopic.trim()}
              className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-3 ${
                isGenerating || !localTopic.trim()
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Regenerate Carousel
                </>
              )}
            </button>

            {/* Warning */}
            {slides.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <p className="text-sm text-yellow-200/80">
                  ⚠️ This will replace the current slides with new ones
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-200 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Preview */}
          <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Preview</h2>
            {slides.length > 0 ? (
              <CarouselPreview />
            ) : (
              <div className="aspect-[9/16] bg-neutral-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Layout className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">No slides yet</p>
                  <p className="text-neutral-600 text-xs mt-1">Generate to see preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CarouselEditor;