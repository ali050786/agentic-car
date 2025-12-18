import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout, Save, Download, Library as LibraryIcon, CheckCircle, Loader, AlertCircle, FileText, ChevronDown, Zap } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { useAuthStore } from '../store/useAuthStore';
import { FREE_TIER_LIMIT } from '../config/constants';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'limit-reached';

interface FloatingTopBarProps {
    slidesCount: number;
    hasUser: boolean;
    saveStatus: SaveStatus;
    onDownload: () => void;
    onDownloadPdf: () => void;
    isExportingPdf: boolean;
    onOpenApiKeyModal: () => void;
    onOpenAuthModal: () => void;
}

export const FloatingTopBar: React.FC<FloatingTopBarProps> = ({
    slidesCount,
    hasUser,
    saveStatus,
    onDownload,
    onDownloadPdf,
    isExportingPdf,
    onOpenApiKeyModal,
    onOpenAuthModal
}) => {
    const navigate = useNavigate();
    const { userApiKey, freeUsageCount } = useAuthStore();
    const [showLimitTooltip, setShowLimitTooltip] = useState(false);
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const downloadDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
                setShowDownloadDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const renderAutoSaveStatus = () => {
        if (!hasUser) {
            return (
                <div
                    onClick={onOpenAuthModal}
                    className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-white/10 rounded-lg text-neutral-400 text-sm cursor-pointer hover:bg-neutral-700 hover:text-white transition-colors"
                >
                    <AlertCircle size={16} />
                    Guest Mode (Unsaved)
                </div>
            );
        }

        if (slidesCount === 0) return null;

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
                        title="Storage Limit Reached"
                        aria-label="Storage Limit Reached"
                        onMouseLeave={() => setShowLimitTooltip(false)}
                    >
                        <AlertCircle size={16} />
                        Storage Full ({FREE_TIER_LIMIT}/{FREE_TIER_LIMIT})
                        {showLimitTooltip && (
                            <div className="absolute top-full mt-2 right-0 w-72 p-4 bg-neutral-800 border border-white/10 rounded-lg shadow-xl z-50">
                                <p className="text-sm text-white mb-2">
                                    You have reached the free limit of {FREE_TIER_LIMIT} carousels.
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

                {/* Free Tier Usage Slider (Header Version) */}
                {/* Free Tier Usage Slider (Header Version) */}
                {hasUser && !userApiKey && (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 border border-white/5 rounded-lg mr-1">
                        <Zap size={14} className="text-blue-400" />
                        <div className="flex flex-col w-20">
                            <span className="text-[10px] font-medium text-blue-300 leading-none mb-1">
                                Free: {freeUsageCount}/{FREE_TIER_LIMIT}
                            </span>
                            <div className="w-full bg-neutral-700 rounded-full h-1 overflow-hidden">
                                <div
                                    className="bg-blue-400 h-full rounded-full transition-all"
                                    style={{ width: `${Math.min((freeUsageCount / FREE_TIER_LIMIT) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Auto-Save Status Badge (Generator Mode) */}
                {renderAutoSaveStatus()}

                {/* Library Button */}
                <Link
                    to="/library"
                    title="My Carousels"
                    aria-label="My Carousels"
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                >
                    <LibraryIcon size={16} />
                    <span className="hidden sm:inline">My Carousels</span>
                </Link>

                {/* Download Dropdown Button */}
                {slidesCount > 0 && (
                    <div className="relative" ref={downloadDropdownRef}>
                        <button
                            onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                            title="Download Options"
                            aria-label="Download Options"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-500/50 rounded-lg text-sm font-medium text-white transition-colors"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">Download</span>
                            <ChevronDown size={14} className={`transition-transform ${showDownloadDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showDownloadDropdown && (
                            <div className="absolute top-full mt-2 right-0 w-56 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                                {/* Current Slide JPG Option */}
                                <button
                                    onClick={() => {
                                        onDownload();
                                        setShowDownloadDropdown(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-700 text-left text-sm text-white transition-colors"
                                >
                                    <Download size={16} className="text-blue-400" />
                                    <div>
                                        <div className="font-medium">Current Slide (JPG)</div>
                                        <div className="text-xs text-neutral-400">Download active slide as image</div>
                                    </div>
                                </button>

                                {/* Divider */}
                                <div className="border-t border-white/10" />

                                {/* All Slides PDF Option */}
                                {onDownloadPdf && (
                                    <button
                                        onClick={() => {
                                            onDownloadPdf();
                                            setShowDownloadDropdown(false);
                                        }}
                                        disabled={isExportingPdf}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-left text-sm text-white transition-colors"
                                    >
                                        {isExportingPdf ? (
                                            <Loader size={16} className="text-red-400 animate-spin" />
                                        ) : (
                                            <FileText size={16} className="text-red-400" />
                                        )}
                                        <div>
                                            <div className="font-medium">
                                                {isExportingPdf ? 'Exporting...' : 'All Slides (PDF)'}
                                            </div>
                                            <div className="text-xs text-neutral-400">
                                                {isExportingPdf ? 'Please wait...' : 'Download all slides as PDF'}
                                            </div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* User Menu or Sign Up Button */}
                {hasUser ? (
                    <UserMenu onOpenApiKeyModal={onOpenApiKeyModal} />
                ) : (
                    <button
                        onClick={onOpenAuthModal}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-900/20 transition-all"
                    >
                        Sign Up
                    </button>
                )}
            </div>
        </header>
    );
};
