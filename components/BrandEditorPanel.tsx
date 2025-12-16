/**
 * Brand Editor Panel Component
 * 
 * Side panel for editing brand kit details including:
 * - Brand identity (name, title, image)
 * - Brand colors (primary, secondary, text, background)
 * - Save to global or local scope
 * 
 * Location: src/components/BrandEditorPanel.tsx
 */

import React, { useState, useEffect } from 'react';
import { X, Upload, Save } from 'lucide-react';
import { BrandKit } from '../types';
import { useAuthStore } from '../store/useAuthStore';

interface BrandEditorPanelProps {
    isOpen: boolean;
    mode: 'global' | 'local';
    initialBrandKit: BrandKit | null;
    onSave: (brandKit: BrandKit, scope: 'global' | 'local') => void;
    onClose: () => void;
}

export const BrandEditorPanel: React.FC<BrandEditorPanelProps> = ({
    isOpen,
    mode,
    initialBrandKit,
    onSave,
    onClose,
}) => {
    const { updateGlobalBrandKit } = useAuthStore();

    // Local state for editing
    const [brandKit, setBrandKit] = useState<BrandKit>({
        enabled: true,
        identity: {
            name: '',
            title: '',
            imageUrl: '',
        },
        colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            text: '#ffffff',
            background: '#000000',
        },
    });

    // Sync with initialBrandKit when it changes
    useEffect(() => {
        if (initialBrandKit) {
            setBrandKit(initialBrandKit);
        }
    }, [initialBrandKit]);

    const handleSave = async () => {
        if (mode === 'global') {
            // Save to global profile
            try {
                await updateGlobalBrandKit(brandKit);
                onSave(brandKit, 'global');
                onClose();
            } catch (error) {
                console.error('Failed to save global brand kit:', error);
                alert('Failed to save global brand. Please try again.');
            }
        } else {
            // Save to local carousel
            onSave(brandKit, 'local');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-[400px] bg-neutral-900 border-l border-white/10 shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            {mode === 'global' ? 'Edit Global Brand' : 'Edit Custom Brand'}
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1">
                            {mode === 'global'
                                ? 'Changes apply to all future carousels'
                                : 'Changes only apply to this carousel'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Brand Identity Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Brand Identity
                        </h3>

                        {/* Brand Name */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Brand Name
                            </label>
                            <input
                                type="text"
                                value={brandKit.identity.name}
                                onChange={(e) => setBrandKit({
                                    ...brandKit,
                                    identity: { ...brandKit.identity, name: e.target.value }
                                })}
                                placeholder="e.g. Acme Inc"
                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Brand Title */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Brand Title
                            </label>
                            <input
                                type="text"
                                value={brandKit.identity.title}
                                onChange={(e) => setBrandKit({
                                    ...brandKit,
                                    identity: { ...brandKit.identity, title: e.target.value }
                                })}
                                placeholder="e.g. Founder & CEO"
                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Brand Image URL */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Brand Image URL
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={brandKit.identity.imageUrl}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        identity: { ...brandKit.identity, imageUrl: e.target.value }
                                    })}
                                    placeholder="https://example.com/logo.png"
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <button className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                                    <Upload className="w-4 h-4 text-neutral-400" />
                                </button>
                            </div>
                            {brandKit.identity.imageUrl && (
                                <div className="mt-2 flex items-center gap-3">
                                    <img
                                        src={brandKit.identity.imageUrl}
                                        alt="Brand preview"
                                        className="w-12 h-12 rounded-full object-cover border border-white/20"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                    <span className="text-xs text-neutral-500">Preview</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Brand Colors Section */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Brand Colors
                        </h3>

                        {/* Primary Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Primary Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.primary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, primary: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.primary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, primary: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Secondary Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Secondary Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.secondary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, secondary: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.secondary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, secondary: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Text Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Text Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.text}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, text: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.text}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, text: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Background Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Background Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.background}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, background: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.background}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, background: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white font-medium hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Brand
                    </button>
                </div>
            </div>
        </>
    );
};

export default BrandEditorPanel;
