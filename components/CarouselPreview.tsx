import React, { useState, useRef, useEffect } from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { useAuthStore } from '../store/useAuthStore';
import { injectContentIntoSvg } from '../utils/svgInjector';
import { optimizeSvgForFigma } from '../utils/figmaOptimizer';
import { exportSlideToJpg } from '../utils/jpgExporter';
import { exportSlideToPdf } from '../utils/pdfExporter';
import { Edit2, Download, RefreshCw, Copy, CheckCircle, ChevronLeft, ChevronRight, Image, FileText } from 'lucide-react';
import { SlideContent } from '../types';
import { ViewModeToggle } from './ViewModeToggle';

export const CarouselPreview: React.FC = () => {
  const { slides, selectedTemplate, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, isGenerating, theme, brandMode, brandKit, signaturePosition, selectedSlideIndex, setSelectedSlideIndex, setRightPanelOpen, viewMode } = useCarouselStore();
  const { globalBrandKit } = useAuthStore();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const [exportingPdfIndex, setExportingPdfIndex] = useState<number | null>(null);
  const slideRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Get effective branding based on mode
  const effectiveBranding = {
    enabled: true,
    ...brandKit.identity,
    position: signaturePosition
  };

  const handleCopy = async (slide: SlideContent, index: number) => {
    setIsCopying(true);

    try {
      // Generate SVG (Synchronous Native Generator)
      const optimizedSvg = await optimizeSvgForFigma(slide, theme, selectedTemplate, selectedFormat, effectiveBranding, selectedPattern, patternOpacity, patternScale, patternSpacing);

      await navigator.clipboard.writeText(optimizedSvg);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    } finally {
      setIsCopying(false);
    }
  };

  const handleExportJpg = async (index: number, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();

    setExportingIndex(index);

    try {
      const slideElement = slideRefs.current[index];
      if (!slideElement) {
        throw new Error('Slide element not found');
      }

      await exportSlideToJpg(slideElement, index, selectedFormat);
    } catch (err) {
      console.error('Failed to export JPG:', err);
      alert('Failed to export JPG. Please try again.');
    } finally {
      setExportingIndex(null);
    }
  };

  const handleExportPdf = async (index: number, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();

    setExportingPdfIndex(index);

    try {
      const slideElement = slideRefs.current[index];
      if (!slideElement) {
        throw new Error('Slide element not found');
      }

      await exportSlideToPdf(slideElement, index, selectedFormat);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPdfIndex(null);
    }
  };

  const handleSlideClick = (index: number) => {
    setSelectedSlideIndex(index);
    setRightPanelOpen(true);
  };

  const handleFocusSlideClick = (index: number) => {
    setSelectedSlideIndex(index);
  };

  const handlePrevSlide = () => {
    if (selectedSlideIndex === null) {
      setSelectedSlideIndex(0);
    } else {
      setSelectedSlideIndex(selectedSlideIndex > 0 ? selectedSlideIndex - 1 : slides.length - 1);
    }
  };

  const handleNextSlide = () => {
    if (selectedSlideIndex === null) {
      setSelectedSlideIndex(0);
    } else {
      setSelectedSlideIndex(selectedSlideIndex < slides.length - 1 ? selectedSlideIndex + 1 : 0);
    }
  };

  if (isGenerating) {
    const { generationStatus, generationProgress } = useCarouselStore.getState();

    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-8 max-w-md w-full px-8 p-12 bg-neutral-900/50 rounded-2xl border border-white/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">

          {/* Animated Illustration Area */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20 duration-1000" />
            <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-2 border-2 border-purple-500/30 rounded-full animate-[spin_4s_linear_infinite_reverse]" />
            <RefreshCw className="w-8 h-8 text-blue-400 animate-[spin_2s_linear_infinite]" />
          </div>

          <div className="flex flex-col items-center gap-4 w-full text-center">
            {/* Status Text - Animated */}
            <div className="h-8 flex items-center justify-center overflow-hidden">
              <p className="font-medium text-lg text-white animate-in slide-in-from-bottom-2 fade-in duration-300 key={generationStatus}">
                {generationStatus || 'AI Agents are crafting your slides...'}
              </p>
            </div>

            <p className="text-sm text-neutral-400">
              Our AI agents are researching, writing, and designing your carousel.
            </p>

            {/* Progress Bar */}
            <div className="w-full space-y-2 mt-4">
              <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)] relative overflow-hidden"
                  style={{ width: `${Math.max(5, generationProgress || 5)}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-neutral-500 font-mono">
                <span>{Math.round(generationProgress || 0)}%</span>
                <span className="animate-pulse">Processing...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/30 italic flex-col gap-4">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
          <Download size={24} opacity={0.5} />
        </div>
        <p>Enter a topic to generate your first carousel.</p>
      </div>
    );
  }

  // Focus View - 3D Carousel
  if (viewMode === 'focus') {
    const centerIndex = selectedSlideIndex ?? 0;

    return (
      <div className="w-full h-full flex flex-col">
        {/* Header with View Toggle */}
        <div className="flex justify-between items-center px-8 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60">
              {slides.length} slide{slides.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ViewModeToggle />
        </div>

        {/* 3D Carousel Container */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <div
            className="relative w-full h-full flex items-center justify-center"
            style={{
              perspective: '2000px',
              perspectiveOrigin: '50% 50%'
            }}
          >
            {slides.map((slide, index) => {
              const offset = index - centerIndex;
              const absOffset = Math.abs(offset);

              // Only show slides within range
              if (absOffset > 2) return null;

              const svgString = injectContentIntoSvg(selectedTemplate, slide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, `focus-${index}`);
              const isCenter = offset === 0;
              const isCopied = copiedIndex === index;

              // Calculate transforms
              const translateX = offset * 45; // Percentage
              const translateZ = isCenter ? 0 : -300 - (absOffset - 1) * 100;
              const rotateY = offset * -25; // Degrees
              const scale = isCenter ? 1 : 0.75 - (absOffset - 1) * 0.1;
              const opacity = isCenter ? 1 : 0.5 - (absOffset - 1) * 0.2;

              return (
                <div
                  key={index}
                  className="absolute transition-all duration-500 ease-out cursor-pointer"
                  style={{
                    transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                    opacity: opacity,
                    zIndex: isCenter ? 20 : 10 - absOffset,
                    width: selectedFormat === 'square' ? '65vh' : 'calc(65vh * 0.8)',
                    height: '65vh',
                  }}
                  onClick={() => handleFocusSlideClick(index)}
                >
                  {/* Slide Card */}
                  <div className={`relative w-full h-full bg-black shadow-2xl rounded-xl overflow-hidden border transition-all ${isCenter ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-white/10'
                    }`}>
                    {/* Slide Number & Actions - Only show on center slide */}
                    {isCenter && (
                      <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-white/60 font-mono uppercase tracking-widest">
                            Slide {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSlideClick(index);
                              }}
                              className="p-1.5 bg-neutral-800/80 hover:bg-blue-600 text-white rounded-md transition-colors backdrop-blur-sm"
                              title="Edit Content"
                              aria-label="Edit Content"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(slide, index);
                              }}
                              disabled={isCopying}
                              className={`p-1.5 rounded-md transition-all flex items-center gap-1 backdrop-blur-sm ${isCopied
                                ? 'bg-green-600 text-white'
                                : 'bg-neutral-800/80 hover:bg-purple-600 text-white'
                                }`}
                              title="Copy optimized SVG for Figma"
                              aria-label="Copy optimized SVG for Figma"
                            >
                              {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                              <span className="text-xs font-medium ml-1">{isCopied ? 'Copied' : 'Figma'}</span>
                            </button>
                            <button
                              onClick={(e) => handleExportJpg(index, e)}
                              disabled={exportingIndex === index}
                              className="p-1.5 bg-neutral-800/80 hover:bg-orange-600 text-white rounded-md transition-colors backdrop-blur-sm"
                              title="Export as JPG"
                              aria-label="Export as JPG"
                            >
                              <Image size={14} />
                            </button>
                            <button
                              onClick={(e) => handleExportPdf(index, e)}
                              disabled={exportingPdfIndex === index}
                              className="p-1.5 bg-neutral-800/80 hover:bg-red-600 text-white rounded-md transition-colors backdrop-blur-sm"
                              title="Export as PDF"
                              aria-label="Export as PDF"
                            >
                              <FileText size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SVG Render */}
                    <div className="w-full h-full flex items-center justify-center" style={{ overflow: 'hidden' }}>
                      <style>
                        {`
                          .svg-preview-container svg {
                            max-width: 100%;
                            max-height: 100%;
                            width: auto;
                            height: auto;
                          }
                        `}
                      </style>
                      <div
                        ref={(el) => { slideRefs.current[index] = el; }}
                        className="svg-preview-container w-full h-full flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: svgString }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={handlePrevSlide}
            className="absolute left-8 top-1/2 -translate-y-1/2 z-30 p-3 bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 rounded-full transition-all backdrop-blur-sm group"
            title="Previous Slide"
            aria-label="Previous Slide"
          >
            <ChevronLeft size={24} className="text-white/60 group-hover:text-white" />
          </button>
          <button
            onClick={handleNextSlide}
            className="absolute right-8 top-1/2 -translate-y-1/2 z-30 p-3 bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 rounded-full transition-all backdrop-blur-sm group"
            title="Next Slide"
            aria-label="Next Slide"
          >
            <ChevronRight size={24} className="text-white/60 group-hover:text-white" />
          </button>
        </div>

        {/* Bottom Indicator */}
        <div className="flex justify-center items-center gap-2 py-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedSlideIndex(index)}
              className={`h-1.5 rounded-full transition-all ${index === centerIndex
                ? 'w-8 bg-blue-500'
                : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
              title={`Go to slide ${index + 1}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Grid View (Original)
  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with View Toggle */}
      <div className="flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60">
            {slides.length} slide{slides.length !== 1 ? 's' : ''}
          </span>
        </div>
        <ViewModeToggle />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
          {slides.map((slide, index) => {
            // Preview with carousel-level branding
            const svgString = injectContentIntoSvg(selectedTemplate, slide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, `grid-${index}`);
            const isSelected = selectedSlideIndex === index;
            const isCopied = copiedIndex === index;

            return (
              <div key={index} className="flex flex-col gap-3 group relative">
                {/* Header */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-white/40 font-mono uppercase tracking-widest">
                    Slide 0{index + 1}
                  </span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleSlideClick(index)}
                      className="p-1.5 bg-neutral-800 hover:bg-blue-600 text-white rounded-md transition-colors"
                      title="Edit Content"
                      aria-label="Edit Content"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleCopy(slide, index)}
                      disabled={isCopying}
                      className={`p-1.5 rounded-md transition-all flex items-center gap-1 ${isCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-neutral-800 hover:bg-purple-600 text-white'
                        }`}
                      title="Copy optimized SVG for Figma"
                      aria-label="Copy optimized SVG for Figma"
                    >
                      {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {isCopied ? (
                        <span className="text-[10px] font-bold px-1">COPIED</span>
                      ) : (
                        <span className="text-xs font-medium px-1">Figma</span>
                      )}
                    </button>
                    <button
                      onClick={() => handleExportJpg(index)}
                      disabled={exportingIndex === index}
                      className="p-1.5 bg-neutral-800 hover:bg-orange-600 text-white rounded-md transition-colors"
                      title="Export as JPG"
                      aria-label="Export as JPG"
                    >
                      <Image size={14} />
                    </button>
                    <button
                      onClick={() => handleExportPdf(index)}
                      disabled={exportingPdfIndex === index}
                      className="p-1.5 bg-neutral-800 hover:bg-red-600 text-white rounded-md transition-colors"
                      title="Export as PDF"
                      aria-label="Export as PDF"
                    >
                      <FileText size={14} />
                    </button>
                  </div>
                </div>

                {/* Card Container */}
                <div
                  className={`relative ${selectedFormat === 'square' ? 'aspect-square' : 'aspect-[4/5]'} w-full bg-black shadow-2xl rounded-xl overflow-hidden border transition-all cursor-pointer ${isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : 'border-white/10 group-hover:border-white/20'
                    }`}
                  onClick={() => handleSlideClick(index)}
                >
                  {/* SVG Render (DOM) */}
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      overflow: 'hidden'
                    }}
                  >
                    <style>
                      {`
                        .svg-preview-container svg {
                          max-width: 100%;
                          max-height: 100%;
                          width: auto;
                          height: auto;
                        }
                      `}
                    </style>
                    <div
                      ref={(el) => { slideRefs.current[index] = el; }}
                      className="svg-preview-container w-full h-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: svgString }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};