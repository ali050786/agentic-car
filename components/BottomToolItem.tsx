import React from 'react';
import { LucideIcon } from 'lucide-react';

interface BottomToolItemProps {
    icon: LucideIcon;
    label: string;
    isExpanded: boolean;
    onClick: () => void;
    children?: React.ReactNode;
    disabled?: boolean;
    onDisabledClick?: () => void;
}

export const BottomToolItem: React.FC<BottomToolItemProps> = ({
    icon: Icon,
    label,
    isExpanded,
    onClick,
    children,
    disabled = false,
    onDisabledClick,
}) => {
    const handleClick = () => {
        if (disabled) {
            onDisabledClick?.();
        } else {
            onClick();
        }
    };

    return (
        <div className="relative">
            {/* Expanded Panel (appears above the icon) */}
            {!disabled && isExpanded && children && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[280px] bg-neutral-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
                    {/* Panel Content */}
                    {children}

                    {/* Arrow pointing down */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-neutral-900 border-r border-b border-white/20 rotate-45" />
                </div>
            )}

            {/* Tool Button */}
            <button
                onClick={handleClick}
                title={disabled ? "Not available for this template" : label}
                className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-lg transition-all ${disabled
                    ? 'opacity-60 cursor-not-allowed grayscale border border-white/10 text-white/40'
                    : isExpanded
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                <Icon size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
            </button>
        </div>
    );
};
