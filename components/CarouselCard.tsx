/**
 * Carousel Card Component
 * 
 * A studio-style card for displaying carousel thumbnails with badges and hover actions.
 * Features:
 * - Elegant 3:4 aspect ratio
 * - Responsive thumbnail rendering with proper aspect ratio preservation
 * - Absolute positioned badges for Public/Private and Format
 * - Glassmorphic hover overlay with action buttons
 * 
 * Location: src/components/CarouselCard.tsx
 */

import React, { useState } from 'react';
import { Carousel } from '../services/carouselService';
import { injectContentIntoSvg } from '../utils/svgInjector';
import { dbToAppTemplate } from '../utils/templateConverter';
import {
    Edit,
    Share2,
    Trash2,
    Copy,
    Eye,
    EyeOff,
    MoreVertical,
    Calendar,
    Lock,
    Globe,
    Square as SquareIcon,
    Smartphone,
} from 'lucide-react';

interface CarouselCardProps {
    carousel: Carousel;
    onEdit: (carousel: Carousel) => void;
    onShare: (carousel: Carousel) => void;
    onDuplicate: (carouselId: string) => void;
    onTogglePublic: (carousel: Carousel) => void;
    onDelete: (carouselId: string) => void;
}

export const CarouselCard: React.FC<CarouselCardProps> = ({
    carousel,
    onEdit,
    onShare,
    onDuplicate,
    onTogglePublic,
    onDelete,
}) => {
    const [actionMenuOpen, setActionMenuOpen] = useState(false);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Generate thumbnail SVG using the same approach as CarouselPreview
    const thumbnailSvg = carousel.slides && carousel.slides.length > 0
        ? injectContentIntoSvg(
            dbToAppTemplate(carousel.templateType),
            carousel.slides[0] as any,
            carousel.theme,
            carousel.branding,
            carousel.format,
            carousel.selectedPattern,
            carousel.patternOpacity
        )
        : null;

    return (
        <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all group relative">
            {/* Thumbnail Container */}
            <div className="aspect-[3/4] bg-gradient-to-br from-neutral-800 to-neutral-900 relative overflow-hidden">
                {/* Thumbnail SVG */}
                {thumbnailSvg ? (
                    <div className="w-full h-full flex items-center justify-center" style={{ overflow: 'hidden' }}>
                        <style>
                            {`
                .svg-preview-container svg {
                  max-width: 100%;
                  max-height: 100%;
                  width: auto;
                  height: auto;
                }
              `}
                        </style>
                        <div
                            className="svg-preview-container w-full h-full flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
                        />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <SquareIcon className="w-12 h-12 text-neutral-700" />
                    </div>
                )}

                {/* Badges - Top Right */}
                <div className="absolute top-3 right-3 flex gap-2">
                    {carousel.isPublic ? (
                        <div className="px-2 py-1 bg-green-500/20 border border-green-500/50 rounded-md text-xs text-green-400 flex items-center gap-1 backdrop-blur-sm">
                            <Globe size={12} />
                            <span>Public</span>
                        </div>
                    ) : (
                        <div className="px-2 py-1 bg-neutral-800/80 border border-white/20 rounded-md text-xs text-neutral-300 flex items-center gap-1 backdrop-blur-sm">
                            <Lock size={12} />
                            <span>Private</span>
                        </div>
                    )}
                </div>

                {/* Badge - Bottom Left (Format) */}
                <div className="absolute bottom-3 left-3">
                    <div className="px-2 py-1 bg-black/50 border border-white/20 rounded-md text-xs text-white flex items-center gap-1 backdrop-blur-sm">
                        {carousel.format === 'square' ? (
                            <>
                                <SquareIcon size={12} />
                                <span>Square</span>
                            </>
                        ) : (
                            <>
                                <Smartphone size={12} />
                                <span>Portrait</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Views Counter - Bottom Right (if views > 0) */}
                {(carousel as any).views > 0 && (
                    <div className="absolute bottom-3 right-3">
                        <div className="px-2 py-1 bg-black/50 border border-white/20 rounded-md text-xs text-white flex items-center gap-1 backdrop-blur-sm">
                            <Eye size={12} />
                            <span>{(carousel as any).views}</span>
                        </div>
                    </div>
                )}

                {/* Glassmorphic Hover Overlay with Actions */}
                <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <div className="bg-black/50 backdrop-blur-md border-t border-white/10 p-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => onEdit(carousel)}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Edit size={14} />
                                Edit
                            </button>
                            <button
                                onClick={() => onShare(carousel)}
                                className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                                title="Share"
                            >
                                <Share2 size={16} />
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setActionMenuOpen(!actionMenuOpen)}
                                    className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                                >
                                    <MoreVertical size={16} />
                                </button>

                                {/* Action Menu */}
                                {actionMenuOpen && (
                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-10">
                                        <button
                                            onClick={() => {
                                                onDuplicate(carousel.$id);
                                                setActionMenuOpen(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                                        >
                                            <Copy size={14} />
                                            Duplicate
                                        </button>
                                        <button
                                            onClick={() => {
                                                onTogglePublic(carousel);
                                                setActionMenuOpen(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                                        >
                                            {carousel.isPublic ? <EyeOff size={14} /> : <Eye size={14} />}
                                            Make {carousel.isPublic ? 'Private' : 'Public'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                onDelete(carousel.$id);
                                                setActionMenuOpen(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-white/10"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4">
                <h3 className="font-bold text-white mb-1 truncate">{carousel.title}</h3>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar size={12} />
                    <span>{formatDate(carousel.$createdAt)}</span>
                </div>
            </div>
        </div>
    );
};

export default CarouselCard;
