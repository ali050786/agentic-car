import React from 'react';
import { useCarouselStore } from '../store/useCarouselStore';
import { Focus, Grid3x3 } from 'lucide-react';

export const ViewModeToggle: React.FC = () => {
    const { viewMode, setViewMode } = useCarouselStore();

    return (
        <div className="flex items-center gap-2 bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-lg p-1">
            <button
                onClick={() => setViewMode('focus')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'focus'
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                title="Focus View - 3D Carousel"
            >
                <Focus size={16} />
                <span>Focus View</span>
            </button>
            <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'grid'
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                title="Grid View"
            >
                <Grid3x3 size={16} />
                <span>Grid View</span>
            </button>
        </div>
    );
};
