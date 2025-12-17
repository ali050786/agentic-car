import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { SlideContent } from '../types';

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
                        <label className="text-xs font-medium text-neutral-400 block mb-2">
                            Headline <span className="text-red-400">*</span>
                        </label>
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
                            <label className="text-xs font-medium text-neutral-400 block mb-2">Body Text</label>
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
                                            value={typeof item === 'object' && item !== null ? (item.bullet || '') : (item || '')}
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
