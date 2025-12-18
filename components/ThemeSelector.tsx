/**
 * Theme Selector Component
 * 
 * Allows users to select between:
 * - Global brand (from user profile)
 * - Color presets (predefined palettes)
 * - Custom brand (carousel-specific)
 * 
 * Location: src/components/ThemeSelector.tsx
 */

import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { useAuthStore } from '../store/useAuthStore';
import { PRESETS } from '../config/colorPresets';
import { Globe, Palette, Edit3 } from 'lucide-react';

interface ThemeSelectorProps {
    onOpenBrandEditor?: () => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onOpenBrandEditor }) => {
    const { brandMode, setBrandMode, presetId, setPresetId } = useCarouselStore();
    const { globalBrandKit } = useAuthStore();

    return (
        <div className="flex flex-col gap-4 w-full min-w-[280px]">
            {/* Brand Mode Selection */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-neutral-400">
                    Brand Source
                </label>


                {/* Preset Option */}
                <button
                    onClick={() => setBrandMode('preset')}
                    className={`p-3 rounded-lg border text-left transition-all ${brandMode === 'preset'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/30'
                        }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Palette className="w-4 h-4 text-purple-400" />
                            <span className="font-bold text-white text-sm">Color Preset</span>
                        </div>
                        {brandMode === 'preset' && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                    </div>
                    <div className="text-xs text-neutral-400 ml-6">Choose from curated palettes</div>
                </button>

                {/* Custom Brand Option */}
                <button
                    onClick={() => setBrandMode('custom')}
                    className={`p-3 rounded-lg border text-left transition-all ${brandMode === 'custom'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/30'
                        }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-amber-400" />
                            <span className="font-bold text-white text-sm">Your Brand</span>
                        </div>
                        {brandMode === 'custom' && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                    </div>
                    <div className="text-xs text-neutral-400 ml-6">Use your personalized branding</div>
                </button>
            </div>

            {/* Preset Selector (only shown when preset mode is active) */}
            {brandMode === 'preset' && (
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-neutral-400">
                        Select Preset
                    </label>
                    <select
                        value={presetId}
                        onChange={(e) => setPresetId(e.target.value)}
                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    >
                        {PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.name}
                            </option>
                        ))}
                    </select>

                    {/* Show color preview */}
                    <div className="flex gap-1 mt-1">
                        {(() => {
                            const currentPreset = PRESETS.find(p => p.id === presetId);
                            if (!currentPreset) return null;
                            return (
                                <>
                                    <div
                                        className="w-8 h-8 rounded border border-white/20"
                                        style={{ backgroundColor: currentPreset.seeds.primary }}
                                        title="Primary"
                                    />
                                    <div
                                        className="w-8 h-8 rounded border border-white/20"
                                        style={{ backgroundColor: currentPreset.seeds.secondary }}
                                        title="Secondary"
                                    />
                                    <div
                                        className="w-8 h-8 rounded border border-white/20"
                                        style={{ backgroundColor: currentPreset.seeds.background }}
                                        title="Background"
                                    />
                                    <div
                                        className="w-8 h-8 rounded border border-white/20"
                                        style={{ backgroundColor: currentPreset.seeds.text }}
                                        title="Text"
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Edit Brand Buttons */}
            {onOpenBrandEditor && (
                <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                    <button
                        onClick={() => onOpenBrandEditor()}
                        className="px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors"
                    >
                        Edit Brand Identity
                    </button>
                </div>
            )}
        </div>
    );
};

export default ThemeSelector;
