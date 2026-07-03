/**
 * Artifact Settings Panel - carousel-level look and feel in one place.
 *
 * Replaces the old floating bottom toolbar: template, color preset,
 * format, background pattern, and signature all live here now.
 */

import React from 'react';
import { useCarouselStore } from '../../store/useCarouselStore';
import { ThemeSelector } from '../ThemeSelector';
import { X, UserCircle } from 'lucide-react';

const TEMPLATES = [
    { id: 'template-1', name: 'The Truth', desc: 'Bold, industrial, high contrast' },
    { id: 'template-2', name: 'The Clarity', desc: 'Clean, tech-forward, gradients' },
    { id: 'template-3', name: 'The Sketch', desc: 'Hand-drawn, AI doodles' },
    { id: 'template-4', name: 'The Statement', desc: 'Bold typographic, geometric' },
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
        signaturePosition, setSignaturePosition,
    } = useCarouselStore();

    if (!isOpen) return null;

    return (
        <>
            <div className="absolute inset-0 bg-black/40 z-30" onClick={onClose} />
            <div className="absolute top-0 right-0 bottom-0 w-80 bg-neutral-900 border-l border-white/10 z-40 overflow-y-auto animate-in slide-in-from-right duration-200">
                <div className="sticky top-0 bg-neutral-900 flex items-center justify-between px-4 py-3 border-b border-white/10 z-10">
                    <span className="text-sm font-medium text-white">Carousel settings</span>
                    <button onClick={onClose} aria-label="Close settings" className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/10">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Template */}
                    <section>
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Template</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {TEMPLATES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTemplate(t.id as any)}
                                    className={`p-2.5 rounded-lg border text-left transition-all ${selectedTemplate === t.id
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-white/10 bg-black/20 hover:border-white/30'
                                        }`}
                                >
                                    <div className="text-sm text-white font-medium flex justify-between items-center">
                                        {t.name}
                                        {selectedTemplate === t.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                    </div>
                                    <div className="text-[11px] text-neutral-400">{t.desc}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Format */}
                    <section>
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Format</h3>
                        <div className="flex gap-2">
                            {([['portrait', '4:5 Portrait'], ['square', '1:1 Square']] as const).map(([id, label]) => (
                                <button
                                    key={id}
                                    onClick={() => setFormat(id)}
                                    className={`flex-1 py-2 rounded-lg border text-xs transition-all ${selectedFormat === id
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                                        : 'border-white/10 bg-black/20 text-neutral-400 hover:border-white/30'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Color */}
                    <section>
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Color preset</h3>
                        <ThemeSelector onOpenBrandEditor={onOpenBrandEditor} />
                    </section>

                    {/* Background pattern */}
                    <section>
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Background pattern</h3>
                        <div className="grid grid-cols-6 gap-1.5 mb-3">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(id => (
                                <button
                                    key={id}
                                    onClick={() => setPattern(id)}
                                    className={`h-9 rounded-md border text-[11px] transition-all ${selectedPattern === id
                                        ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                                        : 'border-white/10 bg-black/20 text-neutral-500 hover:border-white/30'
                                        }`}
                                >
                                    {id}
                                </button>
                            ))}
                        </div>
                        <label className="block text-[11px] text-neutral-500 mb-1">Opacity · {Math.round(patternOpacity * 100)}%</label>
                        <input
                            type="range" min="0" max="0.5" step="0.05" value={patternOpacity}
                            onChange={e => setPatternOpacity(parseFloat(e.target.value))}
                            className="w-full accent-blue-500 mb-2"
                        />
                        <label className="block text-[11px] text-neutral-500 mb-1">Scale · {patternScale.toFixed(1)}x</label>
                        <input
                            type="range" min="0.5" max="2" step="0.1" value={patternScale}
                            onChange={e => setPatternScale(parseFloat(e.target.value))}
                            className="w-full accent-blue-500"
                        />
                    </section>

                    {/* Signature */}
                    <section>
                        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Signature</h3>
                        <div className="flex gap-2 mb-3">
                            {([['bottom-left', 'Bottom left'], ['top-left', 'Top left'], ['top-right', 'Top right']] as const).map(([id, label]) => (
                                <button
                                    key={id}
                                    onClick={() => setSignaturePosition(id)}
                                    className={`flex-1 py-2 rounded-lg border text-[11px] transition-all ${signaturePosition === id
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                                        : 'border-white/10 bg-black/20 text-neutral-400 hover:border-white/30'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={onOpenBrandEditor}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/10 bg-black/20 text-xs text-neutral-300 hover:border-white/30 transition-colors"
                        >
                            <UserCircle size={14} /> Edit brand identity
                        </button>
                    </section>
                </div>
            </div>
        </>
    );
};
