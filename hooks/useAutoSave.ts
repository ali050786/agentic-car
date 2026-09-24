/**
 * Auto-Save Hook
 *
 * Centralized auto-save logic for carousel generator.
 * Handles both new carousel creation and existing carousel updates.
 *
 * Features:
 * - 2-second debounce on changes
 * - Status tracking (idle, saving, saved, error)
 * - Promotes drafts to saved carousels
 *
 * Location: src/hooks/useAutoSave.ts
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { createCarousel, updateCarouselContent } from '../services/carouselService';
import { appToDbTemplate, stampTheme, type AppTemplateType } from '../utils/templateConverter';
import { compactDesigns } from '../core/design/canvas';
import { BrandKit, BrandMode, SignaturePosition } from '../types';
import { useCarouselStore } from '../store/useCarouselStore';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveParams {
    slides: any[];
    theme: any | null;
    topic: string;
    userId: string;
    templateType: AppTemplateType;
    brandMode: BrandMode;
    presetId: string;
    brandKit: BrandKit;
    signaturePosition: SignaturePosition;
    format: 'portrait' | 'square';
    selectedPattern: number;
    patternOpacity: number;
}

interface UseAutoSaveReturn {
    saveStatus: SaveStatus;
    errorMessage: string | null;
}

const DEBOUNCE_DELAY = 2000; // 2 seconds

export const useAutoSave = (params: UseAutoSaveParams): UseAutoSaveReturn => {
    const {
        slides,
        theme: rawTheme,
        topic,
        userId,
        templateType,
        brandMode,
        presetId,
        brandKit,
        signaturePosition,
        format,
        selectedPattern,
        patternOpacity
    } = params;

    // Single source of truth for carousel identity (see types.ts) — subscribing
    // here means this effect re-runs the moment anything else (loading a
    // carousel from the sidebar, starting a new one) changes it.
    const activeCarouselId = useCarouselStore(s => s.activeCarouselId);
    // A create job's draft on screen isn't a carousel yet: the job saves the final deck itself.
    const draftPreview = useCarouselStore(s => s.draftPreview);
    // The Canvas is stored as template1 + a marker on the theme (utils/templateConverter.ts).
    const rawThemeKey = rawTheme ? JSON.stringify(rawTheme) : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const theme = useMemo(() => stampTheme(rawTheme, templateType), [rawThemeKey, templateType]);

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>('');
    // Hard mutex: guarantees only one create/update request is ever in flight
    // for this hook instance, no matter how many overlapping timers or renders
    // try to fire a save at once.
    const isSavingRef = useRef(false);
    const prevCarouselIdRef = useRef<string | null>(activeCarouselId);

    // Detect something else switching the active carousel (e.g. picking one
    // from the history sidebar) — reset the "already saved" baseline to the
    // newly-active carousel's own content, so we don't immediately re-save it
    // as if it were a fresh edit. Adjusting refs during render (not in an
    // effect) means there's no lag before the debounce effect below sees it.
    if (activeCarouselId !== prevCarouselIdRef.current) {
        prevCarouselIdRef.current = activeCarouselId;
        lastSavedRef.current = JSON.stringify({
            slides,
            theme,
            templateType,
            brandMode,
            presetId,
            brandKit,
            signaturePosition,
            format,
            selectedPattern,
            patternOpacity
        });
    }

    useEffect(() => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Don't auto-save if:
        // 1. No user ID
        // 2. No slides
        // 3. No theme
        if (!userId || slides.length === 0 || !theme || draftPreview) {
            return;
        }

        // Create a signature of current data to avoid duplicate saves
        const currentSignature = JSON.stringify({
            slides,
            theme,
            templateType,
            brandMode,
            presetId,
            brandKit,
            signaturePosition,
            format,
            selectedPattern,
            patternOpacity
        });

        // Skip if data hasn't changed
        if (currentSignature === lastSavedRef.current) {
            return;
        }

        // Set up debounced save
        timeoutRef.current = setTimeout(async () => {
            if (useCarouselStore.getState().draftPreview) return;
            if (isSavingRef.current) {
                console.warn('[useAutoSave] A save is already in flight — skipping this overlapping trigger');
                return;
            }
            isSavingRef.current = true;

            try {
                setSaveStatus('saving');
                setErrorMessage(null);

                const dbTemplateType = appToDbTemplate(templateType);
                // Read fresh at fire time (not the closed-over reactive value
                // above) — guarantees this never acts on a stale id.
                const idToSave = useCarouselStore.getState().activeCarouselId;

                if (!idToSave) {
                    // NEW CAROUSEL: Create in database
                    console.log('[useAutoSave] Creating new carousel...');

                    const { data, error } = await createCarousel(
                        userId,
                        topic || 'Untitled Carousel',
                        dbTemplateType,
                        theme,
                        compactDesigns(slides),
                        false, // isPublic
                        brandMode,
                        presetId,
                        brandKit,
                        signaturePosition,
                        format,
                        selectedPattern,
                        patternOpacity
                    );

                    if (error) {
                        console.error('[useAutoSave] Create error:', error);
                        setSaveStatus('error');
                        setErrorMessage('Failed to save carousel');
                    } else if (data) {
                        console.log('[useAutoSave] Successfully created carousel:', data.$id);
                        prevCarouselIdRef.current = data.$id;
                        useCarouselStore.getState().setActiveCarouselId(data.$id);
                        setSaveStatus('saved');
                        lastSavedRef.current = currentSignature;

                        // Auto-reset to idle after 3 seconds
                        setTimeout(() => setSaveStatus('idle'), 3000);
                    }
                } else {
                    // EXISTING CAROUSEL: Update in database
                    console.log('[useAutoSave] Updating existing carousel...');

                    const { data, error } = await updateCarouselContent(
                        idToSave,
                        theme,
                        compactDesigns(slides),
                        brandMode,
                        presetId,
                        brandKit,
                        signaturePosition,
                        selectedPattern,
                        patternOpacity,
                        dbTemplateType,
                        format
                    );

                    if (error) {
                        console.error('[useAutoSave] Update error:', error);
                        setSaveStatus('error');
                        setErrorMessage('Failed to update carousel');
                    } else {
                        console.log('[useAutoSave] Successfully updated carousel');
                        setSaveStatus('saved');
                        lastSavedRef.current = currentSignature;

                        // Auto-reset to idle after 3 seconds
                        setTimeout(() => setSaveStatus('idle'), 3000);
                    }
                }
            } catch (err: any) {
                console.error('[useAutoSave] Unexpected error:', err);
                setSaveStatus('error');
                setErrorMessage('An unexpected error occurred');
            } finally {
                isSavingRef.current = false;
            }
        }, DEBOUNCE_DELAY);

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [
        activeCarouselId,
        draftPreview,
        slides,
        theme,
        userId,
        topic,
        templateType,
        brandMode,
        presetId,
        brandKit,
        signaturePosition,
        format,
        selectedPattern,
        patternOpacity
    ]);

    return {
        saveStatus,
        errorMessage
    };
};
