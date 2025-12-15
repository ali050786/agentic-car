/**
 * Public Carousel Viewer - Phase 6
 * 
 * View shared carousels without authentication.
 * Tracks views and displays carousel in full-screen mode.
 * 
 * Location: src/pages/PublicCarouselViewer.tsx
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCarouselById } from '../services/carouselService';
import { Carousel } from '../services/carouselService';
import {
  Layout,
  AlertCircle,
  Eye,
  Calendar,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';

export const PublicCarouselViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (id) {
      loadCarousel();
    }
  }, [id]);

  const loadCarousel = async () => {
    if (!id) return;

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await getCarouselById(id);

    if (fetchError || !data) {
      setError('Carousel not found');
      setLoading(false);
      return;
    }

    // Check if carousel is public
    if (!data.isPublic) {
      setError('This carousel is private');
      setLoading(false);
      return;
    }

    setCarousel(data);
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTemplateLabel = (template: string) => {
    return template === 'template-1' ? 'The Truth' : 'The Clarity';
  };

  const handlePrevSlide = () => {
    if (!carousel) return;
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : carousel.slides.length - 1));
  };

  const handleNextSlide = () => {
    if (!carousel) return;
    setCurrentSlide((prev) => (prev < carousel.slides.length - 1 ? prev + 1 : 0));
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

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{error}</h2>
          <p className="text-neutral-400 mb-6">
            {error === 'Carousel not found'
              ? 'This carousel may have been deleted or the link is incorrect.'
              : 'The owner has made this carousel private.'}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium transition-all"
          >
            Create Your Own
          </button>
        </div>
      </div>
    );
  }

  if (!carousel) return null;

  const currentSlideData = carousel.slides[currentSlide];

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <Layout className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{carousel.title}</h1>
                <div className="flex items-center gap-3 text-xs text-neutral-400">
                  <span>{getTemplateLabel(carousel.templateType)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(carousel.$createdAt)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    {(carousel as any).views || 0} views
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-sm font-medium transition-all"
            >
              <ExternalLink size={16} />
              Create Yours
            </button>
          </div>
        </div>
      </header>

      {/* Carousel Display */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          {/* Slide Preview */}
          <div className="aspect-[9/16] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl mb-6 relative">
            {currentSlideData ? (
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: currentSlideData.svg }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Layout className="w-16 h-16 text-neutral-700" />
              </div>
            )}

            {/* Navigation Arrows */}
            <button
              onClick={handlePrevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={handleNextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center transition-all"
            >
              <ArrowLeft size={20} className="rotate-180" />
            </button>
          </div>

          {/* Slide Counter */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {carousel.slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${index === currentSlide
                  ? 'w-8 bg-blue-500'
                  : 'w-2 bg-neutral-700 hover:bg-neutral-600'
                  }`}
              />
            ))}
          </div>

          {/* Info */}
          <div className="text-center">
            <p className="text-sm text-neutral-400">
              Slide {currentSlide + 1} of {carousel.slides.length}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-neutral-400 mb-3">
            Like this carousel? Create your own with AI
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium transition-all"
          >
            <Layout size={18} />
            Get Started Free
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PublicCarouselViewer;