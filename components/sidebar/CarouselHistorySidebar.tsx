/**
 * Carousel History Sidebar - collapsible left rail listing the user's carousels,
 * grouped by recency, so switching between carousels never leaves /app.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    getUserCarousels,
    deleteCarousel,
    duplicateCarousel,
    updateCarouselTitle,
    Carousel,
} from '../../services/carouselService';
import { injectContentIntoSvg } from '../../utils/svgInjector';
import { dbToAppTemplate } from '../../utils/templateConverter';
import type { SaveStatus } from '../../hooks/useAutoSave';
import { Search, Plus, MoreHorizontal, Pencil, Copy, Share2, Trash2, Layers, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface CarouselHistorySidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    userId: string | null;
    currentCarouselId: string | null;
    saveStatus: SaveStatus;
    onSelectCarousel: (carousel: Carousel) => void;
    onNewCarousel: () => void;
    onShare: (carousel: Carousel) => void;
}

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 52;

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

export const CarouselHistorySidebar: React.FC<CarouselHistorySidebarProps> = ({
    isOpen, onToggle, userId, currentCarouselId, saveStatus, onSelectCarousel, onNewCarousel, onShare,
}) => {
    const [carousels, setCarousels] = useState<Carousel[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef<HTMLDivElement | null>(null);

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        const { data } = await getUserCarousels(userId);
        if (data) {
            setCarousels([...data].sort((a, b) => new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime()));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen && userId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, userId]);

    useEffect(() => {
        if (isOpen && saveStatus === 'saved') load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveStatus]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
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
        if (!window.confirm(`Delete "${carousel.title || 'Untitled carousel'}"? This can't be undone.`)) return;
        const { error } = await deleteCarousel(carousel.$id);
        if (!error) {
            setCarousels(prev => prev.filter(c => c.$id !== carousel.$id));
            setMenuOpenId(null);
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

    if (!isOpen) {
        return (
            <div
                className="h-full border-r border-white/10 bg-neutral-950 flex flex-col items-center flex-shrink-0 overflow-hidden transition-all duration-200 ease-in-out pt-3"
                style={{ width: COLLAPSED_WIDTH }}
            >
                <button
                    onClick={onToggle}
                    title="Expand carousel history"
                    aria-label="Expand carousel history"
                    className="p-2 rounded-lg border border-white/15 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                    <PanelLeftOpen size={16} />
                </button>
            </div>
        );
    }

    return (
        <div
            className="h-full border-r border-white/10 bg-neutral-950 flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200 ease-in-out"
            style={{ width: EXPANDED_WIDTH }}
        >
            <div className="w-[260px] h-full flex flex-col flex-shrink-0">
                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                    <button
                        onClick={onNewCarousel}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-sm text-neutral-200 hover:bg-white/5 transition-colors"
                    >
                        <Plus size={14} /> New carousel
                    </button>
                    <button
                        onClick={onToggle}
                        title="Collapse carousel history"
                        aria-label="Collapse carousel history"
                        className="flex-shrink-0 p-2 rounded-lg border border-white/15 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <PanelLeftClose size={16} />
                    </button>
                </div>
                <div className="px-3 pt-3">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search carousels"
                            className="w-full pl-8 pr-2 py-1.5 bg-black/30 border border-white/10 rounded-md text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-3">
                    {loading && carousels.length === 0 && (
                        <div className="px-2 py-6 text-center text-xs text-neutral-500">Loading…</div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="px-2 py-6 text-center text-xs text-neutral-500">
                            {query ? 'No carousels match your search.' : 'No carousels yet. Start one above.'}
                        </div>
                    )}
                    {BUCKET_ORDER.filter(b => groups.has(b)).map(bucket => (
                        <div key={bucket} className="mb-2">
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500">{bucket}</div>
                            {groups.get(bucket)!.map(carousel => {
                                const isActive = carousel.$id === currentCarouselId;
                                const thumb = carousel.slides?.[0]
                                    ? injectContentIntoSvg(dbToAppTemplate(carousel.templateType), carousel.slides[0] as any, carousel.theme)
                                    : '';
                                return (
                                    <div
                                        key={carousel.$id}
                                        className={`group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer ${isActive ? 'bg-blue-500/15' : 'hover:bg-white/5'}`}
                                        onClick={() => renamingId !== carousel.$id && onSelectCarousel(carousel)}
                                    >
                                        <div className="w-6 h-6 rounded overflow-hidden bg-neutral-800 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                            {thumb ? (
                                                <div
                                                    className="w-full h-full pointer-events-none"
                                                    style={{ transform: 'scale(0.055)', transformOrigin: 'center' }}
                                                    dangerouslySetInnerHTML={{ __html: thumb }}
                                                />
                                            ) : (
                                                <Layers size={11} className="text-neutral-600" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
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
                                                    className="w-full bg-black/40 border border-blue-500/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                                />
                                            ) : (
                                                <>
                                                    <div className={`text-xs truncate ${isActive ? 'text-blue-300 font-medium' : 'text-neutral-200'}`}>
                                                        {carousel.title || 'Untitled carousel'}
                                                    </div>
                                                    <div className="text-[10px] text-neutral-500">
                                                        {isActive ? 'Editing now' : relativeTime(carousel.$updatedAt)}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="relative flex-shrink-0" ref={menuOpenId === carousel.$id ? menuRef : undefined}>
                                            <button
                                                onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === carousel.$id ? null : carousel.$id); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-opacity"
                                                aria-label="More options"
                                            >
                                                <MoreHorizontal size={13} />
                                            </button>
                                            {menuOpenId === carousel.$id && (
                                                <div className="absolute right-0 top-full mt-1 w-36 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-20">
                                                    <button onClick={e => { e.stopPropagation(); startRename(carousel); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">
                                                        <Pencil size={12} /> Rename
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); handleDuplicate(carousel); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">
                                                        <Copy size={12} /> Duplicate
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); setMenuOpenId(null); onShare(carousel); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">
                                                        <Share2 size={12} /> Share
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(carousel); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 border-t border-white/10">
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
