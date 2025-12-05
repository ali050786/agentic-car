import React, { useState } from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { injectContentIntoSvg } from '../utils/svgInjector';
import { optimizeSvgForFigma } from '../utils/figmaOptimizer';
import { Edit2, Download, Check, X, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { SlideContent } from '../types';

const SlideEditor: React.FC<{
  slide: SlideContent;
  onSave: (c: Partial<SlideContent>) => void;
  onCancel: () => void
}> = ({ slide, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ ...slide });

  const handleChange = (field: keyof SlideContent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleListChange = (index: number, value: string) => {
    const newList = [...(formData.listItems || [])];
    newList[index] = value;
    setFormData(prev => ({ ...prev, listItems: newList }));
  };

  return (
    <div className="absolute inset-0 bg-neutral-900/95 backdrop-blur-sm z-10 p-4 flex flex-col gap-3 overflow-y-auto border border-blue-500/50 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white font-bold text-sm uppercase">Edit Slide</h3>
        <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded"><X size={16} /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Preheader</label>
          <input
            value={formData.preHeader || ''}
            onChange={(e) => handleChange('preHeader', e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Headline</label>
          <input
            value={formData.headline}
            onChange={(e) => handleChange('headline', e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white font-bold"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Highlight</label>
          <input
            value={formData.headlineHighlight || ''}
            onChange={(e) => handleChange('headlineHighlight', e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-blue-400 font-bold"
          />
        </div>

        {formData.variant !== 'list' && (
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Body Text</label>
            <textarea
              value={formData.body || ''}
              onChange={(e) => handleChange('body', e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white h-20"
            />
          </div>
        )}

        {formData.variant === 'list' && (
          <div>
            <label className="text-xs text-neutral-400 block mb-1">List Items</label>
            <div className="space-y-2">
              {formData.listItems?.map((item, idx) => (
                <input
                  key={idx}
                  value={item}
                  onChange={(e) => handleListChange(idx, e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-neutral-400 block mb-1">Footer</label>
          <input
            value={formData.footer || ''}
            onChange={(e) => handleChange('footer', e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
          />
        </div>
      </div>

      <div className="mt-auto pt-4 flex gap-2">
        <button
          onClick={() => onSave(formData)}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
        >
          <Check size={14} /> Save
        </button>
      </div>
    </div>
  );
};

export const CarouselPreview: React.FC = () => {
  const { slides, selectedTemplate, isGenerating, updateSlide, theme, branding } = useCarouselStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async (slide: SlideContent, index: number) => {
    setIsCopying(true);

    try {
      // Generate SVG (Synchronous Native Generator)
      const optimizedSvg = await optimizeSvgForFigma(slide, theme, selectedTemplate);

      await navigator.clipboard.writeText(optimizedSvg);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    } finally {
      setIsCopying(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-full text-white/50 animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin h-12 w-12 text-blue-500" />
          <p className="font-mono text-sm">AI Agents are crafting your slides & theme...</p>
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

  return (
    <div className="w-full h-full overflow-y-auto bg-neutral-900 p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
        {slides.map((slide, index) => {
          // Preview with carousel-level branding
          const svgString = injectContentIntoSvg(selectedTemplate, slide, theme, branding);
          const isEditing = editingIndex === index;
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
                    onClick={() => setEditingIndex(index)}
                    className="p-1.5 bg-neutral-800 hover:bg-blue-600 text-white rounded-md transition-colors"
                    title="Edit Content"
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
                  >
                    {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    {isCopied && <span className="text-[10px] font-bold px-1">COPIED</span>}
                  </button>
                </div>
              </div>

              {/* Card Container */}
              <div className="relative aspect-[4/5] w-full bg-black shadow-2xl rounded-xl overflow-hidden border border-white/10 group-hover:border-white/20 transition-all">
                {/* SVG Render (DOM) */}
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: svgString }}
                />

                {/* Edit Overlay */}
                {isEditing && (
                  <SlideEditor
                    slide={slide}
                    onCancel={() => setEditingIndex(null)}
                    onSave={(newContent) => {
                      updateSlide(index, newContent);
                      setEditingIndex(null);
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};