/**
 * Collapsible Section Component
 * 
 * Reusable accordion-style container for sidebar sections.
 * Supports expand/collapse with smooth animations and icons.
 * 
 * Location: src/components/CollapsibleSection.tsx
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';

interface CollapsibleSectionProps {
    title: string;
    icon?: LucideIcon;
    emoji?: string;
    defaultExpanded?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    icon: Icon,
    emoji,
    defaultExpanded = false,
    children,
    className = '',
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className={`flex flex-col ${className}`}>
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full py-2 px-1 text-left hover:bg-white/5 rounded-lg transition-colors group"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
            >
                <div className="flex items-center gap-2">
                    {emoji && <span className="text-sm">{emoji}</span>}
                    {Icon && <Icon size={14} className="text-neutral-400 group-hover:text-neutral-300" />}
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest group-hover:text-neutral-300 transition-colors">
                        {title}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronDown size={16} className="text-neutral-500 group-hover:text-neutral-400 transition-colors" />
                ) : (
                    <ChevronRight size={16} className="text-neutral-500 group-hover:text-neutral-400 transition-colors" />
                )}
            </button>

            {/* Content - Collapsible */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                    }`}
            >
                {children}
            </div>
        </div>
    );
};

export default CollapsibleSection;
