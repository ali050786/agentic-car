import React, { useEffect, useRef } from 'react';
import { Layout, Palette, Maximize2, Wallpaper, PenTool } from 'lucide-react';
import { BottomToolItem } from './BottomToolItem';
import { ThemeSelector } from './ThemeSelector';
import { FormatSelector } from './FormatSelector';
import { PatternSelector } from './PatternSelector';
import { BrandingSelector } from './BrandingSelector';

interface FloatingBottomBarProps {
    expandedTool: string | null;
    setExpandedTool: (tool: string | null) => void;
    selectedTemplate: string;
    setTemplate: (template: string) => void;
    onOpenBrandEditor?: () => void;
}

export const FloatingBottomBar: React.FC<FloatingBottomBarProps> = ({
    expandedTool,
    setExpandedTool,
    selectedTemplate,
    setTemplate,
    onOpenBrandEditor,
}) => {
    const bottomBarRef = useRef<HTMLDivElement>(null);

    const toggleTool = (toolName: string) => {
        setExpandedTool(expandedTool === toolName ? null : toolName);
    };

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bottomBarRef.current && !bottomBarRef.current.contains(event.target as Node)) {
                if (expandedTool !== null) {
                    setExpandedTool(null);
                }
            }
        };

        // Add event listener when a tool is expanded
        if (expandedTool !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [expandedTool, setExpandedTool]);

    return (
        <div
            ref={bottomBarRef}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl px-4 py-2 z-40"
        >
            <div className="flex items-center gap-2">
                {/* Template Tool */}
                <BottomToolItem
                    icon={Layout}
                    label="Template"
                    isExpanded={expandedTool === 'template'}
                    onClick={() => toggleTool('template')}
                >
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Select Template</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setTemplate('template-1')}
                                className={`p-3 rounded-lg border text-left transition-all ${selectedTemplate === 'template-1'
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-white/10 bg-black/20 hover:border-white/30'
                                    }`}
                            >
                                <div className="font-bold text-white text-sm mb-1 flex justify-between">
                                    The Truth
                                    {selectedTemplate === 'template-1' && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="text-xs text-neutral-400">Bold, industrial, high contrast</div>
                            </button>

                            <button
                                onClick={() => setTemplate('template-2')}
                                className={`p-3 rounded-lg border text-left transition-all ${selectedTemplate === 'template-2'
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-white/10 bg-black/20 hover:border-white/30'
                                    }`}
                            >
                                <div className="font-bold text-white text-sm mb-1 flex justify-between">
                                    The Clarity
                                    {selectedTemplate === 'template-2' && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="text-xs text-neutral-400">Clean, tech-forward, gradients</div>
                            </button>
                        </div>
                    </div>
                </BottomToolItem>

                {/* Color Tool */}
                <BottomToolItem
                    icon={Palette}
                    label="Color"
                    isExpanded={expandedTool === 'color'}
                    onClick={() => toggleTool('color')}
                >
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Color Preset</h3>
                        <ThemeSelector onOpenBrandEditor={onOpenBrandEditor} />
                    </div>
                </BottomToolItem>

                {/* Format Tool */}
                <BottomToolItem
                    icon={Maximize2}
                    label="Format"
                    isExpanded={expandedTool === 'format'}
                    onClick={() => toggleTool('format')}
                >
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Aspect Ratio</h3>
                        <FormatSelector />
                    </div>
                </BottomToolItem>

                {/* Background Tool */}
                <BottomToolItem
                    icon={Wallpaper}
                    label="Background"
                    isExpanded={expandedTool === 'pattern'}
                    onClick={() => toggleTool('pattern')}
                >
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Background Pattern</h3>
                        <PatternSelector />
                    </div>
                </BottomToolItem>

                {/* Signature Tool */}
                <BottomToolItem
                    icon={PenTool}
                    label="Signature"
                    isExpanded={expandedTool === 'signature'}
                    onClick={() => toggleTool('signature')}
                >
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Branding</h3>
                        <BrandingSelector onOpenBrandEditor={onOpenBrandEditor} />
                    </div>
                </BottomToolItem>
            </div>
        </div>
    );
};
