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
import { User, Palette, Grid } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloseButton, EASE, SPRING, Segmented } from '../studio/ui';

/** Sends a message through the chat composer (ChatPanel listens for this). */
export const sendToChat = (text: string) => window.dispatchEvent(new CustomEvent('studio:chat-send', { detail: { text } }));

interface ArtifactSettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenBrandEditor: () => void;
    /** The slide on stage. */
    stageIndex?: number;
}

export const ArtifactSettingsPanel: React.FC<ArtifactSettingsPanelProps> = ({ isOpen, onClose, onOpenBrandEditor }) => {
    const {
        selectedPattern, setPattern,
        patternOpacity, setPatternOpacity,
        patternScale, setPatternScale,
        patternSpacing, setPatternSpacing,
        signaturePosition, setSignaturePosition,
    } = useCarouselStore();

    const [activeTab, setActiveTab] = useState<'style' | 'pattern' | 'signature'>('style');
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
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="none">
                        <line x1="0" y1="24" x2="24" y2="0" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="-6" y1="18" x2="18" y2="-6" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="6" y1="30" x2="30" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            case 2: // Diagonal Lines (\)
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="none">
                        <line x1="0" y1="0" x2="24" y2="24" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="-6" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="18" y1="-6" x2="30" y2="6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            case 3: // Cross-hatch
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="none">
                        <line x1="0" y1="24" x2="24" y2="0" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="0" y1="0" x2="24" y2="24" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                );
            case 4: // Dots
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="6" cy="6" r="1.5" />
                        <circle cx="18" cy="6" r="1.5" />
                        <circle cx="6" cy="18" r="1.5" />
                        <circle cx="18" cy="18" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                    </svg>
                );
            case 5: // Squares
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="currentColor">
                        <rect x="5" y="5" width="4" height="4" rx="0.5" />
                        <rect x="15" y="5" width="4" height="4" rx="0.5" />
                        <rect x="5" y="15" width="4" height="4" rx="0.5" />
                        <rect x="15" y="15" width="4" height="4" rx="0.5" />
                    </svg>
                );
            case 6: // Plus Signs
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M12,4 L12,10 M9,7 L15,7" />
                        <path d="M12,14 L12,20 M9,17 L15,17" />
                    </svg>
                );
            case 7: // X Pattern
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M5,5 L11,11 M11,5 L5,11" />
                        <path d="M13,13 L19,19 M19,13 L13,19" />
                    </svg>
                );
            case 8: // Horizontal Stripes
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <line x1="0" y1="6" x2="24" y2="6" />
                        <line x1="0" y1="12" x2="24" y2="12" />
                        <line x1="0" y1="18" x2="24" y2="18" />
                    </svg>
                );
            case 9: // Vertical Stripes
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <line x1="6" y1="0" x2="6" y2="24" />
                        <line x1="12" y1="0" x2="12" y2="24" />
                        <line x1="18" y1="0" x2="18" y2="24" />
                    </svg>
                );
            case 10: // Triangles
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6,4 10,11 2,11" />
                        <polygon points="18,13 22,20 14,20" />
                    </svg>
                );
            case 11: // Hexagons
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2" fill="none">
                        <polygon points="12,2 18,5 18,12 12,15 6,12 6,5" />
                        <polygon points="12,13 18,16 18,22 12,25 6,22 6,16" />
                    </svg>
                );
            case 12: // Waves
                return (
                    <svg className="w-5 h-5 " viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
                        <path d="M0,8 Q6,4 12,8 T24,8" />
                        <path d="M0,16 Q6,12 12,16 T24,16" />
                    </svg>
                );
            default:
                return null;
        }
    };

    const TABS = [
        { id: 'style' as const, label: 'Palette', icon: Palette },
        { id: 'pattern' as const, label: 'Pattern', icon: Grid },
        { id: 'signature' as const, label: 'Signature', icon: User },
    ];

    const sliders = [
        { label: 'Opacity', min: 0, max: 0.5, step: 0.05, value: patternOpacity, set: setPatternOpacity, fmt: (v: number) => `${Math.round(v * 100)}%` },
        { label: 'Scale', min: 0.5, max: 2, step: 0.1, value: patternScale, set: setPatternScale, fmt: (v: number) => `${v.toFixed(1)}×` },
        { label: 'Spacing', min: 0.5, max: 4, step: 0.1, value: patternSpacing, set: setPatternSpacing, fmt: (v: number) => `${v.toFixed(1)}×` },
    ];

    return (
        <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.15 } }}
            transition={SPRING}
            style={{ transformOrigin: 'top right' }}
            className="absolute top-14 right-3 w-[340px] max-w-[calc(100%-24px)] st-popover rounded-[20px] z-40 overflow-hidden max-h-[calc(100%-72px)] flex flex-col"
            role="dialog"
            aria-label="Design settings"
        >
            <div className="flex items-center justify-between pl-4 pr-2 pt-2.5 pb-1">
                <span className="lp-display text-[15px] font-semibold text-white">Design</span>
                <CloseButton onClick={onClose} label="Close design settings" />
            </div>

            <div className="px-3 pb-2">
                <div className={`relative grid ${TABS.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-1 rounded-xl bg-black/35 border border-white/[0.06] p-1`}>
                    {TABS.map(t => {
                        const on = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id)}
                                className={`relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors ${on ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
                            >
                                {on && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-lg bg-white/[0.1] ring-1 ring-white/10" transition={SPRING} />}
                                <t.icon size={12} className="relative" />
                                <span className="relative">{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto st-scroll px-4 pb-4 pt-1">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.25, ease: EASE }}
                    >
                        {activeTab === 'style' && <ThemeSelector onOpenBrandEditor={onOpenBrandEditor} />}

                        {activeTab === 'pattern' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-6 gap-1.5">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((id, k) => {
                                        const isActive = selectedPattern === id;
                                        return (
                                            <motion.button
                                                key={id}
                                                type="button"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: k * 0.02, ...SPRING }}
                                                whileHover={{ y: -2 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => setPattern(id)}
                                                data-tip={getPatternName(id)}
                                                data-tip-pos="top"
                                                aria-label={getPatternName(id)}
                                                aria-pressed={isActive}
                                                className={`st-tip relative h-11 rounded-xl border grid place-items-center group transition-colors ${isActive ? 'border-violet-300/60 text-white' : 'border-white/[0.07] bg-black/25 text-white/50 hover:border-white/20 hover:text-white'}`}
                                            >
                                                {isActive && <motion.span layoutId="pattern-active" className="absolute inset-0 rounded-xl bg-violet-400/15 shadow-[0_0_20px_-4px_rgba(155,107,255,0.6)]" transition={SPRING} />}
                                                <span className="relative [&_svg]:text-current [&_svg]:opacity-90">{renderPatternPreview(id)}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
                                    {sliders.map(sl => (
                                        <div key={sl.label}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[11.5px] text-white/55">{sl.label}</span>
                                                <motion.span key={sl.fmt(sl.value)} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="lp-mono text-[11px] text-white tabular-nums">{sl.fmt(sl.value)}</motion.span>
                                            </div>
                                            <input
                                                type="range" min={sl.min} max={sl.max} step={sl.step} value={sl.value}
                                                onChange={e => sl.set(parseFloat(e.target.value))}
                                                aria-label={`Pattern ${sl.label.toLowerCase()}`}
                                                className="st-range"
                                                style={{ ['--fill' as string]: `${((sl.value - sl.min) / (sl.max - sl.min)) * 100}%` }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'signature' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {([['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left']] as const).map(([id, label]) => {
                                        const on = signaturePosition === id;
                                        return (
                                            <motion.button
                                                key={id}
                                                type="button"
                                                whileHover={{ y: -2 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setSignaturePosition(id)}
                                                aria-pressed={on}
                                                className={`relative rounded-xl border p-2.5 flex flex-col items-center gap-2 transition-colors ${on ? 'border-violet-300/60 text-white' : 'border-white/[0.07] bg-black/25 text-white/50 hover:text-white hover:border-white/20'}`}
                                            >
                                                {on && <motion.span layoutId="sig-card" className="absolute inset-0 rounded-xl bg-violet-400/15" transition={SPRING} />}
                                                <span className="relative block w-10 h-12 rounded-md border border-current/40 border-white/20">
                                                    <motion.span
                                                        layout
                                                        className="absolute w-4 h-1.5 rounded-full bg-current"
                                                        style={{ left: id.includes('right') ? 'auto' : 4, right: id.includes('right') ? 4 : 'auto', top: id.includes('top') ? 4 : 'auto', bottom: id.includes('bottom') ? 4 : 'auto' }}
                                                    />
                                                </span>
                                                <span className="relative text-[11px] font-medium">{label}</span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                                <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={onOpenBrandEditor}
                                    className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left hover:bg-white/[0.06] hover:border-white/20 transition-colors group"
                                >
                                    <span>
                                        <span className="block text-[12.5px] font-medium text-white">Edit name, title & photo</span>
                                        <span className="block text-[11px] text-white/40 mt-0.5">Applies to every carousel</span>
                                    </span>
                                    <User size={15} className="text-white/40 group-hover:text-white transition-colors" />
                                </motion.button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
