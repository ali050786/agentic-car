/**
 * Theme Selector Component
 * 
 * Displays available color presets in a grid with visual previews.
 * Users can select a preset to apply custom brand colors.
 * 
 * Location: src/components/ThemeSelector.tsx
 */

import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { PRESETS } from '../config/colorPresets';
import { Check } from 'lucide-react';

export const ThemeSelector: React.FC = () => {
    const { activePresetId, setActivePreset } = useCarouselStore();

    return (
        <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                3. Color Preset
            </label>

            <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((preset) => {
                    const isActive = activePresetId === preset.id;

                    return (
                        <button
                            key={preset.id}
                            onClick={() => setActivePreset(preset.id)}
                            className={`group p-3 rounded-xl border text-left transition-all relative overflow-hidden ${isActive
                                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                                    : 'border-white/10 hover:border-white/30 bg-black/20'
                                }`}
                        >
                            {/* Preset Name */}
                            <div className="relative z-10 mb-3">
                                <div className="font-bold text-white text-sm mb-1 flex justify-between items-center">
                                    <span>{preset.name}</span>
                                    {isActive && (
                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Color Preview Strip */}
                            <div className="flex gap-1 h-6 rounded overflow-hidden">
                                <div
                                    className="flex-1"
                                    style={{ backgroundColor: preset.seeds.primary }}
                                    title="Primary"
                                />
                                <div
                                    className="flex-1"
                                    style={{ backgroundColor: preset.seeds.secondary }}
                                    title="Secondary"
                                />
                                <div
                                    className="flex-1"
                                    style={{ backgroundColor: preset.seeds.text }}
                                    title="Text"
                                />
                                <div
                                    className="flex-1"
                                    style={{ backgroundColor: preset.seeds.background }}
                                    title="Background"
                                />
                            </div>

                            {/* Hover Effect */}
                            <div className={`absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-transparent transition-all ${isActive ? 'opacity-0' : ''
                                }`} />
                        </button>
                    );
                })}
            </div>

            {/* Active Preset Description */}
            {activePresetId && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                    <p className="text-xs text-neutral-400">
                        {PRESETS.find(p => p.id === activePresetId)?.description}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ThemeSelector;
