import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, FileText, CloudOff, UserRound } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { UserMenu } from './UserMenu';
import { useCarouselStore } from '../store/useCarouselStore';
import { LogoMark } from './landing/primitives';
import { DrawCheck, EASE, MenuItem, PHASE_COLOR, Popover, SPRING, Spinner, phaseLabel, phaseOf } from './studio/ui';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FloatingTopBarProps {
    slidesCount: number;
    hasUser: boolean;
    saveStatus: SaveStatus;
    onDownload: () => void;
    onDownloadPdf: () => void;
    isExportingPdf: boolean;
    onOpenAuthModal: () => void;
}

/** Morphing save-state pill: saving → saved (check draws itself) → error. */
const SaveBadge: React.FC<{ status: SaveStatus; hasUser: boolean; slidesCount: number; onOpenAuthModal: () => void }> = ({ status, hasUser, slidesCount, onOpenAuthModal }) => {
    let key = 'none';
    let node: React.ReactNode = null;
    if (!hasUser) {
        key = 'guest';
        node = (
            <button onClick={onOpenAuthModal} className="group flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300/20 bg-amber-300/[0.06] pl-2 pr-2.5 h-7 text-[11.5px] text-amber-100/85 hover:bg-amber-300/[0.12] transition-colors">
                <CloudOff size={12} className="text-amber-300" />
                <span className="hidden sm:inline">Not saved · </span>
                <span className="underline decoration-amber-300/40 underline-offset-2 group-hover:decoration-amber-300"><span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Sign in to keep it</span></span>
            </button>
        );
    } else if (slidesCount > 0 && status === 'saving') {
        key = 'saving';
        node = (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 h-7 text-[11.5px] text-white/60">
                <Spinner size={11} /> Saving
            </span>
        );
    } else if (slidesCount > 0 && status === 'saved') {
        key = 'saved';
        node = (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-2.5 h-7 text-[11.5px] text-emerald-200/90">
                <DrawCheck size={12} color="#6ee7b7" /> Saved
            </span>
        );
    } else if (slidesCount > 0 && status === 'error') {
        key = 'error';
        node = (
            <motion.span animate={{ x: [0, -3, 3, -2, 2, 0] }} transition={{ duration: 0.4 }} className="flex items-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-400/[0.08] px-2.5 h-7 text-[11.5px] text-rose-200">
                <CloudOff size={12} /> Save failed
            </motion.span>
        );
    }
    return (
        <AnimatePresence mode="popLayout" initial={false}>
            {node && (
                <motion.div key={key} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.9 }} transition={SPRING}>
                    {node}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

/** Center-of-bar live agent status while a job runs. */
const RunStatus: React.FC = () => {
    const { isGenerating, generationStatus, generationProgress } = useCarouselStore(useShallow(s => ({
        isGenerating: s.isGenerating, generationStatus: s.generationStatus, generationProgress: s.generationProgress,
    })));
    const phase = phaseOf(generationStatus);
    const color = PHASE_COLOR[phase];
    return (
        <AnimatePresence>
            {isGenerating && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={SPRING}
                    className="hidden lg:flex items-center gap-2.5 rounded-full border border-white/10 bg-black/40 pl-2.5 pr-3 h-8 max-w-[440px]"
                    role="status"
                    aria-live="polite"
                >
                    <span className="relative flex w-2 h-2 shrink-0">
                        <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: color }} />
                        <span className="relative w-2 h-2 rounded-full" style={{ background: color }} />
                    </span>
                    <span className="lp-mono text-[10px] tracking-[0.16em] shrink-0" style={{ color }}>{phase}</span>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={generationStatus} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="lp-shimmer text-[12px] truncate">
                            {phaseLabel(generationStatus) || 'Working'}
                        </motion.span>
                    </AnimatePresence>
                    <span className="w-14 h-1 rounded-full bg-white/10 overflow-hidden shrink-0">
                        <motion.span className="block h-full rounded-full" style={{ background: color }} animate={{ width: `${Math.max(6, generationProgress || 0)}%` }} transition={{ duration: 0.6, ease: EASE }} />
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const FloatingTopBar: React.FC<FloatingTopBarProps> = ({
    slidesCount,
    hasUser,
    saveStatus,
    onDownload,
    onDownloadPdf,
    isExportingPdf,
    onOpenAuthModal
}) => {
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const downloadDropdownRef = useRef<HTMLDivElement>(null);
    const topic = useCarouselStore(s => s.topic);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
                setShowDownloadDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="fixed top-2 inset-x-2 h-12 z-50 st-panel rounded-2xl grid grid-cols-[1fr_auto_1fr] items-center px-2.5"
        >
            {/* Left: brand + breadcrumb */}
            <div className="flex items-center gap-2.5 min-w-0">
                <Link to="/" className="flex items-center gap-2 shrink-0 rounded-xl pl-1 pr-2 py-1 hover:bg-white/[0.05] transition-colors" aria-label="Back to home">
                    <LogoMark size={26} />
                    <span className="hidden sm:block lp-display text-[14px] font-semibold tracking-tight text-white">Agentic Carousel</span>
                </Link>
                <span className="hidden md:block text-white/15 text-lg font-light select-none">/</span>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={topic || 'new'}
                        initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="hidden md:block truncate text-[13px] text-white/60 min-w-0"
                        title={topic || undefined}
                    >
                        {topic || 'Untitled carousel'}
                    </motion.span>
                </AnimatePresence>
            </div>

            {/* Center: live run status */}
            <div className="flex justify-center"><RunStatus /></div>

            {/* Right: save state, export, account */}
            <div className="flex items-center justify-end gap-2">
                <SaveBadge status={saveStatus} hasUser={hasUser} slidesCount={slidesCount} onOpenAuthModal={onOpenAuthModal} />

                <AnimatePresence>
                    {slidesCount > 0 && (
                        <motion.div
                            className="relative"
                            ref={downloadDropdownRef}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={SPRING}
                        >
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                                aria-label="Export options"
                                aria-expanded={showDownloadDropdown}
                                className="lp-btn-primary h-8 pl-3 pr-2.5 text-[12.5px]"
                            >
                                {isExportingPdf ? <Spinner size={13} /> : <Download size={13} />}
                                <span className="hidden sm:inline">{isExportingPdf ? 'Exporting' : 'Export'}</span>
                                <motion.span animate={{ rotate: showDownloadDropdown ? 180 : 0 }} transition={SPRING}><ChevronDown size={13} /></motion.span>
                            </motion.button>

                            <Popover open={showDownloadDropdown} className="absolute top-full mt-2 right-0 w-64 p-1.5 z-50">
                                <div className="px-3 pt-2 pb-1.5 lp-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Export</div>
                                <MenuItem
                                    i={0}
                                    icon={<FileText size={14} className="text-rose-300" />}
                                    label={isExportingPdf ? 'Exporting PDF…' : 'Whole carousel · PDF'}
                                    hint="LinkedIn-ready document post"
                                    disabled={isExportingPdf}
                                    onClick={() => { onDownloadPdf(); setShowDownloadDropdown(false); }}
                                />
                                <MenuItem
                                    i={1}
                                    icon={<Download size={14} className="text-cyan-300" />}
                                    label="Current slide · JPG"
                                    hint="High-res image of the slide on stage"
                                    onClick={() => { onDownload(); setShowDownloadDropdown(false); }}
                                />
                            </Popover>
                        </motion.div>
                    )}
                </AnimatePresence>

                {hasUser ? (
                    <UserMenu />
                ) : (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={onOpenAuthModal}
                        className="hidden sm:flex items-center gap-1.5 whitespace-nowrap h-8 px-3 rounded-full border border-white/15 text-[12.5px] text-white/85 hover:bg-white/[0.07] hover:border-white/30 transition-colors"
                    >
                        <UserRound size={13} /> Sign up
                    </motion.button>
                )}
            </div>
        </motion.header>
    );
};
