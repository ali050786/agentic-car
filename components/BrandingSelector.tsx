import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';

export const BrandingSelector: React.FC = () => {
    const { branding, setBranding } = useCarouselStore();

    return (
        <div className="flex flex-col gap-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-lg">
                <span className="text-sm text-white">Show Signature</span>
                <button
                    onClick={() => setBranding({ enabled: !branding.enabled })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${branding.enabled ? 'bg-blue-500' : 'bg-neutral-700'
                        }`}
                >
                    <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${branding.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {branding.enabled && (
                <div className="space-y-3 pt-2">
                    {/* Name Input */}
                    <div>
                        <label className="text-xs text-neutral-400 block mb-1.5">Name</label>
                        <input
                            type="text"
                            value={branding.name}
                            onChange={(e) => setBranding({ name: e.target.value })}
                            placeholder="Your Name"
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Title Input */}
                    <div>
                        <label className="text-xs text-neutral-400 block mb-1.5">Title</label>
                        <input
                            type="text"
                            value={branding.title}
                            onChange={(e) => setBranding({ title: e.target.value })}
                            placeholder="Your Title"
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Image URL Input */}
                    <div>
                        <label className="text-xs text-neutral-400 block mb-1.5">Image URL</label>
                        <input
                            type="text"
                            value={branding.imageUrl}
                            onChange={(e) => setBranding({ imageUrl: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Position Selector */}
                    <div>
                        <label className="text-xs text-neutral-400 block mb-1.5">Position</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setBranding({ position: 'bottom-left' })}
                                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${branding.position === 'bottom-left'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-black/40 border border-white/10 text-neutral-400 hover:border-white/30'
                                    }`}
                            >
                                Bottom Left
                            </button>
                            <button
                                onClick={() => setBranding({ position: 'top-left' })}
                                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${branding.position === 'top-left'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-black/40 border border-white/10 text-neutral-400 hover:border-white/30'
                                    }`}
                            >
                                Top Left
                            </button>
                            <button
                                onClick={() => setBranding({ position: 'top-right' })}
                                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${branding.position === 'top-right'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-black/40 border border-white/10 text-neutral-400 hover:border-white/30'
                                    }`}
                            >
                                Top Right
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
