import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { getPatternName } from '../utils/patternGenerator';

/**
 * Pattern Selector Component
 * 
 * Allows users to manually select from 12 background patterns
 */
export const PatternSelector: React.FC = () => {
    const { selectedPattern, setPattern } = useCarouselStore();

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
        <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-neutral-500">
                Background Pattern
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

            <p className="text-xs text-neutral-600 italic">
                Choose a pattern for your carousel background
            </p>
        </div>
    );
};
