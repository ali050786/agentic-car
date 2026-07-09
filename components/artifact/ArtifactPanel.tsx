/**
 * Artifact Panel - the carousel is the hero.
 *
 * Minimal header (title, template/format pill -> settings, exports),
 * one large slide on stage, thumbnail strip below. Selecting a slide
 * scopes the chat ("editing slide N") and enables slide-level actions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCarouselStore } from '../../store/useCarouselStore';
import { useAuthStore } from '../../store/useAuthStore';
import { injectContentIntoSvg } from '../../utils/svgInjector';
import { serializeStageForFigma } from '../../utils/figmaExport';
import { exportSlideToJpg } from '../../utils/jpgExporter';
import { exportSlideToPdf } from '../../utils/pdfExporter';
import { ArtifactSettingsPanel } from './ArtifactSettingsPanel';
import { Copy, Edit2, FileText, Image, Settings2, CheckCircle, Loader2 } from 'lucide-react';

const TEMPLATE_NAMES: Record<string, string> = {
    'template-1': 'The Truth',
    'template-3': 'The Sketch',
    'template-4': 'The Statement',
};

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
        slides, theme, topic, selectedTemplate, selectedFormat, selectedPattern,
        patternOpacity, patternScale, patternSpacing, brandKit, signaturePosition,
        selectedSlideIndex, setSelectedSlideIndex, setRightPanelOpen, updateSlide,
        isGenerating, generationStatus, generationProgress, pendingDoodleSlides,
    } = useCarouselStore(useShallow(s => ({
        slides: s.slides,
        theme: s.theme,
        topic: s.topic,
        selectedTemplate: s.selectedTemplate,
        selectedFormat: s.selectedFormat,
        selectedPattern: s.selectedPattern,
        patternOpacity: s.patternOpacity,
        patternScale: s.patternScale,
        patternSpacing: s.patternSpacing,
        brandKit: s.brandKit,
        signaturePosition: s.signaturePosition,
        selectedSlideIndex: s.selectedSlideIndex,
        setSelectedSlideIndex: s.setSelectedSlideIndex,
        setRightPanelOpen: s.setRightPanelOpen,
        updateSlide: s.updateSlide,
        isGenerating: s.isGenerating,
        generationStatus: s.generationStatus,
        generationProgress: s.generationProgress,
        pendingDoodleSlides: s.pendingDoodleSlides,
    })));
    const { globalBrandKit } = useAuthStore();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);

    const currentIndex = selectedSlideIndex !== null && selectedSlideIndex < slides.length ? selectedSlideIndex : 0;
    const currentSlide = slides[currentIndex];

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
        return injectContentIntoSvg(selectedTemplate, currentSlide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, `stage-${currentIndex}`);
    }, [selectedTemplate, currentSlide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, currentIndex]);

    const thumbSvgs = useMemo(
        () => slides.map((slide, i) => injectContentIntoSvg(selectedTemplate, slide, theme, effectiveBranding, selectedFormat, selectedPattern, patternOpacity, patternScale, patternSpacing, `thumb-${i}`)),
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
    const editCtxRef = useRef({ slides, currentIndex });
    editCtxRef.current = { slides, currentIndex };

    useEffect(() => {
        const root = stageRef.current;
        if (!root) return;

        const flushAll = () => {
            const { slides, currentIndex } = editCtxRef.current;
            const slide = slides[currentIndex];
            if (!slide) return;
            const patch: Record<string, any> = {};
            let listItems = slide.listItems ? [...slide.listItems] : undefined;
            let listChanged = false;

            root.querySelectorAll<HTMLElement>('[data-edit-field]').forEach((el) => {
                const field = el.getAttribute('data-edit-field')!;
                const text = (el.innerText ?? el.textContent ?? '').replace(/ /g, ' ').trim();
                if (field === 'listItem') {
                    if (!listItems) return;
                    const idx = Number(el.getAttribute('data-edit-index'));
                    const cur = listItems[idx];
                    const curText = typeof cur === 'object' && cur !== null ? (cur.bullet || '') : String(cur ?? '');
                    if (text !== curText) {
                        listItems[idx] = (typeof cur === 'object' && cur !== null) ? { ...cur, bullet: text } : text;
                        listChanged = true;
                    }
                } else if (((slide as any)[field] ?? '') !== text) {
                    patch[field] = text;
                }
            });
            if (listChanged) patch.listItems = listItems;
            if (Object.keys(patch).length > 0) updateSlide(currentIndex, patch);
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
        return () => {
            root.removeEventListener('keydown', onKeyDown);
            root.removeEventListener('focusout', onFocusOut);
            flushAll(); // safety net for slide switch / unmount while focused
        };
        // Re-bind whenever the stage (re)renders so the listeners are guaranteed
        // to exist once content is present — cheap: just two delegated handlers.
    }, [stageSvg, updateSlide]);

    const withBusy = async (name: string, fn: () => Promise<void>) => {
        setBusyAction(name);
        try {
            await fn();
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

    // Empty state: generation progress or a quiet canvas
    if (slides.length === 0) {
        return (
            <div className="flex-1 h-full flex items-center justify-center bg-neutral-950">
                {isGenerating ? (
                    <div className="text-center max-w-sm px-6">
                        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-5" />
                        <p className="text-white text-sm font-medium mb-1">{generationStatus}</p>
                        <div className="h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${generationProgress}%` }} />
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-neutral-600">
                        <div className="w-40 h-52 border border-dashed border-white/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
                            <span className="text-3xl opacity-40">✦</span>
                        </div>
                        <p className="text-xs">Your carousel will appear here</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col bg-neutral-950 relative min-w-0">
            <style>{`
                .artifact-svg-fit svg { max-width: 100%; max-height: 100%; width: auto; height: auto; }
                .artifact-thumb svg { width: 100%; height: 100%; }
            `}</style>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
                <span className="text-sm font-medium text-white truncate flex-1">{topic || 'Untitled carousel'}</span>
                <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="settings-trigger-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 text-xs text-neutral-300 hover:border-white/30 hover:text-white transition-colors"
                >
                    <Settings2 size={12} />
                    {TEMPLATE_NAMES[selectedTemplate] || selectedTemplate} · {selectedFormat === 'square' ? '1:1' : '4:5'}
                </button>
                <div className="flex items-center gap-1">
                    <button onClick={handleCopyFigma} disabled={!!busyAction} title="Copy SVG for Figma" aria-label="Copy SVG for Figma"
                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                        {busyAction === 'Figma copy' ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <button onClick={handleJpg} disabled={!!busyAction} title="Export slide as JPG" aria-label="Export slide as JPG"
                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                        {busyAction === 'JPG export' ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
                    </button>
                    <button onClick={handlePdf} disabled={!!busyAction} title="Export slide as PDF" aria-label="Export slide as PDF"
                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                        {busyAction === 'PDF export' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    </button>
                </div>
            </div>

            {/* Stage */}
            <div className="flex-1 flex items-center justify-center p-6 min-h-0 relative">
                <div className="relative h-full flex items-center justify-center" style={{ aspectRatio: selectedFormat === 'square' ? '1 / 1' : '4 / 5', maxHeight: '100%' }}>
                    <div
                        ref={stageRef}
                        className="artifact-svg-fit w-full h-full flex items-center justify-center rounded-xl overflow-hidden border border-white/10 shadow-2xl"
                        dangerouslySetInnerHTML={{ __html: stageSvg }}
                    />
                    {pendingDoodleSlides.includes(currentIndex) && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5">
                            <span className="w-3 h-3 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                            <span className="text-[11px] text-white/90">Sketching image…</span>
                        </div>
                    )}
                    {/* Slide-level actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-white/15 rounded-lg px-1.5 py-1">
                        <button
                            onClick={() => { setSelectedSlideIndex(currentIndex); setRightPanelOpen(true); }}
                            title="Edit slide content"
                            aria-label="Edit slide content"
                            className="p-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Edit2 size={13} />
                        </button>
                        <span className="text-[10px] text-neutral-400 pr-1">slide {currentIndex + 1}</span>
                    </div>
                </div>
            </div>

            {/* Thumbnail strip */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10 overflow-x-auto">
                {slides.map((slide, i) => {
                    const thumbSvg = thumbSvgs[i];
                    const isActive = i === currentIndex && selectedSlideIndex !== null;
                    const isShown = i === currentIndex;
                    return (
                        <button
                            key={i}
                            onClick={() => setSelectedSlideIndex(selectedSlideIndex === i ? null : i)}
                            title={`Slide ${i + 1}`}
                            className={`relative flex-shrink-0 rounded-md overflow-hidden transition-all ${isActive
                                ? 'ring-2 ring-blue-500'
                                : isShown
                                    ? 'ring-1 ring-white/40'
                                    : 'ring-1 ring-white/10 opacity-60 hover:opacity-100'
                                }`}
                            style={{ width: selectedFormat === 'square' ? 52 : 44, height: 52 }}
                        >
                            <div className="artifact-thumb svg-preview-container w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: thumbSvg }} />
                        </button>
                    );
                })}
                <span className="text-[11px] text-neutral-500 ml-auto flex-shrink-0 pl-3">
                    {slides.length} slides{selectedSlideIndex !== null ? ` · slide ${currentIndex + 1} selected` : ''}
                </span>
            </div>

            <ArtifactSettingsPanel
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onOpenBrandEditor={onOpenBrandEditor}
            />
        </div>
    );
};
