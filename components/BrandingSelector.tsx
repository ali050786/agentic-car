/**
 * Branding Selector Component
 * 
 * Allows users to control signature/branding display including:
 * - Enable/disable signature
 * - Signature position (bottom-left, top-left, top-right)
 * - Quick access to brand editor
 * 
 * Location: src/components/BrandingSelector.tsx
 */

import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { useAuthStore } from '../store/useAuthStore';
import { SignaturePosition } from '../types';
import { ArrowDownLeft, ArrowUpLeft, ArrowUpRight, Edit3 } from 'lucide-react';

interface BrandingSelectorProps {
    onOpenBrandEditor?: () => void;
}

export const BrandingSelector: React.FC<BrandingSelectorProps> = ({ onOpenBrandEditor }) => {
    const { signaturePosition, setSignaturePosition, brandKit } = useCarouselStore();
    const activeBrandKit = brandKit;

    const positions: { value: SignaturePosition; label: string; icon: typeof ArrowDownLeft }[] = [
        { value: 'bottom-left', label: 'Bottom Left', icon: ArrowDownLeft },
        { value: 'top-left', label: 'Top Left', icon: ArrowUpLeft },
        { value: 'top-right', label: 'Top Right', icon: ArrowUpRight },
    ];

    return (
        <div className="flex flex-col gap-4 w-full min-w-[280px]">
            {/* Brand Info Display */}
            {activeBrandKit?.enabled && (
                <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                    <div className="flex items-center gap-3">
                        {activeBrandKit.identity.imageUrl ? (
                            <img
                                src={activeBrandKit.identity.imageUrl}
                                alt={activeBrandKit.identity.name}
                                className="w-10 h-10 rounded-full object-cover border border-white/20"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                {activeBrandKit.identity.name.charAt(0).toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">
                                {activeBrandKit.identity.name || 'Your Brand'}
                            </div>
                            <div className="text-xs text-neutral-400 truncate">
                                {activeBrandKit.identity.title || 'Add a title'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Signature Position Selector */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-neutral-400">
                    Signature Position
                </label>

                <div className="grid grid-cols-1 gap-2">
                    {positions.map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            onClick={() => setSignaturePosition(value)}
                            className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${signaturePosition === value
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-white/10 bg-black/20 hover:border-white/30'
                                }`}
                        >
                            <Icon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="font-medium text-white text-sm flex-1">{label}</span>
                            {signaturePosition === value && (
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Edit Brand Button */}
            {onOpenBrandEditor && (
                <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                    <button
                        onClick={() => onOpenBrandEditor()}
                        className="px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Edit3 className="w-3 h-3" />
                        Edit Brand Identity
                    </button>
                </div>
            )}

            <p className="text-xs text-neutral-600 italic">
                Your signature appears on every slide
            </p>
        </div>
    );
};

export default BrandingSelector;
