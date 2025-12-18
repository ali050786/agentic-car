import React, { useState, useEffect } from 'react';
import { X, Check, Wand2, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { SlideContent } from '../types';
import { EditorAgent, RefinementGoal } from '../core/agents/EditorAgent';

interface SlideEditPanelProps {
    isOpen: boolean;
    slide: SlideContent | null;
    slideIndex: number | null;
    onClose: () => void;
    onSave: (index: number, content: Partial<SlideContent>) => void;
}

export const SlideEditPanel: React.FC<SlideEditPanelProps> = ({
    isOpen,
    slide,
    slideIndex,
    onClose,
    onSave,
}) => {
    const [formData, setFormData] = useState<SlideContent | null>(null);
    const [activeMagicField, setActiveMagicField] = useState<string | null>(null); // 'headline' | 'body'
    const [isGenerating, setIsGenerating] = useState(false);
    const [headlineAlternatives, setHeadlineAlternatives] = useState<string[]>([]);
    const [showAlternatives, setShowAlternatives] = useState(false);

    // Close magic menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (activeMagicField && !(e.target as Element).closest('.magic-wand-container')) {
                setActiveMagicField(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeMagicField]);

    // Update form data when slide changes
    useEffect(() => {
        if (slide) {
            setFormData({ ...slide });
        }
    }, [slide]);

    const handleChange = (field: keyof SlideContent, value: any) => {
        if (formData) {
            setFormData((prev) => ({ ...prev!, [field]: value }));
        }
    };

    const handleListChange = (index: number, value: string) => {
        if (!formData) return;
        const newList = [...(formData.listItems || [])];
        const currentItem = newList[index];
        // If the current item is an object, preserve the structure
        if (typeof currentItem === 'object' && currentItem !== null) {
            newList[index] = { ...currentItem, bullet: value };
        } else {
            newList[index] = value;
        }
        setFormData((prev) => ({ ...prev!, listItems: newList }));
    };

    const handleRefineText = async (goal: RefinementGoal) => {
        if (!formData || !formData.body) return;

        setIsGenerating(true);
        setActiveMagicField(null); // Close menu

        try {
            const refined = await EditorAgent.refineText(formData.body, goal, formData.headline);
            handleChange('body', refined);
        } catch (error) {
            console.error('Refinement failed:', error);
            // Could add a toast here
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateHeadlineAlternatives = async () => {
        if (!formData || !formData.headline) return;

        setIsGenerating(true);
        // Don't close menu immediately, switch to loading view inside it? 
        // Or just show loading state.

        try {
            const alts = await EditorAgent.generateHeadlineAlternatives(formData.headline, formData.body);
            setHeadlineAlternatives(alts);
            setShowAlternatives(true);
            setActiveMagicField(null); // Close main menu, show alternatives modal/list
        } catch (error) {
            console.error('Headline generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const applyHeadlineAlternative = (alt: string) => {
        handleChange('headline', alt);
        setShowAlternatives(false);
        setHeadlineAlternatives([]);
    };

    const handleSave = () => {
        if (slideIndex !== null && formData) {
            onSave(slideIndex, formData);
            onClose();
        }
    };

    if (!isOpen || !slide || !formData || slideIndex === null) {
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-16 bottom-0 w-96 bg-neutral-900 border-l border-white/10 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white">Edit Slide</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Slide {slideIndex + 1}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-neutral-400 hover:text-white"
                        title="Close Edit Panel"
                        aria-label="Close Edit Panel"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Preheader */}
                    <div>
                        <label className="text-xs font-medium text-neutral-400 block mb-2">Preheader</label>
                        <input
                            value={formData.preHeader || ''}
                            onChange={(e) => handleChange('preHeader', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Optional preheader text"
                        />
                    </div>

                    {/* Headline */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-neutral-400">
                                Headline <span className="text-red-400">*</span>
                            </label>
                            <div className="relative magic-wand-container">
                                <button
                                    onClick={() => setActiveMagicField(activeMagicField === 'headline' ? null : 'headline')}
                                    className={`p-1.5 rounded-md transition-colors ${activeMagicField === 'headline'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'hover:bg-white/10 text-neutral-500 hover:text-blue-400'
                                        }`}
                                    title="AI Actions"
                                >
                                    {isGenerating && activeMagicField === 'headline' ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Wand2 size={14} />
                                    )}
                                </button>

                                {/* Headline Menu */}
                                {activeMagicField === 'headline' && (
                                    <div className="absolute right-0 top-8 w-48 bg-neutral-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={handleGenerateHeadlineAlternatives}
                                            disabled={isGenerating}
                                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 flex items-center gap-2 group"
                                        >
                                            <Sparkles size={12} className="text-purple-400 group-hover:scale-110 transition-transform" />
                                            Generate 3 Alternatives
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Headline Alternatives Selection UI */}
                        {showAlternatives && (
                            <div className="mb-3 p-3 bg-neutral-800/50 border border-blue-500/30 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                                    <span>Select an alternative:</span>
                                    <button onClick={() => setShowAlternatives(false)} className="hover:text-white"><X size={12} /></button>
                                </div>
                                {headlineAlternatives.map((alt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => applyHeadlineAlternative(alt)}
                                        className="w-full text-left p-2 rounded bg-neutral-900 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/10 text-xs text-white transition-all flex items-start gap-2 group"
                                    >
                                        <span className="mt-0.5 text-blue-500/50 group-hover:text-blue-400"><ChevronRight size={12} /></span>
                                        {alt}
                                    </button>
                                ))}
                            </div>
                        )}
                        <input
                            value={formData.headline}
                            onChange={(e) => handleChange('headline', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Main headline"
                        />
                    </div>

                    {/* Body Text (if not list variant) */}
                    {formData.variant !== 'list' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-neutral-400">Body Text</label>
                                <div className="relative magic-wand-container">
                                    <button
                                        onClick={() => setActiveMagicField(activeMagicField === 'body' ? null : 'body')}
                                        className={`p-1.5 rounded-md transition-colors ${activeMagicField === 'body'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'hover:bg-white/10 text-neutral-500 hover:text-blue-400'
                                            }`}
                                        title="Refine Text"
                                    >
                                        {isGenerating && activeMagicField !== 'headline' ? ( // Rough check, assuming other is body
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Wand2 size={14} />
                                        )}
                                    </button>

                                    {/* Body Menu */}
                                    {activeMagicField === 'body' && (
                                        <div className="absolute right-0 top-8 w-48 bg-neutral-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-white/5">
                                                Rewrite For...
                                            </div>
                                            <button
                                                onClick={() => handleRefineText('CLARITY')}
                                                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 flex items-center gap-2"
                                            >
                                                <span>💧</span> Clarity
                                            </button>
                                            <button
                                                onClick={() => handleRefineText('PUNCHIER')}
                                                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 flex items-center gap-2"
                                            >
                                                <span>🥊</span> Punchier
                                            </button>
                                            <button
                                                onClick={() => handleRefineText('GRAMMAR')}
                                                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 flex items-center gap-2"
                                            >
                                                <span>✨</span> Fix Grammar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={formData.body || ''}
                                onChange={(e) => handleChange('body', e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none h-32"
                                placeholder="Body content"
                            />
                        </div>
                    )}

                    {/* List Items (if list variant) */}
                    {formData.variant === 'list' && (
                        <div>
                            <label className="text-xs font-medium text-neutral-400 block mb-2">List Items</label>
                            <div className="space-y-2">
                                {formData.listItems?.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-xs text-neutral-500 w-6">{idx + 1}.</span>
                                        <input
                                            value={typeof item === 'object' && item !== null ? (item.bullet || '') : (typeof item === 'string' ? item : '')}
                                            onChange={(e) => handleListChange(idx, e.target.value)}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder={`Item ${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div>
                        <label className="text-xs font-medium text-neutral-400 block mb-2">Footer</label>
                        <input
                            value={formData.footer || ''}
                            onChange={(e) => handleChange('footer', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Optional footer text"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={16} />
                        Save Changes
                    </button>
                </div>
            </div>
        </>
    );
};
