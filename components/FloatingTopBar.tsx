import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Download, CheckCircle, Loader, AlertCircle, FileText, ChevronDown, Zap } from 'lucide-react';
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
    onOpenAuthModal: () => void;
    onOpenHistory: () => void;
}

export const FloatingTopBar: React.FC<FloatingTopBarProps> = ({
    slidesCount,
    hasUser,
    saveStatus,
    onDownload,
    onDownloadPdf,
    isExportingPdf,
    onOpenAuthModal,
    onOpenHistory
}) => {
    const { freeUsageCount } = useAuthStore();
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
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 border border-white/5 rounded-full text-neutral-400 text-xs cursor-pointer hover:bg-neutral-750 hover:text-white transition-all"
                >
                    <AlertCircle size={12} className="text-neutral-500" />
                    <span className="text-[10px] font-semibold">Guest Mode</span>
                </div>
            );
        }

        if (slidesCount === 0) return null;

        switch (saveStatus) {
            case 'saving':
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs">
                        <Loader size={12} className="animate-spin" />
                        <span className="text-[10px] font-semibold">Saving...</span>
                    </div>
                );

            case 'saved':
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs">
                        <CheckCircle size={12} className="text-green-500" />
                        <span className="text-[10px] font-semibold">Saved</span>
                    </div>
                );

            case 'limit-reached':
                return (
                    <div
                        className="relative flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs cursor-pointer hover:bg-red-500/20 transition-all"
                        onClick={() => setShowLimitTooltip(!showLimitTooltip)}
                        onMouseEnter={() => setShowLimitTooltip(true)}
                        onMouseLeave={() => setShowLimitTooltip(false)}
                    >
                        <AlertCircle size={12} />
                        <span className="text-[10px] font-semibold">Limit Reached</span>
                        {showLimitTooltip && (
                            <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-neutral-950 border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-50">
                                <p className="text-[11px] text-white mb-1">
                                    You have reached the free limit of {FREE_TIER_LIMIT} carousels.
                                </p>
                                <p className="text-[10px] text-neutral-400 mb-2.5">
                                    Delete old carousels to save new work.
                                </p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenHistory();
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] text-white font-semibold transition-colors"
                                >
                                    View your carousels
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'error':
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs">
                        <AlertCircle size={12} />
                        <span className="text-[10px] font-semibold">Save Failed</span>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-12 bg-neutral-950/80 border-b border-white/5 z-50 flex items-center justify-between px-6 backdrop-blur-xl">
            {/* Left: Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-all group">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-[8px] opacity-35 group-hover:opacity-50 transition-opacity" />
                    <div className="relative w-6.5 h-6.5 bg-neutral-900 border border-white/10 rounded-full flex items-center justify-center">
                        <Layout className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <h1 className="text-xs font-bold text-white tracking-tight">AgenticCar</h1>
                    <span className="text-[8px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">AI</span>
                </div>
            </Link>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5">
                {/* Free Tier Usage Slider (Header Version) */}
                {hasUser && (
                    <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-white/[0.02] border border-white/5 rounded-full">
                        <Zap size={11} className="text-blue-400" />
                        <div className="flex flex-col w-16">
                            <span className="text-[9px] font-semibold text-blue-300 leading-none mb-0.5">
                                Free: {freeUsageCount}/{FREE_TIER_LIMIT}
                            </span>
                            <div className="w-full bg-neutral-800 rounded-full h-1 overflow-hidden">
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

                {/* Download Dropdown Button */}
                {slidesCount > 0 && (
                    <div className="relative" ref={downloadDropdownRef}>
                        <button
                            onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                            title="Download Options"
                            aria-label="Download Options"
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 text-xs font-semibold text-black rounded-full transition-all shadow-sm"
                        >
                            <Download size={13} />
                            <span className="hidden sm:inline">Download</span>
                            <ChevronDown size={12} className={`transition-transform duration-200 ${showDownloadDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showDownloadDropdown && (
                            <div className="absolute top-full mt-2 right-0 w-52 bg-neutral-950/95 border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-50 overflow-hidden py-1 backdrop-blur-md">
                                {/* Current Slide JPG Option */}
                                <button
                                    onClick={() => {
                                        onDownload();
                                        setShowDownloadDropdown(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 text-left text-xs text-white transition-colors"
                                >
                                    <Download size={13} className="text-blue-400" />
                                    <div>
                                        <div className="font-bold">Current Slide (JPG)</div>
                                        <div className="text-[10px] text-neutral-400 mt-0.5">Download active slide as image</div>
                                    </div>
                                </button>

                                {/* Divider */}
                                <div className="border-t border-white/5" />

                                {/* All Slides PDF Option */}
                                {onDownloadPdf && (
                                    <button
                                        onClick={() => {
                                            onDownloadPdf();
                                            setShowDownloadDropdown(false);
                                        }}
                                        disabled={isExportingPdf}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-left text-xs text-white transition-colors"
                                    >
                                        {isExportingPdf ? (
                                            <Loader size={13} className="text-red-400 animate-spin" />
                                        ) : (
                                            <FileText size={13} className="text-red-400" />
                                        )}
                                        <div>
                                            <div className="font-bold">
                                                {isExportingPdf ? 'Exporting...' : 'All Slides (PDF)'}
                                            </div>
                                            <div className="text-[10px] text-neutral-400 mt-0.5">
                                                {isExportingPdf ? 'Please wait...' : 'Download all slides as PDF'}
                                            </div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {hasUser ? (
                    <UserMenu />
                ) : (
                    <button
                        onClick={onOpenAuthModal}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-full transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
                    >
                        Sign Up
                    </button>
                )}
            </div>
        </header>
    );
};
