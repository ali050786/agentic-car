/**
 * Theme Selector — curated palettes or your custom brand kit.
 *
 * Location: src/components/ThemeSelector.tsx
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCarouselStore } from '../store/useCarouselStore';
import { PRESETS } from '../config/colorPresets';
import { PenTool, UserCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { SPRING } from './studio/ui';

interface ThemeSelectorProps {
    onOpenBrandEditor?: () => void;
}

const Swatch: React.FC<{ seeds: { primary: string; secondary: string; background: string; text: string }; size?: number }> = ({ seeds, size = 30 }) => (
    <span
        className="block rounded-full ring-1 ring-white/15 shadow-[inset_0_0_0_2px_rgba(0,0,0,0.25)]"
        style={{ width: size, height: size, background: `conic-gradient(from 200deg, ${seeds.primary} 0 30%, ${seeds.secondary} 0 50%, ${seeds.text} 0 62%, ${seeds.background} 0 100%)` }}
    />
);

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onOpenBrandEditor }) => {
    const { brandMode, setBrandMode, presetId, setPresetId, selectedTemplate, brandKit } = useCarouselStore();
    const [hovered, setHovered] = useState<string | null>(null);

    const isTemplate3 = selectedTemplate === 'template-3';
    const available = isTemplate3 ? PRESETS.filter(p => p.id.endsWith('-light')) : PRESETS;
    const dark = available.filter(p => !p.id.endsWith('-light'));
    const light = available.filter(p => p.id.endsWith('-light'));
    const current = PRESETS.find(p => p.id === presetId);
    const labelId = hovered || (brandMode === 'preset' ? presetId : null);
    const label = PRESETS.find(p => p.id === labelId);

    const renderGroup = (title: string, list: typeof PRESETS) => list.length > 0 && (
        <div>
            <div className="lp-mono text-[10px] uppercase tracking-[0.16em] text-white/35 mb-2">{title}</div>
            <div className="grid grid-cols-7 gap-1.5">
                {list.map((preset, k) => {
                    const isActive = brandMode === 'preset' && presetId === preset.id;
                    return (
                        <motion.button
                            key={preset.id}
                            type="button"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: k * 0.025, ...SPRING }}
                            whileHover={{ scale: 1.14, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onMouseEnter={() => setHovered(preset.id)}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered(preset.id)}
                            onBlur={() => setHovered(null)}
                            onClick={() => { setBrandMode('preset'); setPresetId(preset.id); }}
                            aria-label={preset.name}
                            aria-pressed={isActive}
                            className="relative grid place-items-center w-9 h-9 rounded-full"
                        >
                            {isActive && <motion.span layoutId="preset-ring" className="absolute inset-0 rounded-full ring-2 ring-white" transition={SPRING} />}
                            <Swatch seeds={preset.seeds} size={28} />
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Live label for the hovered / active palette */}
            <div className="h-10 flex items-center gap-3 rounded-xl bg-black/25 border border-white/[0.06] px-3">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={brandMode === 'custom' && !hovered ? 'custom' : (label?.id || 'none')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="flex items-center gap-2.5 min-w-0">
                        {brandMode === 'custom' && !hovered ? (
                            <>
                                <Sparkles size={14} className="text-violet-300" />
                                <span className="text-[12.5px] text-white">Custom brand kit</span>
                            </>
                        ) : label ? (
                            <>
                                <Swatch seeds={label.seeds} size={18} />
                                <span className="text-[12.5px] text-white">{label.name}</span>
                                <span className="text-[11px] text-white/35 truncate">{label.description?.split(' - ')[1]}</span>
                            </>
                        ) : (
                            <span className="text-[12px] text-white/40">Pick a palette</span>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {renderGroup('Dark', dark)}
            {renderGroup('Light', light)}

            {/* Custom brand kit */}
            <AnimatePresence mode="wait" initial={false}>
                {brandMode === 'preset' ? (
                    <motion.button
                        key="apply"
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setBrandMode('custom')}
                        className="group w-full flex items-center gap-3 rounded-xl border border-dashed border-white/15 hover:border-violet-300/50 hover:bg-violet-400/[0.05] px-3.5 py-3 text-left transition-colors"
                    >
                        <span className="flex -space-x-1.5">
                            {[brandKit.colors.primary, brandKit.colors.secondary, brandKit.colors.background].map((c, i) => (
                                <span key={i} className="w-4 h-4 rounded-full ring-2 ring-[#12121c] transition-transform duration-300 group-hover:translate-x-0.5" style={{ background: c, transitionDelay: `${i * 40}ms` }} />
                            ))}
                        </span>
                        <span className="flex-1">
                            <span className="block text-[12.5px] font-medium text-white">Use my brand kit</span>
                            <span className="block text-[11px] text-white/40">Your colors instead of a preset{current ? ` (now: ${current.name})` : ''}</span>
                        </span>
                    </motion.button>
                ) : (
                    <motion.div key="custom" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-2">
                        <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-cyan-300/50 via-violet-400/50 to-rose-300/50">
                            <div className="rounded-[11px] bg-[#12121c] p-3 flex items-center gap-3">
                                {brandKit.identity.imageUrl ? (
                                    <img src={brandKit.identity.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/15 shrink-0" />
                                ) : (
                                    <span className="grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[12px] font-semibold text-white shrink-0">
                                        {brandKit.identity.name ? brandKit.identity.name.charAt(0).toUpperCase() : 'U'}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="text-[12.5px] font-medium text-white truncate">{brandKit.identity.name || 'Untitled brand'}</div>
                                    <div className="text-[11px] text-emerald-300/80">Custom kit active</div>
                                </div>
                                <span className="flex -space-x-1">
                                    {[brandKit.colors.primary, brandKit.colors.secondary, brandKit.colors.background, brandKit.colors.text].map((c, i) => (
                                        <span key={i} className="w-3 h-3 rounded-full ring-2 ring-[#12121c]" style={{ background: c }} />
                                    ))}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-[11.5px]">
                            <button type="button" onClick={() => setBrandMode('preset')} className="group flex items-center gap-1 text-white/50 hover:text-white transition-colors">
                                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" /> Back to presets
                            </button>
                            {onOpenBrandEditor && (
                                <button type="button" onClick={onOpenBrandEditor} className="flex items-center gap-1 text-violet-300 hover:text-violet-200 transition-colors">
                                    <UserCircle size={12} /> Edit kit
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isTemplate3 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
                            <PenTool size={13} className="text-rose-300 mt-0.5 shrink-0" />
                            <p className="text-[11px] leading-relaxed text-white/55">The Sketch uses light palettes only, so the pencil doodles stay crisp.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ThemeSelector;
