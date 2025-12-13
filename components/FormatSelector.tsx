/**
 * Compact Format Selector Component
 * 
 * Segmented control for format selection (Portrait/Square).
 * Much more compact than card-based layout (~60px vs ~140px).
 * 
 * Location: src/components/FormatSelector.tsx
 */

import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';

export const FormatSelector: React.FC = () => {
    const { selectedFormat, setFormat } = useCarouselStore();

    return (
        <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-neutral-500">
                Format
            </label>

            {/* Segmented Control */}
            <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
                {/* Portrait Option */}
                <button
                    onClick={() => setFormat('portrait')}
                    className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${selectedFormat === 'portrait'
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                            : 'text-neutral-400 hover:text-neutral-300'
                        }`}
                >
                    {/* Portrait Icon */}
                    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" className="flex-shrink-0">
                        <rect
                            x="0.5"
                            y="0.5"
                            width="13"
                            height="17"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1"
                            fill={selectedFormat === 'portrait' ? 'currentColor' : 'none'}
                            fillOpacity={selectedFormat === 'portrait' ? '0.2' : '0'}
                        />
                    </svg>
                    <span>Portrait</span>
                    <span className="text-xs opacity-60">1080×1380</span>
                </button>

                {/* Square Option */}
                <button
                    onClick={() => setFormat('square')}
                    className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${selectedFormat === 'square'
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                            : 'text-neutral-400 hover:text-neutral-300'
                        }`}
                >
                    {/* Square Icon */}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <rect
                            x="0.5"
                            y="0.5"
                            width="15"
                            height="15"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1"
                            fill={selectedFormat === 'square' ? 'currentColor' : 'none'}
                            fillOpacity={selectedFormat === 'square' ? '0.2' : '0'}
                        />
                    </svg>
                    <span>Square</span>
                    <span className="text-xs opacity-60">1080×1080</span>
                </button>
            </div>
        </div>
    );
};

export default FormatSelector;
