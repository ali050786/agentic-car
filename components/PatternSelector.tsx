import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { getPatternName } from '../utils/patternGenerator';

/**
 * Pattern Selector Component
 * 
 * Allows users to manually select from 12 background patterns
 */
export const PatternSelector: React.FC = () => {
    const {
        selectedPattern,
        setPattern,
        patternOpacity,
        setPatternOpacity,
        patternScale,
        setPatternScale,
        patternSpacing,
        setPatternSpacing
    } = useCarouselStore();

    // All 12 patterns
    const patterns = [
        { id: 1, name: getPatternName(1), icon: '/' },
        { id: 2, name: getPatternName(2), icon: '\\' },
        { id: 3, name: getPatternName(3), icon: '#' },
        { id: 4, name: getPatternName(4), icon: '•' },
        { id: 5, name: getPatternName(5), icon: '▪' },
        { id: 6, name: getPatternName(6), icon: '+' },
        { id: 7, name: getPatternName(7), icon: '✕' },
        { id: 8, name: getPatternName(8), icon: '—' },
        { id: 9, name: getPatternName(9), icon: '|' },
        { id: 10, name: getPatternName(10), icon: '▲' },
        { id: 11, name: getPatternName(11), icon: '⬢' },
        { id: 12, name: getPatternName(12), icon: '~' },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Pattern Selector */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-neutral-400">
                    Pattern Type
                </label>

                <select
                    value={selectedPattern}
                    onChange={(e) => setPattern(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                    {patterns.map((pattern) => (
                        <option key={pattern.id} value={pattern.id}>
                            {pattern.icon} {pattern.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Opacity Slider */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-400">
                        Pattern Opacity
                    </label>
                    <span className="text-xs text-neutral-500 font-mono">
                        {Math.round(patternOpacity * 100)}%
                    </span>
                </div>

                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={patternOpacity}
                    onChange={(e) => setPatternOpacity(Number(e.target.value))}
                    className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-blue-500 
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                             [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                             [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                             [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer 
                             [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg"
                />
            </div>

            {/* Scale Slider */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-400">
                        Pattern Scale
                    </label>
                    <span className="text-xs text-neutral-500 font-mono">
                        {patternScale?.toFixed(1) || '1.0'}x
                    </span>
                </div>

                <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={patternScale || 1}
                    onChange={(e) => setPatternScale(Number(e.target.value))}
                    className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-blue-500 
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                             [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                             [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                             [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer 
                             [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg"
                />
            </div>

            {/* Spacing Slider */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-400">
                        Pattern Spacing
                    </label>
                    <span className="text-xs text-neutral-500 font-mono">
                        {patternSpacing?.toFixed(1) || '1.0'}x
                    </span>
                </div>

                <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={patternSpacing || 1}
                    onChange={(e) => setPatternSpacing(Number(e.target.value))}
                    className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-blue-500 
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                             [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                             [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                             [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer 
                             [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg"
                />
            </div>

            <p className="text-xs text-neutral-600 italic">
                Customize pattern style and visibility
            </p>
        </div>
    );
};
