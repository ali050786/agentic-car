import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout, Save, Download, Library as LibraryIcon, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { UserMenu } from './UserMenu';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'limit-reached';

interface FloatingTopBarProps {
    slidesCount: number;
    hasUser: boolean;
    saveStatus?: SaveStatus;  // Auto-save status
    onDownload: () => void;
}

export const FloatingTopBar: React.FC<FloatingTopBarProps> = ({
    slidesCount,
    hasUser,
    saveStatus = 'idle',
    onDownload,
}) => {
    const navigate = useNavigate();
    const [showLimitTooltip, setShowLimitTooltip] = useState(false);

    const renderAutoSaveStatus = () => {
        if (!hasUser || slidesCount === 0) return null;

        switch (saveStatus) {
            case 'saving':
                return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400 text-sm">
                        <Loader size={16} className="animate-spin" />
                        Auto-saving...
                    </div>
                );

            case 'saved':
                return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
                        <CheckCircle size={16} />
                        Auto-saved
                    </div>
                );

            case 'limit-reached':
                return (
                    <div
                        className="relative flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm cursor-pointer hover:bg-red-500/20 transition-colors"
                        onClick={() => setShowLimitTooltip(!showLimitTooltip)}
                        onMouseEnter={() => setShowLimitTooltip(true)}
                        onMouseLeave={() => setShowLimitTooltip(false)}
                    >
                        <AlertCircle size={16} />
                        Storage Full (5/5)
                        {showLimitTooltip && (
                            <div className="absolute top-full mt-2 right-0 w-72 p-4 bg-neutral-800 border border-white/10 rounded-lg shadow-xl z-50">
                                <p className="text-sm text-white mb-2">
                                    You have reached the free limit of 5 carousels.
                                </p>
                                <p className="text-xs text-neutral-400 mb-3">
                                    Please delete old carousels from your library to save new work.
                                </p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/library');
                                    }}
                                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors"
                                >
                                    Go to Library
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'error':
                return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/50 rounded-lg text-orange-400 text-sm">
                        <AlertCircle size={16} />
                        Save Failed
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-neutral-900/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
                    <Layout className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight text-white">Agentic Carousel</h1>
                    <p className="text-[10px] text-neutral-500 -mt-0.5 uppercase tracking-wider font-medium">
                        Generator
                    </p>
                </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3">

                {/* Auto-Save Status Badge (Generator Mode) */}
                {renderAutoSaveStatus()}

                {/* Library Button */}
                <Link
                    to="/library"
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                >
                    <LibraryIcon size={16} />
                    <span className="hidden sm:inline">My Carousels</span>
                </Link>

                {/* Download Button */}
                {slidesCount > 0 && (
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                )}

                <UserMenu />
            </div>
        </header>
    );
};
