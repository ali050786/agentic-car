/**
 * Compact Theme Selector Component
 * 
 * Dropdown-based color preset selector with visual preview.
 * Much more compact than the grid layout (~80px vs ~400px).
 * 
 * Location: src/components/ThemeSelector.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { PRESETS } from '../config/colorPresets';
import { Check, ChevronDown } from 'lucide-react';

export const ThemeSelector: React.FC = () => {
    const { activePresetId, setActivePreset } = useCarouselStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const activePreset = PRESETS.find(p => p.id === activePresetId) || PRESETS[0];

    return (
        <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-neutral-500">
                Color Preset
            </label>

            {/* Dropdown Trigger */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg hover:border-white/30 transition-colors text-left flex items-center justify-between group"
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Color Preview Strip */}
                        <div className="flex gap-0.5 h-6 rounded overflow-hidden flex-shrink-0" style={{ width: '48px' }}>
                            <div className="flex-1" style={{ backgroundColor: activePreset.seeds.primary }} />
                            <div className="flex-1" style={{ backgroundColor: activePreset.seeds.secondary }} />
                            <div className="flex-1" style={{ backgroundColor: activePreset.seeds.text }} />
                            <div className="flex-1" style={{ backgroundColor: activePreset.seeds.background }} />
                        </div>

                        {/* Preset Name */}
                        <span className="text-sm font-medium text-white truncate">
                            {activePreset.name}
                        </span>
                    </div>

                    {/* Chevron */}
                    <ChevronDown
                        size={16}
                        className={`text-neutral-400 group-hover:text-neutral-300 transition-all flex-shrink-0 ${isOpen ? 'rotate-180' : ''
                            }`}
                    />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-neutral-800 border border-white/10 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                        {PRESETS.map((preset) => {
                            const isActive = activePresetId === preset.id;

                            return (
                                <button
                                    key={preset.id}
                                    onClick={() => {
                                        setActivePreset(preset.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full p-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 flex items-center gap-3 ${isActive ? 'bg-blue-500/10' : ''
                                        }`}
                                >
                                    {/* Color Preview Strip */}
                                    <div className="flex gap-0.5 h-6 rounded overflow-hidden flex-shrink-0" style={{ width: '48px' }}>
                                        <div className="flex-1" style={{ backgroundColor: preset.seeds.primary }} />
                                        <div className="flex-1" style={{ backgroundColor: preset.seeds.secondary }} />
                                        <div className="flex-1" style={{ backgroundColor: preset.seeds.text }} />
                                        <div className="flex-1" style={{ backgroundColor: preset.seeds.background }} />
                                    </div>

                                    {/* Preset Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-white text-sm truncate">{preset.name}</div>
                                        {preset.description && (
                                            <div className="text-xs text-neutral-400 truncate mt-0.5">{preset.description}</div>
                                        )}
                                    </div>

                                    {/* Check Mark */}
                                    {isActive && (
                                        <Check size={16} className="text-blue-400 flex-shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ThemeSelector;
