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
        <div className="flex flex-col gap-3 w-full">
            {/* Compact Preset Selector Grid (All color themes visible in one view) */}
            <div className="grid grid-cols-3 gap-1.5">
                {availablePresets.map((preset) => {
                    const isActive = brandMode === 'preset' && presetId === preset.id;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                                setBrandMode('preset');
                                setPresetId(preset.id);
                            }}
                            className={`relative group p-3 rounded-xl border flex items-center justify-center transition-all ${
                                isActive
                                    ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                                    : 'border-white/5 bg-black/25 hover:border-white/15 hover:bg-black/45'
                            }`}
                        >
                            <div className="flex -space-x-1.5 justify-center">
                                <span className="w-5 h-5 rounded-full border-2 border-neutral-950 shadow-sm transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: preset.seeds.primary }} />
                                <span className="w-5 h-5 rounded-full border-2 border-neutral-950 shadow-sm transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: preset.seeds.secondary }} />
                                <span className="w-5 h-5 rounded-full border-2 border-neutral-950 shadow-sm transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: preset.seeds.background }} />
                                <span className="w-5 h-5 rounded-full border-2 border-neutral-950 shadow-sm transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: preset.seeds.text }} />
                            </div>

                            {/* Tooltip */}
                            <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-neutral-950 border border-white/10 text-[9px] font-bold text-white rounded-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-50 whitespace-nowrap">
                                {preset.name}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Custom Brand Branding at the bottom instead of toggle */}
            {brandMode === 'preset' ? (
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setBrandMode('custom')}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                        <Edit3 size={11} />
                        Apply Custom Brand Kit
                    </button>
                    {onOpenBrandEditor && (
                        <button
                            type="button"
                            onClick={onOpenBrandEditor}
                            className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                            Setup Kit
                        </button>
                    )}
                </div>
            ) : (
                <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="p-2 rounded-lg border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            {brandKit.identity.imageUrl ? (
                                <img
                                    src={brandKit.identity.imageUrl}
                                    alt=""
                                    className="w-6.5 h-6.5 rounded-full border border-white/10 object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="w-6.5 h-6.5 rounded-full bg-blue-500/15 border border-blue-500/35 flex items-center justify-center text-blue-400 text-[10px] font-bold flex-shrink-0">
                                    {brandKit.identity.name ? brandKit.identity.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold text-white truncate">
                                    {brandKit.identity.name || 'Untitled Brand'}
                                </div>
                                <div className="text-[9px] text-neutral-400 truncate">
                                    Custom Identity Active
                                </div>
                            </div>
                        </div>
                        <div className="flex -space-x-1.5 flex-shrink-0 ml-1.5">
                            <span className="w-2.5 h-2.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.primary }} />
                            <span className="w-2.5 h-2.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.secondary }} />
                            <span className="w-2.5 h-2.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.background }} />
                            <span className="w-2.5 h-2.5 rounded-full border border-neutral-950 shadow-sm" style={{ backgroundColor: brandKit.colors.text }} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                        <button
                            type="button"
                            onClick={() => setBrandMode('preset')}
                            className="font-bold text-neutral-400 hover:text-white transition-colors"
                        >
                            ← Switch back to Presets
                        </button>
                        {onOpenBrandEditor && (
                            <button
                                type="button"
                                onClick={onOpenBrandEditor}
                                className="font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                                <UserCircle size={12} />
                                Edit Brand Kit
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Disclaimer at the bottom */}
            {isTemplate3 && (
                <div className="mt-1.5 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <Globe className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-blue-300 leading-relaxed font-medium">
                        "The Sketch" template is optimized for light themes only to preserve its hand-drawn aesthetic.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ThemeSelector;
