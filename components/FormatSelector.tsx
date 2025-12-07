import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { Maximize2, Square } from 'lucide-react';

export const FormatSelector: React.FC = () => {
    const { selectedFormat, setFormat } = useCarouselStore();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Maximize2 size={14} className="text-neutral-400" />
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    Format
                </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Portrait Format */}
                <button
                    onClick={() => setFormat('portrait')}
                    className={`p-4 rounded-xl border text-left transition-all ${selectedFormat === 'portrait'
                            ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                            : 'border-white/10 hover:border-white/30 bg-black/20'
                        }`}
                >
                    <div className="flex flex-col items-center gap-2">
                        {/* Visual representation of portrait aspect ratio */}
                        <div className={`w-12 h-16 rounded border-2 transition-colors ${selectedFormat === 'portrait'
                                ? 'border-blue-500 bg-blue-500/20'
                                : 'border-white/30 bg-white/5'
                            }`} />
                        <div className="text-center">
                            <div className="font-bold text-white text-sm">Portrait</div>
                            <div className="text-xs text-neutral-400">1080×1380</div>
                        </div>
                        {selectedFormat === 'portrait' && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mt-1" />
                        )}
                    </div>
                </button>

                {/* Square Format */}
                <button
                    onClick={() => setFormat('square')}
                    className={`p-4 rounded-xl border text-left transition-all ${selectedFormat === 'square'
                            ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                            : 'border-white/10 hover:border-white/30 bg-black/20'
                        }`}
                >
                    <div className="flex flex-col items-center gap-2">
                        {/* Visual representation of square aspect ratio */}
                        <div className={`w-14 h-14 rounded border-2 transition-colors ${selectedFormat === 'square'
                                ? 'border-blue-500 bg-blue-500/20'
                                : 'border-white/30 bg-white/5'
                            }`} />
                        <div className="text-center">
                            <div className="font-bold text-white text-sm">Square</div>
                            <div className="text-xs text-neutral-400">1080×1080</div>
                        </div>
                        {selectedFormat === 'square' && (
                            <div className="w-2 h-2 rounded-full bg-500 animate-pulse mt-1" />
                        )}
                    </div>
                </button>
            </div>
        </div>
    );
};
