/**
 * Artifact Settings Panel - carousel-level look and feel in one place.
 * 
 * Replaces the old floating bottom toolbar: template, color preset,
 * format, background pattern, and signature all live here.
 * Redesigned into a floating, tabbed inspector popover widget that
 * sits over the stage in real-time, eliminating screen obstruction and color distortion.
 * 
 * Location: src/components/artifact/ArtifactSettingsPanel.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { useCarouselStore } from '../../store/useCarouselStore';
import { ThemeSelector } from '../ThemeSelector';
import { getPatternName } from '../../utils/patternGenerator';
import { 
    X, User, Layout, Maximize2, Palette, Grid, 
    Flame, Compass, PenTool, Type 
} from 'lucide-react';

const TEMPLATES = [
    { id: 'template-1', name: 'The Truth', desc: 'Bold & high contrast', icon: Flame },
    { id: 'template-2', name: 'The Clarity', desc: 'Clean & tech-forward', icon: Compass },
    { id: 'template-3', name: 'The Sketch', desc: 'Hand-drawn sketches', icon: PenTool },
    { id: 'template-4', name: 'The Statement', desc: 'Premium minimalist', icon: Type },
];

interface ArtifactSettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenBrandEditor: () => void;
}

export const ArtifactSettingsPanel: React.FC<ArtifactSettingsPanelProps> = ({ isOpen, onClose, onOpenBrandEditor }) => {
    const {
        selectedTemplate, setTemplate,
        selectedFormat, setFormat,
        selectedPattern, setPattern,
        patternOpacity, setPatternOpacity,
        patternScale, setPatternScale,
        patternSpacing, setPatternSpacing,
        signaturePosition, setSignaturePosition,
    } = useCarouselStore();

    const [activeTab, setActiveTab] = useState<'layout' | 'style' | 'pattern'>('layout');
    const panelRef = useRef<HTMLDivElement | null>(null);

    // Close settings panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                const target = e.target as HTMLElement;
                // Make sure the click wasn't on the settings toggle button itself (to avoid immediate reopen race)
                if (!target.closest('.settings-trigger-btn')) {
                    onClose();
                }
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Helper to draw mini pattern previews inside swatches
    const renderPatternPreview = (id: number) => {
        switch (id) {
            case 1: // Diagonal Lines (/)
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none">
                        <line x1="0" y1="24" x2="24" y2="0" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="-6" y1="18" x2="18" y2="-6" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="6" y1="30" x2="30" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            case 2: // Diagonal Lines (\)
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none">
                        <line x1="0" y1="0" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="-6" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="18" y1="-6" x2="30" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            case 3: // Cross-hatch
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none">
                        <line x1="0" y1="24" x2="24" y2="0" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="0" y1="0" x2="24" y2="24" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                );
            case 4: // Dots
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="6" cy="6" r="1.5" />
                        <circle cx="18" cy="6" r="1.5" />
                        <circle cx="6" cy="18" r="1.5" />
                        <circle cx="18" cy="18" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                    </svg>
                );
            case 5: // Squares
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="5" y="5" width="4" height="4" rx="0.5" />
                        <rect x="15" y="5" width="4" height="4" rx="0.5" />
                        <rect x="5" y="15" width="4" height="4" rx="0.5" />
                        <rect x="15" y="15" width="4" height="4" rx="0.5" />
                    </svg>
                );
            case 6: // Plus Signs
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M12,4 L12,10 M9,7 L15,7" />
                        <path d="M12,14 L12,20 M9,17 L15,17" />
                    </svg>
                );
            case 7: // X Pattern
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M5,5 L11,11 M11,5 L5,11" />
                        <path d="M13,13 L19,19 M19,13 L13,19" />
                    </svg>
                );
            case 8: // Horizontal Stripes
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <line x1="0" y1="6" x2="24" y2="6" />
                        <line x1="0" y1="12" x2="24" y2="12" />
                        <line x1="0" y1="18" x2="24" y2="18" />
                    </svg>
                );
            case 9: // Vertical Stripes
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <line x1="6" y1="0" x2="6" y2="24" />
                        <line x1="12" y1="0" x2="12" y2="24" />
                        <line x1="18" y1="0" x2="18" y2="24" />
                    </svg>
                );
            case 10: // Triangles
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6,4 10,11 2,11" />
                        <polygon points="18,13 22,20 14,20" />
                    </svg>
                );
            case 11: // Hexagons
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2" fill="none">
                        <polygon points="12,2 18,5 18,12 12,15 6,12 6,5" />
                        <polygon points="12,13 18,16 18,22 12,25 6,22 6,16" />
                    </svg>
                );
            case 12: // Waves
                return (
                    <svg className="w-5 h-5 text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M0,8 Q6,4 12,8 T24,8" />
                        <path d="M0,16 Q6,12 12,16 T24,16" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div 
            ref={panelRef}
            className="absolute top-[52px] right-4 w-80 bg-neutral-950/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-40 overflow-y-auto max-h-[calc(100vh-140px)] backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col scrollbar-none"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-neutral-950/40">
                <span className="text-xs font-semibold text-white/90 tracking-wide">Design Settings</span>
                <button onClick={onClose} aria-label="Close settings" className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
                    <X size={14} />
                </button>
            </div>

            {/* Tab Swapper */}
            <div className="flex border-b border-white/5 p-1 gap-1 bg-black/25">
                <button 
                    onClick={() => setActiveTab('layout')} 
                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'layout' 
                            ? 'text-white bg-white/5 border border-white/5 shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <Layout size={10} />
                    Layout
                </button>
                <button 
                    onClick={() => setActiveTab('style')} 
                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'style' 
                            ? 'text-white bg-white/5 border border-white/5 shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <Palette size={10} />
                    Style
                </button>
                <button 
                    onClick={() => setActiveTab('pattern')} 
                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        activeTab === 'pattern' 
                            ? 'text-white bg-white/5 border border-white/5 shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <Grid size={10} />
                    Pattern
                </button>
            </div>

            {/* Content Area */}
            <div className="p-4 flex-1">
                {/* 1. Layout Tab */}
                {activeTab === 'layout' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Templates */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Template</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {TEMPLATES.map(t => {
                                    const IconComponent = t.icon;
                                    const isActive = selectedTemplate === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setTemplate(t.id as any)}
                                            className={`p-2.5 rounded-lg border text-left flex flex-col gap-1.5 transition-all ${
                                                isActive
                                                    ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                                                    : 'border-white/5 bg-black/25 hover:border-white/15 hover:bg-black/45'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className={`p-1 rounded-md ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-neutral-400'}`}>
                                                    <IconComponent size={13} />
                                                </div>
                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-white leading-tight">{t.name}</div>
                                                <div className="text-[9px] text-neutral-400 leading-snug mt-0.5">{t.desc}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Format */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Size / Ratio</label>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-0.5 flex gap-0.5">
                                {([['portrait', '4:5 Portrait'], ['square', '1:1 Square']] as const).map(([id, label]) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setFormat(id)}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center transition-all ${
                                            selectedFormat === id
                                                ? 'bg-neutral-800 text-white border border-white/5 shadow-sm'
                                                : 'text-neutral-400 hover:text-white'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Style Tab */}
                {activeTab === 'style' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Theme Palette</label>
                            <ThemeSelector onOpenBrandEditor={onOpenBrandEditor} />
                        </div>
                    </div>
                )}

                {/* 3. Pattern Tab */}
                {activeTab === 'pattern' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Visual Patterns grid */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Background Pattern</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(id => {
                                    const isActive = selectedPattern === id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setPattern(id)}
                                            title={getPatternName(id)}
                                            className={`h-10 rounded-lg border flex items-center justify-center transition-all group ${
                                                isActive
                                                    ? 'border-blue-500/80 bg-blue-500/10 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.1)]'
                                                    : 'border-white/5 bg-black/25 text-neutral-500 hover:border-white/15 hover:bg-black/45'
                                            }`}
                                        >
                                            {renderPatternPreview(id)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sliders Container */}
                        <div className="space-y-3.5 p-2.5 rounded-lg border border-white/5 bg-black/15">
                            {/* Opacity */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold text-neutral-400">Opacity</span>
                                    <span className="text-[9px] text-neutral-400 font-mono">{Math.round(patternOpacity * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="0.5" step="0.05" value={patternOpacity}
                                    onChange={e => setPatternOpacity(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            {/* Scale */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold text-neutral-400">Scale</span>
                                    <span className="text-[9px] text-neutral-400 font-mono">{patternScale.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range" min="0.5" max="2" step="0.1" value={patternScale}
                                    onChange={e => setPatternScale(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            {/* Spacing */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold text-neutral-400">Spacing</span>
                                    <span className="text-[9px] text-neutral-400 font-mono">{patternSpacing.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range" min="0.5" max="4" step="0.1" value={patternSpacing}
                                    onChange={e => setPatternSpacing(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>

                        {/* Signature Placement */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Signature Position</label>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-0.5 flex gap-0.5">
                                {([['bottom-left', 'Bottom L'], ['top-left', 'Top L'], ['top-right', 'Top R']] as const).map(([id, label]) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSignaturePosition(id)}
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold text-center transition-all ${
                                            signaturePosition === id
                                                ? 'bg-neutral-800 text-white border border-white/5 shadow-sm'
                                                : 'text-neutral-400 hover:text-white'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
