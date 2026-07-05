/**
 * Theme Selector Component
 * 
 * Allows users to select between Curated Presets and Custom Brand,
 * rendered in a highly visual and premium design.
 * 
 * Location: src/components/ThemeSelector.tsx
 */

import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { PRESETS } from '../config/colorPresets';
import { Globe, Palette, Edit3, UserCircle } from 'lucide-react';

interface ThemeSelectorProps {
    onOpenBrandEditor?: () => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onOpenBrandEditor }) => {
    const { brandMode, setBrandMode, presetId, setPresetId, selectedTemplate, brandKit } = useCarouselStore();

    const isTemplate3 = selectedTemplate === 'template-3';

    // Filter presets for Template-3 (only light themes)
    const availablePresets = isTemplate3
        ? PRESETS.filter(p => p.id.endsWith('-light'))
        : PRESETS;

    return (
        <div className="flex flex-col gap-3.5 w-full">
            {isTemplate3 && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <Globe className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-blue-300 leading-relaxed font-medium">
                        "The Sketch" template is optimized for light themes only to preserve its hand-drawn aesthetic.
                    </p>
                </div>
            )}

            {/* Brand Mode Segmented Toggle */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-0.5 flex gap-0.5">
                <button
                    type="button"
                    onClick={() => setBrandMode('preset')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        brandMode === 'preset'
                            ? 'bg-neutral-800 text-white shadow-sm border border-white/5'
                            : 'text-neutral-400 hover:text-white'
                    }`}
                >
                    <Palette size={13} />
                    Presets
                </button>
                <button
                    type="button"
                    onClick={() => setBrandMode('custom')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        brandMode === 'custom'
                            ? 'bg-neutral-800 text-white shadow-sm border border-white/5'
                            : 'text-neutral-400 hover:text-white'
                    }`}
                >
                    <Edit3 size={13} />
                    Your Brand
                </button>
            </div>

            {/* Preset Selector Grid */}
            {brandMode === 'preset' && (
                <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-1.5 max-h-[176px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {availablePresets.map((preset) => {
                            const isActive = presetId === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setPresetId(preset.id)}
                                    className={`p-2 rounded-lg border text-left flex flex-col gap-1.5 transition-all ${
                                        isActive
                                            ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                                            : 'border-white/5 bg-black/25 hover:border-white/15 hover:bg-black/45'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full gap-1">
                                        <span className="text-[10px] font-bold text-neutral-300 truncate">{preset.name}</span>
                                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                    </div>
                                    <div className="flex -space-x-1">
                                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: preset.seeds.primary }} />
                                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: preset.seeds.secondary }} />
                                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: preset.seeds.background }} />
                                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: preset.seeds.text }} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Custom Brand Identity Card */}
            {brandMode === 'custom' && (
                <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg border border-white/5 bg-black/25 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            {brandKit.identity.imageUrl ? (
                                <img
                                    src={brandKit.identity.imageUrl}
                                    alt=""
                                    className="w-7 h-7 rounded-full border border-white/10 object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold flex-shrink-0">
                                    {brandKit.identity.name ? brandKit.identity.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold text-white truncate">
                                    {brandKit.identity.name || 'Untitled Brand'}
                                </div>
                                <div className="text-[9px] text-neutral-400 truncate">
                                    {brandKit.identity.title || 'Brand identity'}
                                </div>
                            </div>
                        </div>
                        <div className="flex -space-x-1 flex-shrink-0 ml-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.primary }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.secondary }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.background }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.text }} />
                        </div>
                    </div>

                    {onOpenBrandEditor && (
                        <button
                            type="button"
                            onClick={onOpenBrandEditor}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/5 bg-white/[0.02] text-[11px] text-neutral-300 hover:border-white/15 hover:bg-white/[0.04] transition-all"
                        >
                            <UserCircle size={13} />
                            Edit Brand Identity
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ThemeSelector;
