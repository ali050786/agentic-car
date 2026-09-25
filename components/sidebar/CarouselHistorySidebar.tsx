/**
 * Carousel History Sidebar - collapsible left rail listing the user's carousels,
 * grouped by recency, so switching between carousels never leaves /app.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    getUserCarousels,
    deleteCarousel,
    duplicateCarousel,
    updateCarouselTitle,
    Carousel,
} from '../../services/carouselService';
import { injectContentIntoSvg } from '../../utils/svgInjector';
import { resolveAppTemplate } from '../../utils/templateConverter';
import { useCarouselStore } from '../../store/useCarouselStore';
import type { SaveStatus } from '../../hooks/useAutoSave';
import { subscribeToUserJobs, markJobSeen, GenerationJob } from '../../services/jobService';
import { Search, Plus, MoreHorizontal, Pencil, Copy, Share2, Trash2, PanelLeftClose, PanelLeftOpen, X, Library } from 'lucide-react';
import { scopeSvg } from '../studio/scopeSvg';
import { EASE, IconButton, Kbd, MenuItem, Popover, SPRING, Spinner } from '../studio/ui';

interface CarouselHistorySidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    userId: string | null;
    saveStatus: SaveStatus;
    onSelectCarousel: (carousel: Carousel) => void;
    onNewCarousel: () => void;
    onShare: (carousel: Carousel) => void;
    /** Mobile: render as a full-width, always-expanded panel. */
    fullWidth?: boolean;
}

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 60;

const BUCKET_ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'];

const bucketLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'Previous 7 days';
    if (diffDays <= 30) return 'Previous 30 days';
    return 'Older';
};

const relativeTime = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** First slide of a saved carousel, scoped so each thumbnail keeps its own theme. */
const CarouselThumb: React.FC<{ carousel: Carousel; className?: string; running?: boolean; unseen?: boolean }> = ({ carousel, className = '', running, unseen }) => {
    const scope = `hthumb-${carousel.$id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const templateId = resolveAppTemplate(carousel.templateType, carousel.theme);
    const svg = useMemo(() => {
        const first = carousel.slides?.[0];
        if (!first) return '';
        try {
            return scopeSvg(injectContentIntoSvg(templateId, first as any, carousel.theme, undefined, 'portrait', undefined, undefined, undefined, undefined, scope, 1, carousel.slides?.length), scope);
        } catch { return ''; }
    }, [carousel.slides, carousel.theme, templateId, scope]);
    const thumbRef = useRef<HTMLDivElement | null>(null);
    return (
        <div className={`relative shrink-0 overflow-hidden rounded-[7px] bg-white/[0.04] ring-1 ring-white/10 ${className}`} style={{ aspectRatio: '1080 / 1384' }}>
            {svg ? (
                <div ref={thumbRef} className={`artifact-thumb absolute inset-0 pointer-events-none ${scope}`} dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
                <div className="absolute inset-0 st-skeleton" />
            )}
            {running && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[1px]">
                    <Spinner size={12} color="#9bd0ff" />
                </div>
            )}
            {unseen && (
                <span className="absolute top-0.5 right-0.5 flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-70" />
                    <span className="relative w-2 h-2 rounded-full bg-violet-400 ring-2 ring-[#0c0c14]" />
                </span>
            )}
        </div>
    );
};

export const CarouselHistorySidebar: React.FC<CarouselHistorySidebarProps> = ({
    isOpen: isOpenProp, onToggle, userId, saveStatus, onSelectCarousel, onNewCarousel, onShare, fullWidth,
}) => {
    const isOpen = fullWidth ? true : isOpenProp;
    const currentCarouselId = useCarouselStore(s => s.activeCarouselId);
    const activeJobId = useCarouselStore(s => s.activeJobId);
    const [carousels, setCarousels] = useState<Carousel[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);

    // Background job awareness: which carousels have a running/finished-unseen
    // job, plus brand-new carousels still being generated (no carousel doc yet).
    const [jobsByCarousel, setJobsByCarousel] = useState<Record<string, GenerationJob>>({});
    const [pendingJobs, setPendingJobs] = useState<Record<string, GenerationJob>>({});

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        const { data } = await getUserCarousels(userId);
        if (data) {
            setCarousels([...data].sort((a, b) => new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()));
        }
        setLoading(false);
    };

    // Loaded even while collapsed: the collapsed rail shows recent thumbnails.
    useEffect(() => {
        if (userId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => {
        // Refresh on save only while expanded (the collapsed rail tolerates a stale thumb).
        if (isOpen && saveStatus === 'saved') load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveStatus]);

    // Background job dots — independent of isOpen so the badges are already
    // correct the moment the rail is expanded, and independent of whichever
    // carousel is currently open in the editor (see hooks/useJobWatcher.ts).
    useEffect(() => {
        if (!userId) return;
        const unsubscribe = subscribeToUserJobs(userId, (job) => {
            if (job.type === 'create' && !job.carouselId) {
                setPendingJobs(prev => {
                    if (job.status === 'done' || job.status === 'error') {
                        const { [job.$id]: _drop, ...rest } = prev;
                        return rest;
                    }
                    return { ...prev, [job.$id]: job };
                });
                return;
            }

            const carouselId = job.carouselId;
            if (!carouselId) return;

            setPendingJobs(prev => {
                if (!(job.$id in prev)) return prev;
                const { [job.$id]: _drop, ...rest } = prev;
                return rest;
            });
            setJobsByCarousel(prev => ({ ...prev, [carouselId]: job }));

            if (job.status === 'done') load();
        });
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const handleSelectCarousel = (carousel: Carousel) => {
        const job = jobsByCarousel[carousel.$id];
        if (job && job.status === 'done' && !job.seen) {
            markJobSeen(job.$id).catch(() => {});
            setJobsByCarousel(prev => {
                const { [carousel.$id]: _drop, ...rest } = prev;
                return rest;
            });
        }
        onSelectCarousel(carousel);
    };

    const handleSelectPendingJob = (job: GenerationJob) => {
        const store = useCarouselStore.getState();
        store.clearChat();
        store.setActiveCarouselId(null);
        store.setActiveJobId(job.$id);
        store.setGenerating(true);
        store.setGenerationStatus(job.statusMessage);
        store.setGenerationProgress(job.progress);

        let label = 'New carousel';
        try { label = JSON.parse(job.payload)?.topic || label; } catch { /* ignore */ }
        store.setTopic(label);
        store.setSlides([]);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpenId(null);
                setConfirmDeleteId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = query
        ? carousels.filter(c => (c.title || '').toLowerCase().includes(query.toLowerCase()))
        : carousels;

    const groups = new Map<string, Carousel[]>();
    filtered.forEach(c => {
        const label = bucketLabel(c.$updatedAt);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(c);
    });

    const handleDelete = async (carousel: Carousel) => {
        const { error } = await deleteCarousel(carousel.$id);
        if (!error) {
            setCarousels(prev => prev.filter(c => c.$id !== carousel.$id));
            setMenuOpenId(null);
            setConfirmDeleteId(null);
            if (carousel.$id === currentCarouselId) onNewCarousel();
        }
    };

    const handleDuplicate = async (carousel: Carousel) => {
        if (!userId) return;
        const { data } = await duplicateCarousel(carousel.$id, userId);
        if (data) setCarousels(prev => [data, ...prev]);
        setMenuOpenId(null);
    };

    const startRename = (carousel: Carousel) => {
        setRenamingId(carousel.$id);
        setRenameValue(carousel.title || '');
        setMenuOpenId(null);
    };

    const commitRename = async (carousel: Carousel) => {
        const title = renameValue.trim();
        setRenamingId(null);
        if (!title || title === carousel.title) return;
        setCarousels(prev => prev.map(c => c.$id === carousel.$id ? { ...c, title } : c));
        await updateCarouselTitle(carousel.$id, title);
    };

    const pendingList = Object.values(pendingJobs);
    let itemIndex = 0;

    return (
        <motion.aside
            className={`${fullWidth ? 'flex w-full' : 'hidden md:flex'} h-full st-panel rounded-2xl flex-col shrink-0 overflow-hidden relative`}
            initial={false}
            animate={fullWidth ? undefined : { width: isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            aria-label="Carousel library"
        >
            <AnimatePresence mode="popLayout" initial={false}>
                {!isOpen ? (
                    /* ------------------------- collapsed rail ------------------------- */
                    <motion.div
                        key="rail"
                        className="flex flex-col items-center gap-2 py-2.5 w-[60px] h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.12 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    >
                        <IconButton tip="Library  ⌘B" tipPos="right" onClick={onToggle} className="w-10 h-10">
                            <PanelLeftOpen size={17} />
                        </IconButton>
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.06, rotate: 90 }}
                            whileTap={{ scale: 0.92 }}
                            transition={SPRING}
                            onClick={onNewCarousel}
                            data-tip="New carousel"
                            data-tip-pos="right"
                            aria-label="New carousel"
                            className="st-tip grid place-items-center w-10 h-10 rounded-xl bg-white text-black shadow-[0_8px_24px_-8px_rgba(155,107,255,0.7)]"
                        >
                            <Plus size={17} />
                        </motion.button>
                        <div className="w-6 h-px bg-white/10 my-1" />
                        <div className="flex flex-col items-center gap-2 overflow-y-auto lp-scrollbar-none pb-2">
                            {carousels.slice(0, 8).map((c, i) => (
                                <motion.button
                                    key={c.$id}
                                    type="button"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.15 + i * 0.04, ...SPRING }}
                                    whileHover={{ scale: 1.08, rotate: -3 }}
                                    onClick={() => handleSelectCarousel(c)}
                                    data-tip={c.title || 'Untitled carousel'}
                                    data-tip-pos="right"
                                    aria-label={`Open ${c.title || 'Untitled carousel'}`}
                                    className={`st-tip w-9 rounded-[8px] ${c.$id === currentCarouselId ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0c0c14]' : ''}`}
                                >
                                    <CarouselThumb carousel={c} className="w-9" running={['queued', 'running'].includes(jobsByCarousel[c.$id]?.status as string)} unseen={jobsByCarousel[c.$id]?.status === 'done' && !jobsByCarousel[c.$id]?.seen} />
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    /* --------------------------- expanded --------------------------- */
                    <motion.div
                        key="panel"
                        className={`${fullWidth ? 'w-full' : 'w-[272px]'} h-full flex flex-col`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: 0.08, duration: 0.3, ease: EASE } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    >
                        <div className="flex items-center justify-between pl-4 pr-2 pt-3 pb-2">
                            <div className="flex items-center gap-2">
                                <Library size={14} className="text-white/50" />
                                <span className="text-[13px] font-medium text-white">Library</span>
                                {carousels.length > 0 && (
                                    <motion.span key={carousels.length} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="lp-mono text-[10px] text-white/45 rounded-full bg-white/[0.06] px-1.5 py-0.5">
                                        {carousels.length}
                                    </motion.span>
                                )}
                            </div>
                            {!fullWidth && (
                                <IconButton tip="Collapse  ⌘B" onClick={onToggle}>
                                    <PanelLeftClose size={16} />
                                </IconButton>
                            )}
                        </div>

                        <div className="px-3 space-y-2.5">
                            <motion.button
                                type="button"
                                whileTap={{ scale: 0.97 }}
                                onClick={onNewCarousel}
                                className="group lp-conic w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-white/[0.04] text-[13px] font-medium text-white hover:bg-white/[0.07] transition-colors"
                            >
                                <motion.span className="grid place-items-center w-5 h-5 rounded-md bg-white text-black" whileHover={{ rotate: 90 }} transition={SPRING}>
                                    <Plus size={13} />
                                </motion.span>
                                New carousel
                            </motion.button>

                            <div className="relative group">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 group-focus-within:text-violet-300 transition-colors" />
                                <input
                                    ref={searchRef}
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search carousels"
                                    className="w-full h-9 pl-8 pr-8 rounded-xl bg-black/30 border border-white/[0.08] text-[12.5px] text-white placeholder-white/30 outline-none transition-[border-color,box-shadow] focus:border-violet-400/50 focus:shadow-[0_0_0_4px_rgba(155,107,255,0.12)]"
                                />
                                <AnimatePresence>
                                    {query && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                                            onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-5 h-5 rounded-full bg-white/10 text-white/70 hover:bg-white/20"
                                        >
                                            <X size={11} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto st-scroll px-2 pt-3 pb-2">
                            {/* Generating (brand-new carousels with no doc yet) */}
                            <AnimatePresence initial={false}>
                                {pendingList.length > 0 && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
                                        <div className="px-2 pb-1.5 lp-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/60">Generating</div>
                                        {pendingList.map(job => {
                                            let label = 'New carousel';
                                            try { label = JSON.parse(job.payload)?.topic || label; } catch { /* ignore */ }
                                            const isActive = job.$id === activeJobId;
                                            return (
                                                <motion.button
                                                    layout
                                                    key={job.$id}
                                                    type="button"
                                                    onClick={() => handleSelectPendingJob(job)}
                                                    className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors ${isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
                                                >
                                                    <div className="relative w-8 shrink-0 rounded-[7px] overflow-hidden st-skeleton ring-1 ring-white/10" style={{ aspectRatio: '1080 / 1384' }}>
                                                        <div className="absolute inset-0 grid place-items-center"><Spinner size={12} color="#9bd0ff" /></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[12.5px] text-white/90 truncate">{label}</div>
                                                        <div className="text-[11px] text-white/40 truncate">{job.statusMessage || 'Queued…'}</div>
                                                        <div className="mt-1.5 h-[3px] rounded-full bg-white/10 overflow-hidden">
                                                            <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400 st-sheen" animate={{ width: `${Math.max(6, job.progress || 0)}%` }} transition={{ duration: 0.6, ease: EASE }} />
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {loading && carousels.length === 0 && (
                                <div className="space-y-1.5 px-1">
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center gap-2.5 p-2">
                                            <div className="w-8 rounded-[7px] st-skeleton" style={{ aspectRatio: '1080 / 1384' }} />
                                            <div className="flex-1 space-y-1.5">
                                                <div className="h-2.5 rounded-full st-skeleton" style={{ width: `${80 - i * 12}%` }} />
                                                <div className="h-2 w-12 rounded-full st-skeleton" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!loading && filtered.length === 0 && pendingList.length === 0 && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-10 text-center">
                                    <div className="relative mx-auto mb-4 w-14 h-16">
                                        {[0, 1, 2].map(k => (
                                            <motion.span
                                                key={k}
                                                className="absolute inset-0 rounded-lg border border-white/15 bg-white/[0.03]"
                                                initial={{ rotate: 0 }}
                                                animate={{ rotate: (k - 1) * 10, x: (k - 1) * 6 }}
                                                transition={{ delay: 0.1 + k * 0.08, ...SPRING }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[12.5px] text-white/70">{query ? 'Nothing matches that search.' : !userId ? 'Sign in to keep a library.' : 'Your library is empty.'}</p>
                                    <p className="text-[11.5px] text-white/35 mt-1">{query ? 'Try a different word.' : 'Every carousel you make lands here.'}</p>
                                </motion.div>
                            )}

                            {BUCKET_ORDER.filter(b => groups.has(b)).map(bucket => (
                                <div key={bucket} className="mb-3">
                                    <div className="sticky top-0 z-10 px-2 py-1.5 lp-mono text-[10px] uppercase tracking-[0.16em] text-white/30 bg-gradient-to-b from-[#0e0e17] via-[#0e0e17]/90 to-transparent">{bucket}</div>
                                    {groups.get(bucket)!.map(carousel => {
                                        const isActive = carousel.$id === currentCarouselId;
                                        const job = jobsByCarousel[carousel.$id];
                                        const jobRunning = !!job && (job.status === 'queued' || job.status === 'running');
                                        const jobUnseenDone = !!job && job.status === 'done' && !job.seen;
                                        const menuOpen = menuOpenId === carousel.$id;
                                        const idx = itemIndex++;
                                        return (
                                            <motion.div
                                                key={carousel.$id}
                                                layout="position"
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: Math.min(idx, 12) * 0.03, duration: 0.35, ease: EASE }}
                                                className={`group relative flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer ${menuOpen ? 'z-30' : ''}`}
                                                onClick={() => renamingId !== carousel.$id && handleSelectCarousel(carousel)}
                                            >
                                                {isActive && (
                                                    <motion.span layoutId="hist-active" className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" transition={SPRING} />
                                                )}
                                                <span className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/[0.035] transition-colors" />
                                                <motion.div className="relative" whileHover={{ scale: 1.06, rotate: -2 }} transition={SPRING}>
                                                    <CarouselThumb carousel={carousel} className="w-8" running={jobRunning} unseen={jobUnseenDone} />
                                                </motion.div>
                                                <div className="relative min-w-0 flex-1">
                                                    {renamingId === carousel.$id ? (
                                                        <input
                                                            autoFocus
                                                            value={renameValue}
                                                            onClick={e => e.stopPropagation()}
                                                            onChange={e => setRenameValue(e.target.value)}
                                                            onBlur={() => commitRename(carousel)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                if (e.key === 'Escape') setRenamingId(null);
                                                            }}
                                                            className="w-full rounded-lg bg-black/40 border border-violet-400/50 px-2 py-1 text-[12.5px] text-white outline-none shadow-[0_0_0_4px_rgba(155,107,255,0.12)]"
                                                        />
                                                    ) : (
                                                        <>
                                                            <div className={`text-[12.5px] truncate ${isActive ? 'text-white font-medium' : 'text-white/75 group-hover:text-white'}`}>
                                                                {carousel.title || 'Untitled carousel'}
                                                            </div>
                                                            <div className="text-[11px] text-white/35 flex items-center gap-1.5">
                                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
                                                                {jobRunning ? 'Agents working…' : jobUnseenDone ? 'New changes ready' : isActive ? 'Editing now' : relativeTime(carousel.$updatedAt)}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="relative shrink-0" ref={menuOpen ? menuRef : undefined}>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); setMenuOpenId(menuOpen ? null : carousel.$id); }}
                                                        className={`grid place-items-center w-7 h-7 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all ${menuOpen ? 'opacity-100 bg-white/10 text-white' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                                                        aria-label="More options"
                                                        aria-expanded={menuOpen}
                                                    >
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                    <Popover open={menuOpen} className="absolute right-0 top-full mt-1 w-48 p-1 z-40">
                                                        <MenuItem i={0} icon={<Pencil size={12} />} label="Rename" onClick={e => { e.stopPropagation(); startRename(carousel); }} />
                                                        <MenuItem i={1} icon={<Copy size={12} />} label="Duplicate" onClick={e => { e.stopPropagation(); handleDuplicate(carousel); }} />
                                                        <MenuItem i={2} icon={<Share2 size={12} />} label="Share" onClick={e => { e.stopPropagation(); setMenuOpenId(null); onShare(carousel); }} />
                                                        <div className="h-px bg-white/[0.07] mx-2 my-1" />
                                                        <MenuItem
                                                            i={3}
                                                            danger
                                                            icon={<Trash2 size={12} />}
                                                            label={confirmDeleteId === carousel.$id ? 'Click again to delete' : 'Delete'}
                                                            hint={confirmDeleteId === carousel.$id ? 'This can’t be undone' : undefined}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                if (confirmDeleteId === carousel.$id) handleDelete(carousel);
                                                                else setConfirmDeleteId(carousel.$id);
                                                            }}
                                                        />
                                                    </Popover>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        <div className={`${fullWidth ? 'hidden' : 'flex'} px-4 py-2.5 border-t border-white/[0.06] items-center justify-between text-[11px] text-white/35`}>
                            <span>Toggle library</span>
                            <span className="flex gap-1"><Kbd>⌘</Kbd><Kbd>B</Kbd></span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.aside>
    );
};
