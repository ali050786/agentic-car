/**
 * Artifact Panel - the carousel is the hero.
 *
 * Minimal header (title, template/format pill -> settings, exports),
 * one large slide on stage, thumbnail strip below. Selecting a slide
 * scopes the chat ("editing slide N") and enables slide-level actions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCarouselStore } from '../../store/useCarouselStore';
import { useAuthStore } from '../../store/useAuthStore';
import { injectContentIntoSvg } from '../../utils/svgInjector';
import { serializeStageForFigma } from '../../utils/figmaExport';
import { exportSlideToJpg } from '../../utils/jpgExporter';
import { exportSlideToPdf } from '../../utils/pdfExporter';
import { exportCarouselToHtml } from '../../utils/htmlExporter';
import { ArtifactSettingsPanel } from './ArtifactSettingsPanel';
import { Copy, FileText, Image as ImageIcon, Edit3, Code2, Check, ChevronLeft, ChevronRight, SlidersHorizontal, PenTool, MousePointerClick, Sparkles } from 'lucide-react';
import { DrawCheck, EASE, IconButton, Kbd, PHASE_COLOR, SPRING, Segmented, Spinner, phaseLabel, phaseOf } from '../studio/ui';

/** "Before: rambling answers" → { key: 'Before', value: 'rambling answers' }. */
const splitKey = (text: string): { key: string; value: string } => {
    const t = (text || '').trim();
    const i = t.indexOf(':');
    if (i > 0 && i <= 48 && i < t.length - 1) return { key: t.slice(0, i).trim(), value: t.slice(i + 1).trim() };
    return { key: '', value: t };
};

const TEMPLATE_NAMES: Record<string, string> = {
    'template-1': 'The Truth',
    'template-3': 'The Sketch',
    'template-4': 'The Statement',
};

/** Text of an editable region as the user wrote it (not as CSS displays it, e.g. uppercased). */
const editedText = (el: HTMLElement): string => {
    const upper = typeof window !== 'undefined' && window.getComputedStyle(el).textTransform === 'uppercase';
    const raw = upper ? (el.textContent ?? '') : (el.innerText ?? el.textContent ?? '');
    return raw.replace(/\u00a0/g, ' ').trim();
};

const SIG_POSITIONS = [
    { id: 'top-left' as const, label: 'Top left' },
    { id: 'bottom-left' as const, label: 'Bottom left' },
    { id: 'top-right' as const, label: 'Top right' },
];

// Tiny glyph showing where the signature sits (dot in the matching corner).
const PositionIcon: React.FC<{ corner: 'top-left' | 'bottom-left' | 'top-right' }> = ({ corner }) => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
        <circle cx={corner.includes('right') ? 11 : 5} cy={corner.includes('top') ? 5 : 11} r="2" fill="currentColor" />
    </svg>
);

interface ArtifactPanelProps {
    onOpenBrandEditor: () => void;
    onShowToast?: (message: string, type?: 'success' | 'error') => void;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ onOpenBrandEditor, onShowToast }) => {
    // Shallow-compared selector: re-renders only when one of these fields
    // actually changes, not on every unrelated store update (e.g. chat
    // messages/generation status ticking during a turn) — those used to
    // trigger a full SVG re-templating of the stage + every thumbnail below.
    const {
        slides, theme, topic, selectedTemplate, selectedFormat, setFormat, selectedPattern,
        patternOpacity, patternScale, patternSpacing, brandKit, signaturePosition, setSignaturePosition,
        selectedSlideIndex, selectedSlideIndices, toggleSlideSelection, setSelectedSlideIndex, setSelectedSlideIndices,
        updateSlide, setBrandKit,
        isGenerating, generationStatus, generationProgress, pendingDoodleSlides, draftPreview,
    } = useCarouselStore(useShallow(s => ({
        slides: s.slides,
        theme: s.theme,
        topic: s.topic,
        selectedTemplate: s.selectedTemplate,
        selectedFormat: s.selectedFormat,
        setFormat: s.setFormat,
        selectedPattern: s.selectedPattern,
        patternOpacity: s.patternOpacity,
        patternScale: s.patternScale,
        patternSpacing: s.patternSpacing,
        brandKit: s.brandKit,
        signaturePosition: s.signaturePosition,
        setSignaturePosition: s.setSignaturePosition,
        selectedSlideIndex: s.selectedSlideIndex,
        selectedSlideIndices: s.selectedSlideIndices,
        toggleSlideSelection: s.toggleSlideSelection,
        setSelectedSlideIndex: s.setSelectedSlideIndex,
        setSelectedSlideIndices: s.setSelectedSlideIndices,
        updateSlide: s.updateSlide,
        setBrandKit: s.setBrandKit,
        isGenerating: s.isGenerating,
        generationStatus: s.generationStatus,
        generationProgress: s.generationProgress,
        pendingDoodleSlides: s.pendingDoodleSlides,
        draftPreview: s.draftPreview,
    })));
    const { globalBrandKit } = useAuthStore();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [doneAction, setDoneAction] = useState<string | null>(null);
    // What's on stage is decoupled from what's *selected*: arrows/keys browse
    // slides without scoping the chat; selecting a thumbnail does both.
    const [viewIndex, setViewIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    useEffect(() => {
        if (selectedSlideIndex !== null) setViewIndex(selectedSlideIndex);
    }, [selectedSlideIndex]);
    const stageRef = useRef<HTMLDivElement | null>(null);
    // On-canvas signature position picker, anchored to the signature card on hover.
    const [sigCtrl, setSigCtrl] = useState({ show: false, left: 0, top: 0, above: true });
    const sigHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentIndex = Math.min(Math.max(viewIndex, 0), Math.max(slides.length - 1, 0));
    const currentSlide = slides[currentIndex];

    // Thumbnail selection, desktop-standard:
    // - plain click  → select ONLY that slide (or clear it if it was the sole one)
    // - ⌘/Ctrl/Alt   → add/remove that slide from the multi-select set
    // - Shift        → select the contiguous range from the primary slide to here
    const handleThumbClick = (e: React.MouseEvent, i: number) => {
        setDirection(i >= currentIndex ? 1 : -1);
        setViewIndex(i);
        const additive = e.metaKey || e.ctrlKey || e.altKey;
        if (additive) {
            toggleSlideSelection(i);
        } else if (e.shiftKey && selectedSlideIndex !== null) {
            const start = Math.min(selectedSlideIndex, i);
            const end = Math.max(selectedSlideIndex, i);
            const range: number[] = [];
            for (let k = start; k <= end; k++) range.push(k);
            setSelectedSlideIndices(range);
        } else if (selectedSlideIndices.length === 1 && selectedSlideIndices[0] === i) {
            setSelectedSlideIndices([]); // clicking the sole selected slide again → whole carousel
        } else {
            setSelectedSlideIndex(i); // replace selection with just this slide
        }
    };

    // Object literal — memoized so it's a stable dependency for the SVG
    // useMemo calls below instead of invalidating them on every render.
    const effectiveBranding = useMemo(
        () => ({ enabled: true, ...brandKit.identity, position: signaturePosition }),
        [brandKit, signaturePosition]
    );

    // injectContentIntoSvg builds a full SVG markup string — real work, not
    // worth redoing on renders where none of these inputs changed.
    const stageSvg = useMemo(() => {
        if (!currentSlide) return '';
        return injectContentIntoSvg(selectedTemplate, currentSlide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, `stage-${currentIndex}`, currentIndex + 1, slides.length);
    }, [selectedTemplate, currentSlide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, currentIndex, slides.length]);

    const thumbSvgs = useMemo(
        () => slides.map((slide, i) => injectContentIntoSvg(selectedTemplate, slide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, `thumb-${i}`, i + 1, slides.length)),
        [slides, selectedTemplate, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing]
    );

    // ── Inline editing ────────────────────────────────────────────────────────
    // The HTML templates (T3/T4) render their text regions already tagged with
    // `data-edit-field` AND `contenteditable` (baked into the SVG markup), so the
    // text is editable the moment it paints — a post-render step can never leave
    // it "looks editable but isn't". This effect only layers behavior on top, via
    // delegation on the stable stage container: commit-on-leave + Enter/Escape.
    //
    // We DON'T write to the store per field — that would recompute the stage SVG
    // and steal the caret. We flush every changed field in one `updateSlide` only
    // when focus leaves the slide entirely (click-away / slide switch / unmount).
    // Latest slide state is read lazily via a ref so the listeners never rebind.
    const editCtxRef = useRef({ slides, currentIndex, brandKit });
    editCtxRef.current = { slides, currentIndex, brandKit };

    useEffect(() => {
        const root = stageRef.current;
        if (!root) return;

        // Only write back when the user actually typed in this slide. Without
        // this guard the cleanup flush (run on every stage re-render) re-read
        // rendered decorations as content, e.g. the quote block's "— " prefix,
        // and fed an update loop ("— — — author…").
        let dirty = false;
        const onInput = () => { dirty = true; };

        const flushAll = () => {
            if (!dirty) return;
            dirty = false;
            const { slides, currentIndex, brandKit } = editCtxRef.current;
            const slide = slides[currentIndex] as any;
            if (!slide) return;
            const patch: Record<string, any> = {};
            const slotsPatch: Record<string, any> = {};
            const identityPatch: Record<string, string> = {};
            const currentSlots = slide.slots || {};
            let listItems = (slide.slots?.listItems || slide.listItems) ? [...(slide.slots?.listItems || slide.listItems)] : undefined;
            let listChanged = false;

            // "Key: detail" texts (list items, split sides) shown as two editable
            // parts: collect both halves, then write the joined text back.
            const parts = new Map<string, { field: string; index: number | null; key?: string; value?: string }>();
            let extrasPatch: Record<string, string> | null = null;

            root.querySelectorAll<HTMLElement>('[data-edit-field]').forEach((el) => {
                const field = el.getAttribute('data-edit-field')!;
                let text = editedText(el);
                if (field === 'quoteAuthor') text = text.replace(/^[—–-]\s*/, '');
                const part = el.getAttribute('data-edit-part') as 'key' | 'value' | null;
                const idxAttr = el.getAttribute('data-edit-index');
                if (part) {
                    const k = `${field}#${idxAttr ?? ''}`;
                    const entry = parts.get(k) || { field, index: idxAttr !== null ? Number(idxAttr) : null };
                    entry[part] = text;
                    parts.set(k, entry);
                    return;
                }
                if (field.startsWith('x.')) {
                    const key = field.slice(2);
                    const cur = (currentSlots.extras || {})[key] ?? '';
                    if (cur !== text) {
                        extrasPatch = { ...(extrasPatch || currentSlots.extras || {}) };
                        if (text) extrasPatch[key] = text;
                        else delete extrasPatch[key];
                    }
                    return;
                }
                if (field === 'listItem') {
                    if (!listItems) return;
                    const idx = Number(idxAttr);
                    const cur = listItems[idx];
                    const curText = typeof cur === 'object' && cur !== null ? (cur.bullet || '') : String(cur ?? '');
                    if (text !== curText) {
                        listItems[idx] = (typeof cur === 'object' && cur !== null) ? { ...cur, bullet: text } : text;
                        listChanged = true;
                    }
                } else if (field === 'brandName') {
                    if ((brandKit.identity.name ?? '') !== text) identityPatch.name = text;
                } else if (field === 'brandTitle') {
                    if ((brandKit.identity.title ?? '') !== text) identityPatch.title = text;
                } else {
                    const existingVal = currentSlots[field] ?? slide[field] ?? '';
                    if (existingVal !== text) {
                        patch[field] = text;
                        slotsPatch[field] = text;
                    }
                }
            });

            const join = (key: string, value: string) => (key.trim() ? `${key.trim()}: ${value.trim()}` : value.trim());
            parts.forEach((e) => {
                if (e.field === 'listItem') {
                    if (!listItems || e.index === null || !(e.index in listItems)) return;
                    const cur = listItems[e.index];
                    if (typeof cur === 'object' && cur !== null) {
                        const next = { ...cur, bullet: e.key ?? cur.bullet, description: e.value ?? cur.description };
                        if (next.bullet !== cur.bullet || next.description !== cur.description) { listItems[e.index] = next; listChanged = true; }
                    } else {
                        const old = splitKey(String(cur ?? ''));
                        const next = join(e.key ?? old.key, e.value ?? old.value);
                        if (next !== String(cur ?? '')) { listItems[e.index] = next; listChanged = true; }
                    }
                } else {
                    const cur = String(currentSlots[e.field] ?? slide[e.field] ?? '');
                    const old = splitKey(cur);
                    const next = join(e.key ?? old.key, e.value ?? old.value);
                    if (next !== cur) { patch[e.field] = next; slotsPatch[e.field] = next; }
                }
            });
            if (extrasPatch) slotsPatch.extras = extrasPatch;
            if (listChanged) {
                patch.listItems = listItems;
                slotsPatch.listItems = listItems;
            }
            if (Object.keys(slotsPatch).length > 0) {
                patch.slots = { ...currentSlots, ...slotsPatch };
            }
            if (Object.keys(patch).length > 0) updateSlide(currentIndex, patch);
            if (Object.keys(identityPatch).length > 0) setBrandKit({ identity: identityPatch as any });
        };

        // Delegated on the stable stage container — contenteditable is already in
        // the markup, so we only add Enter/Escape handling here.
        const onKeyDown = (e: KeyboardEvent) => {
            const region = (e.target as HTMLElement | null)?.closest?.('[data-edit-field]') as HTMLElement | null;
            if (!region) return;
            if (e.key === 'Escape') { e.preventDefault(); region.blur(); }
            // Single-line fields commit on Enter; body keeps line breaks.
            if (e.key === 'Enter' && region.getAttribute('data-edit-field') !== 'body') {
                e.preventDefault(); region.blur();
            }
        };

        // Focus leaving the slide entirely = commit. Moving between fields inside
        // the slide keeps relatedTarget within root, so we skip (no re-render).
        const onFocusOut = (e: FocusEvent) => {
            const next = e.relatedTarget as Node | null;
            if (next && root.contains(next)) return;
            flushAll();
        };

        root.addEventListener('keydown', onKeyDown);
        root.addEventListener('focusout', onFocusOut);
        root.addEventListener('input', onInput);
        return () => {
            root.removeEventListener('keydown', onKeyDown);
            root.removeEventListener('focusout', onFocusOut);
            root.removeEventListener('input', onInput);
            flushAll(); // safety net for slide switch / unmount while focused
        };
        // Re-bind whenever the stage (re)renders so the listeners are guaranteed
        // to exist once content is present — cheap: just two delegated handlers.
    }, [stageSvg, updateSlide, setBrandKit]);

    // Show the signature position picker when the signature card is hovered.
    useEffect(() => {
        const root = stageRef.current;
        const wrapper = root?.parentElement;
        if (!root || !wrapper) return;
        const onOver = (e: Event) => {
            const sig = (e.target as HTMLElement)?.closest?.('[data-signature]');
            if (!sig) return;
            if (sigHideTimer.current) clearTimeout(sigHideTimer.current);
            const sr = sig.getBoundingClientRect();
            const wr = wrapper.getBoundingClientRect();
            const inBottomHalf = sr.top - wr.top > wr.height / 2;
            setSigCtrl({
                show: true,
                left: sr.left - wr.left + sr.width / 2,
                top: inBottomHalf ? sr.top - wr.top : sr.bottom - wr.top,
                above: inBottomHalf,
            });
        };
        const onOut = (e: Event) => {
            if ((e.target as HTMLElement)?.closest?.('[data-signature]')) {
                sigHideTimer.current = setTimeout(() => setSigCtrl((c) => ({ ...c, show: false })), 220);
            }
        };
        root.addEventListener('mouseover', onOver);
        root.addEventListener('mouseout', onOut);
        return () => {
            root.removeEventListener('mouseover', onOver);
            root.removeEventListener('mouseout', onOut);
            if (sigHideTimer.current) clearTimeout(sigHideTimer.current);
        };
    }, [stageSvg]);

    const withBusy = async (name: string, fn: () => Promise<void>) => {
        setBusyAction(name);
        try {
            await fn();
            setDoneAction(name);
            setTimeout(() => setDoneAction(d => (d === name ? null : d)), 1600);
        } catch (e) {
            console.error(`[Artifact] ${name} failed:`, e);
            onShowToast?.(`${name} failed. Try again.`, 'error');
        } finally {
            setBusyAction(null);
        }
    };

    const handleCopyFigma = () => withBusy('Figma copy', async () => {
        const liveSvg = stageRef.current?.querySelector('svg') as SVGSVGElement | null;
        if (!liveSvg) throw new Error('No rendered slide to export');
        const svg = await serializeStageForFigma(liveSvg);
        await navigator.clipboard.writeText(svg);
        onShowToast?.('Optimized SVG copied for Figma', 'success');
    });

    const handleJpg = () => withBusy('JPG export', async () => {
        if (stageRef.current) await exportSlideToJpg(stageRef.current, currentIndex, selectedFormat);
    });

    const handlePdf = () => withBusy('PDF export', async () => {
        if (stageRef.current) await exportSlideToPdf(stageRef.current, currentIndex, selectedFormat);
    });

    // Whole-deck HTML export — built from slide data (not the live stage), so it
    // captures every slide regardless of which one is currently on canvas.
    const handleHtml = () => withBusy('HTML export', async () => {
        await exportCarouselToHtml({
            templateId: selectedTemplate,
            slides,
            theme,
            branding: effectiveBranding,
            format: selectedFormat,
            pattern: selectedPattern,
            patternOpacity,
            patternScale,
            patternSpacing,
            title: topic,
        });
        onShowToast?.('Carousel exported as standalone HTML', 'success');
    });

    // ── Stage motion + keyboard browsing (presentation only) ─────────────────
    const [stageScope, animateStage] = useAnimate();
    const didMountStage = useRef(false);
    useEffect(() => {
        if (!stageScope.current) return;
        if (!didMountStage.current) { didMountStage.current = true; return; }
        animateStage(stageScope.current, { opacity: [0, 1], x: [direction * 26, 0], scale: [0.985, 1] }, { duration: 0.42, ease: [0.16, 1, 0.3, 1] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex]);

    const go = (delta: number) => {
        if (slides.length < 2) return;
        const next = (currentIndex + delta + slides.length) % slides.length;
        setDirection(delta);
        setViewIndex(next);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
            else if (e.key === 'Escape' && selectedSlideIndices.length > 0) setSelectedSlideIndices([]);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // Keep the current thumbnail in view as you browse.
    const stripRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${currentIndex}"]`);
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }, [currentIndex]);

    const glow = theme?.textHighlight || '#9b6bff';
    // A draft from a running create job is read-only until the final deck replaces it.
    const editable = selectedTemplate !== 'template-1' && !draftPreview;

    // Empty state: generation progress or a quiet canvas
    if (slides.length === 0) {
        return (
            <div className="st-panel rounded-2xl flex-1 h-full flex items-center justify-center relative overflow-hidden st-canvas">
                <AnimatePresence mode="wait">
                    {isGenerating ? (
                        <GeneratingStage key="gen" status={generationStatus} progress={generationProgress} />
                    ) : (
                        <IdleStage key="idle" />
                    )}
                </AnimatePresence>
            </div>
        );
    }

    const exportActions = [
        { name: 'Figma copy', tip: 'Copy SVG for Figma', icon: <Copy size={15} />, run: handleCopyFigma },
        { name: 'JPG export', tip: 'Slide as JPG', icon: <ImageIcon size={15} />, run: handleJpg },
        { name: 'PDF export', tip: 'Slide as PDF', icon: <FileText size={15} />, run: handlePdf },
        { name: 'HTML export', tip: 'Whole carousel as HTML', icon: <Code2 size={15} />, run: handleHtml },
    ];

    return (
        <div className="st-panel rounded-2xl flex-1 h-full flex flex-col relative min-w-0 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 pl-4 pr-2 h-12 border-b border-white/[0.06] shrink-0">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="text-[13px] font-medium text-white truncate">{topic || 'Untitled carousel'}</span>
                    <motion.button
                        key={selectedTemplate}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={SPRING}
                        onClick={() => setSettingsOpen(true)}
                        className="settings-trigger-btn hidden xl:flex items-center gap-1.5 rounded-full border border-white/10 pl-1.5 pr-2.5 py-0.5 text-[11px] text-white/55 hover:text-white hover:border-white/25 transition-colors shrink-0"
                    >
                        <span className="w-3 h-3 rounded-full" style={{ background: `conic-gradient(${glow} 0 50%, ${theme?.background || '#222'} 0 100%)` }} />
                        {TEMPLATE_NAMES[selectedTemplate] || 'Style'}
                    </motion.button>
                </div>

                <Segmented
                    id="format"
                    size="xs"
                    value={selectedFormat}
                    onChange={(v) => setFormat(v)}
                    options={[
                        { value: 'portrait', label: '4:5', title: 'Portrait (4:5)' },
                        { value: 'square', label: '1:1', title: 'Square (1:1)' },
                    ]}
                />

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    aria-expanded={settingsOpen}
                    disabled={draftPreview}
                    title={draftPreview ? 'Available when the carousel is finished' : undefined}
                    className={`settings-trigger-btn flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] transition-colors disabled:opacity-40 disabled:pointer-events-none ${settingsOpen ? 'bg-white text-black border-white' : 'border-white/12 text-white/75 hover:text-white hover:border-white/30'}`}
                >
                    <motion.span animate={{ rotate: settingsOpen ? 90 : 0 }} transition={SPRING} className="flex"><SlidersHorizontal size={13} /></motion.span>
                    <span className="hidden lg:inline">Design</span>
                </motion.button>

                <span className="w-px h-5 bg-white/10 mx-0.5" />

                <div className="flex items-center">
                    {exportActions.map(a => (
                        <IconButton key={a.name} tip={draftPreview ? 'Available when the carousel is finished' : a.tip} onClick={a.run} disabled={draftPreview || (!!busyAction && busyAction !== a.name)}>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={busyAction === a.name ? 'busy' : doneAction === a.name ? 'done' : 'idle'}
                                    initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={SPRING}
                                    className="flex"
                                >
                                    {busyAction === a.name ? <Spinner size={14} /> : doneAction === a.name ? <DrawCheck size={15} color="#6ee7b7" /> : a.icon}
                                </motion.span>
                            </AnimatePresence>
                        </IconButton>
                    ))}
                </div>
            </div>

            {/* Stage */}
            <motion.div
                className="group/stage flex-1 flex items-center justify-center p-6 md:p-8 min-h-0 relative st-canvas overflow-hidden touch-pan-y"
                data-stage-index={currentIndex}
                onPanEnd={(e, info) => {
                    // Swipe to browse on touch screens (mouse drags are left alone for text editing).
                    if ((e as PointerEvent).pointerType !== 'touch') return;
                    if (Math.abs(info.offset.x) > 50 && Math.abs(info.offset.x) > Math.abs(info.offset.y)) go(info.offset.x < 0 ? 1 : -1);
                }}
            >
                {/* Theme-tinted glow behind the slide */}
                <motion.div
                    className="absolute left-1/2 top-1/2 w-[70%] h-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] pointer-events-none"
                    animate={{ backgroundColor: glow, opacity: 0.22 }}
                    transition={{ duration: 0.8 }}
                />

                <div className="relative h-full flex items-center justify-center" style={{ aspectRatio: selectedFormat === 'square' ? '1 / 1' : '4 / 5', maxHeight: '100%' }}>
                    <div ref={stageScope} className="w-full h-full">
                        <div
                            ref={stageRef}
                            aria-busy={draftPreview || undefined}
                            className={`artifact-svg-fit w-full h-full flex items-center justify-center rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9),0_16px_32px_-16px_rgba(0,0,0,0.7)] ${draftPreview ? 'pointer-events-none select-none' : ''}`}
                            dangerouslySetInnerHTML={{ __html: stageSvg }}
                        />
                    </div>

                    {/* Draft from a running create job: what's still happening, and that it's not editable yet */}
                    <AnimatePresence>
                        {draftPreview && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={SPRING}
                                className="absolute top-2.5 inset-x-3 z-10 flex justify-center"
                                role="status"
                                title="This is a draft. Editing opens when the editor is done."
                            >
                              <div className="relative max-w-[min(100%,calc(100vw-64px))] min-w-0 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md border border-white/10 pl-2.5 pr-3 h-7 overflow-hidden">
                                <span className="relative flex w-1.5 h-1.5 shrink-0">
                                    <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-60" />
                                    <span className="relative w-1.5 h-1.5 rounded-full bg-violet-400" />
                                </span>
                                <span className="text-[11px] font-medium text-white shrink-0">Draft</span>
                                <span className="text-white/25 shrink-0">·</span>
                                <span className="lp-shimmer text-[11px] truncate min-w-0">{(generationStatus || 'Polishing').replace(/^(PLAN|EXECUTE|REFLECT):\s*/, '').replace(/\.\.\.$/, '…')}</span>
                                <motion.span
                                    className="absolute left-0 bottom-0 h-[2px] bg-violet-400/80"
                                    animate={{ width: `${Math.max(8, Math.min(100, generationProgress || 0))}%` }}
                                    transition={{ duration: 0.6 }}
                                />
                              </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {pendingDoodleSlides.includes(currentIndex) && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                                transition={SPRING}
                                className="absolute bottom-3 right-3 flex items-center gap-2 st-popover rounded-full pl-2.5 pr-3 py-1.5"
                            >
                                <motion.span animate={{ rotate: [0, -18, 12, 0], y: [0, -1, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} className="flex"><PenTool size={12} className="text-rose-300" /></motion.span>
                                <span className="lp-shimmer text-[11.5px]">Sketching the doodle…</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Slide counter */}
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+10px)] flex items-center gap-1 lp-mono text-[11px] text-white/45 tabular-nums">
                        <span className="relative inline-flex overflow-hidden h-[15px] w-[16px] justify-end">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span key={currentIndex} initial={{ y: direction >= 0 ? 14 : -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: direction >= 0 ? -14 : 14, opacity: 0 }} transition={SPRING} className="text-white">
                                    {String(currentIndex + 1).padStart(2, '0')}
                                </motion.span>
                            </AnimatePresence>
                        </span>
                        <span>/ {String(slides.length).padStart(2, '0')}</span>
                    </div>

                    {editable && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[10.5px] text-white/70 opacity-0 -translate-y-1 group-hover/stage:opacity-100 group-hover/stage:translate-y-0 transition-all duration-300 pointer-events-none">
                            <MousePointerClick size={11} /> Click any text to edit
                        </div>
                    )}

                    {/* Signature position picker (appears on signature hover) */}
                    <AnimatePresence>
                        {sigCtrl.show && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                                transition={SPRING}
                                className="absolute z-20 flex items-center gap-1 st-popover rounded-xl p-1 whitespace-nowrap"
                                style={{
                                    left: sigCtrl.left,
                                    top: sigCtrl.top,
                                    x: '-50%',
                                    y: sigCtrl.above ? 'calc(-100% - 8px)' : '8px',
                                }}
                                onMouseEnter={() => { if (sigHideTimer.current) clearTimeout(sigHideTimer.current); }}
                                onMouseLeave={() => setSigCtrl((c) => ({ ...c, show: false }))}
                            >
                                {SIG_POSITIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setSignaturePosition(opt.id)}
                                        title={opt.label}
                                        aria-label={opt.label}
                                        className={`relative p-1.5 rounded-lg transition-colors ${signaturePosition === opt.id ? 'text-white' : 'text-white/45 hover:text-white hover:bg-white/10'}`}
                                    >
                                        {signaturePosition === opt.id && <motion.span layoutId="sig-pos" className="absolute inset-0 rounded-lg bg-violet-400/25 ring-1 ring-violet-300/40" transition={SPRING} />}
                                        <span className="relative"><PositionIcon corner={opt.id} /></span>
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />
                                <button
                                    onClick={onOpenBrandEditor}
                                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-white/75 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                                >
                                    <Edit3 size={11} /> Edit signature
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Prev / next */}
                {slides.length > 1 && (
                    <>
                        <NavArrow side="left" onClick={() => go(-1)} />
                        <NavArrow side="right" onClick={() => go(1)} />
                    </>
                )}
            </motion.div>

            {/* Filmstrip — click to (de)select; ⌘/Alt-click to select several; ←/→ to browse */}
            <div className="shrink-0 border-t border-white/[0.06] flex items-center gap-3 pl-4 pr-3 py-3">
                <div
                    ref={stripRef}
                    className="flex-1 min-w-0 flex items-end gap-2.5 overflow-x-auto lp-scrollbar-none py-1.5 px-0.5"
                    onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; }}
                >
                    {slides.map((slide, i) => {
                        const thumbSvg = thumbSvgs[i];
                        const isSelected = selectedSlideIndices.includes(i);
                        const isShown = i === currentIndex;
                        return (
                            <motion.button
                                key={i}
                                data-thumb={i}
                                initial={{ opacity: 0, y: 14, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: Math.min(i, 10) * 0.04, ...SPRING }}
                                whileHover={{ y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => handleThumbClick(e, i)}
                                title={`Slide ${i + 1} — click to select · ⌘/Alt-click to select several`}
                                aria-pressed={isSelected}
                                aria-current={isShown ? 'true' : undefined}
                                className="relative shrink-0 flex flex-col items-center gap-1.5"
                            >
                                <span
                                    className={`relative block rounded-lg overflow-hidden transition-[box-shadow,opacity] duration-300 ${isSelected
                                        ? 'ring-2 ring-violet-400 shadow-[0_0_24px_-4px_rgba(155,107,255,0.7)]'
                                        : isShown
                                            ? 'ring-1 ring-white/50'
                                            : 'ring-1 ring-white/10 opacity-55 hover:opacity-100'
                                        }`}
                                    style={{ width: selectedFormat === 'square' ? 60 : 50, height: 60 }}
                                >
                                    <span className="artifact-thumb svg-preview-container block w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: thumbSvg }} />
                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.span
                                                initial={{ scale: 0, rotate: -45 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                exit={{ scale: 0 }}
                                                transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                                                className="absolute top-1 right-1 grid place-items-center w-4 h-4 rounded-full bg-violet-400 text-black shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                                            >
                                                <Check size={10} strokeWidth={3.5} />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </span>
                                <span className={`lp-mono text-[9.5px] tabular-nums transition-colors ${isShown ? 'text-white' : 'text-white/30'}`}>{String(i + 1).padStart(2, '0')}</span>
                                {isShown && <motion.span layoutId="thumb-current" className="absolute -bottom-1.5 w-4 h-[2px] rounded-full bg-white" transition={SPRING} />}
                            </motion.button>
                        );
                    })}
                </div>
                <div className="shrink-0 text-right pl-2 border-l border-white/[0.06]">
                    <div className="lp-mono text-[10.5px] text-white/60 tabular-nums">{slides.length} slides</div>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={selectedSlideIndices.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[10.5px] text-white/35">
                            {selectedSlideIndices.length > 0 ? <span className="text-violet-300">{selectedSlideIndices.length} selected · Esc</span> : <span className="hidden lg:inline">← → to browse</span>}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {settingsOpen && (
                    <ArtifactSettingsPanel
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onOpenBrandEditor={onOpenBrandEditor}
                        stageIndex={currentIndex}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

/* ------------------------------------------------------------------ */

const NavArrow: React.FC<{ side: 'left' | 'right'; onClick: () => void }> = ({ side, onClick }) => (
    <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.08, x: side === 'left' ? -2 : 2 }}
        whileTap={{ scale: 0.9 }}
        aria-label={side === 'left' ? 'Previous slide' : 'Next slide'}
        className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-3' : 'right-3'} grid place-items-center w-10 h-10 rounded-full st-popover text-white/70 hover:text-white opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100 transition-opacity duration-300`}
    >
        {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </motion.button>
);

const IdleStage: React.FC = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center px-6">
        <div className="relative mx-auto mb-8 w-[170px] h-[215px]">
            {[0, 1, 2].map(k => (
                <motion.div
                    key={k}
                    className="absolute inset-0 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] backdrop-blur-sm"
                    initial={{ rotate: 0, x: 0, opacity: 0 }}
                    animate={{ rotate: (k - 1) * 9, x: (k - 1) * 26, y: [0, k === 1 ? -8 : -4, 0], opacity: 1 }}
                    transition={{ rotate: { delay: 0.15 + k * 0.08, type: 'spring', stiffness: 200, damping: 18 }, x: { delay: 0.15 + k * 0.08, type: 'spring', stiffness: 200, damping: 18 }, opacity: { delay: 0.1 + k * 0.08 }, y: { duration: 5 + k, repeat: Infinity, ease: 'easeInOut' } }}
                    style={{ zIndex: k === 1 ? 2 : 1 }}
                >
                    {k === 1 && (
                        <div className="absolute inset-0 p-5 flex flex-col justify-end gap-2">
                            <div className="h-2 w-10 rounded-full bg-white/10" />
                            <div className="h-3.5 w-full rounded-full bg-white/[0.12]" />
                            <div className="h-3.5 w-3/4 rounded-full bg-white/[0.12]" />
                            <div className="h-2 w-2/3 rounded-full bg-white/[0.07] mt-1" />
                        </div>
                    )}
                </motion.div>
            ))}
            <motion.span className="absolute -top-3 -right-4 text-2xl" animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                <Sparkles className="text-violet-300" size={22} />
            </motion.span>
        </div>
        <h3 className="lp-display text-[22px] font-semibold text-white">Your carousel lands here</h3>
        <p className="mt-2 text-[13px] text-white/45 max-w-xs mx-auto leading-relaxed">
            Describe it in the chat. Agents research, write and design it, then you refine it by talking.
        </p>
        <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-white/35">Press <Kbd>/</Kbd> to start typing</div>
    </motion.div>
);

const PHASE_STEPS = ['PLAN', 'EXECUTE', 'REFLECT', 'SKETCH', 'DELIVER'] as const;

const GeneratingStage: React.FC<{ status: string; progress: number }> = ({ status, progress }) => {
    const phase = phaseOf(status);
    const color = PHASE_COLOR[phase];
    const activeIdx = PHASE_STEPS.indexOf(phase as typeof PHASE_STEPS[number]);
    return (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.5, ease: EASE }} className="text-center px-6 w-full max-w-md">
            <motion.div className="absolute left-1/2 top-1/2 w-[420px] h-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px] pointer-events-none" animate={{ backgroundColor: color, opacity: 0.18 }} transition={{ duration: 1 }} />
            {/* Deck being assembled */}
            <div className="relative mx-auto mb-10 w-[180px] h-[228px]">
                {[0, 1, 2, 3].map(k => (
                    <motion.div
                        key={k}
                        className="absolute inset-0 rounded-2xl ring-1 ring-white/10 overflow-hidden bg-[#12121c]"
                        animate={{
                            rotate: [(k - 1.5) * 7, (k - 1.5) * 9, (k - 1.5) * 7],
                            x: [(k - 1.5) * 18, (k - 1.5) * 24, (k - 1.5) * 18],
                            y: [0, -6, 0],
                        }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: k * 0.15 }}
                        style={{ zIndex: k }}
                    >
                        <div className="absolute inset-0 st-skeleton" />
                        <div className="absolute inset-0 p-5 flex flex-col justify-end gap-2">
                            <div className="h-2 w-10 rounded-full" style={{ background: `${color}55` }} />
                            <div className="h-3 w-full rounded-full bg-white/10" />
                            <div className="h-3 w-2/3 rounded-full bg-white/10" />
                        </div>
                    </motion.div>
                ))}
                {/* orbiting spark */}
                <motion.div className="absolute inset-[-28px]" animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} style={{ zIndex: 10 }}>
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 16px 4px ${color}` }} />
                </motion.div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mb-4">
                {PHASE_STEPS.map((p, i) => {
                    const on = i === activeIdx;
                    const past = activeIdx > i;
                    return (
                        <motion.span
                            key={p}
                            layout
                            className="lp-mono text-[9.5px] tracking-[0.14em] rounded-full px-2 py-1 border"
                            animate={{
                                color: on ? PHASE_COLOR[p] : past ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                                borderColor: on ? `${PHASE_COLOR[p]}88` : 'rgba(255,255,255,0.08)',
                                backgroundColor: on ? `${PHASE_COLOR[p]}18` : 'rgba(0,0,0,0)',
                            }}
                        >
                            {past ? '✓ ' : ''}{p}
                        </motion.span>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                <motion.p key={status} initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }} transition={{ duration: 0.35 }} className="lp-shimmer text-[15px] font-medium">
                    {phaseLabel(status) || 'Spinning up the agents'}
                </motion.p>
            </AnimatePresence>
            <div className="mt-5 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div className="h-full rounded-full st-sheen" style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }} animate={{ width: `${Math.max(4, progress || 0)}%` }} transition={{ duration: 0.8, ease: EASE }} />
            </div>
            <div className="mt-2.5 flex justify-between lp-mono text-[10.5px] text-white/35">
                <span>You can close this tab</span>
                <span className="tabular-nums">{Math.round(progress || 0)}%</span>
            </div>
        </motion.div>
    );
};
