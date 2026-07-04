/**
 * Auto-Save Hook
 * 
 * Centralized auto-save logic for carousel generator.
 * Handles both new carousel creation and existing carousel updates.
 * 
 * Features:
 * - 2-second debounce on changes
 * - Automatic limit checking
 * - Status tracking (idle, saving, saved, error, limit-reached)
 * - Promotes drafts to saved carousels
 * 
 * Location: src/hooks/useAutoSave.ts
 */

import { useState, useEffect, useRef } from 'react';
import { createCarousel, updateCarouselContent, StorageLimitError } from '../services/carouselService';
import { appToDbTemplate } from '../utils/templateConverter';
import { BrandKit, BrandMode, SignaturePosition } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'limit-reached';

interface UseAutoSaveParams {
    carouselId: string | null;
    slides: any[];
    theme: any | null;
    topic: string;
    userId: string;
    templateType: 'template-1' | 'template-2' | 'template-3' | 'template-4';
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
    currentCarouselId: string | null;
    errorMessage: string | null;
}

const DEBOUNCE_DELAY = 2000; // 2 seconds

export const useAutoSave = (params: UseAutoSaveParams): UseAutoSaveReturn => {
    const {
        carouselId,
        slides,
        theme,
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

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [exposedCarouselId, setExposedCarouselId] = useState<string | null>(carouselId);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>('');
    // Hard mutex: guarantees only one create/update request is ever in flight
    // for this hook instance, no matter how many overlapping timers or renders
    // try to fire a save at once.
    const isSavingRef = useRef(false);

    // The id the next debounced save should target. A ref (not state) so the
    // setTimeout callback below always reads the freshest value at fire time
    // instead of a value captured in a stale closure.
    const targetIdRef = useRef<string | null>(carouselId);
    const prevCarouselIdRef = useRef<string | null>(carouselId);

    // Detect the parent switching us to a different carousel (e.g. picking one
    // from the history sidebar) — this happens without unmounting the hook, so
    // without this, a debounce cycle already in flight for the OLD carousel could
    // race the id change and create a duplicate instead of updating. Adjusting
    // refs during render (not in an effect) means there is no lag: by the time any
    // effect below runs, targetIdRef already reflects the new carousel.
    if (carouselId !== prevCarouselIdRef.current) {
        prevCarouselIdRef.current = carouselId;
        targetIdRef.current = carouselId;
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
        if (exposedCarouselId !== carouselId) {
            setExposedCarouselId(carouselId);
        }
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
        // 4. Already at limit
        if (!userId || slides.length === 0 || !theme || saveStatus === 'limit-reached') {
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
            if (isSavingRef.current) {
                console.warn('[useAutoSave] A save is already in flight — skipping this overlapping trigger');
                return;
            }
            isSavingRef.current = true;

            try {
                setSaveStatus('saving');
                setErrorMessage(null);

                const dbTemplateType = appToDbTemplate(templateType);
                const idToSave = targetIdRef.current;

                if (!idToSave) {
                    // NEW CAROUSEL: Create in database
                    console.log('[useAutoSave] Creating new carousel...');

                    const { data, error } = await createCarousel(
                        userId,
                        topic || 'Untitled Carousel',
                        dbTemplateType,
                        theme,
                        slides,
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
                        if (error instanceof StorageLimitError) {
                            console.warn('[useAutoSave] Storage limit reached');
                            setSaveStatus('limit-reached');
                            setErrorMessage(error.message);
                        } else {
                            console.error('[useAutoSave] Create error:', error);
                            setSaveStatus('error');
                            setErrorMessage('Failed to save carousel');
                        }
                    } else if (data) {
                        console.log('[useAutoSave] Successfully created carousel:', data.$id);
                        // Only targetIdRef is updated here — prevCarouselIdRef must stay
                        // untouched until the carouselId PROP itself catches up (one render
                        // later, once the parent's own effect propagates the new id). Bumping
                        // prevCarouselIdRef early made the render-phase switch-detection above
                        // see the still-stale prop as a "switch back to null" and wipe targetIdRef.
                        targetIdRef.current = data.$id;
                        setExposedCarouselId(data.$id);
                        setSaveStatus('saved');
                        lastSavedRef.current = currentSignature;

                        // Auto-reset to idle after 3 seconds
                        setTimeout(() => setSaveStatus('idle'), 3000);
                    }
                } else {
                    // EXISTING CAROUSEL: Update in database
                    console.log('[useAutoSave] Updating existing carousel...');

                    const dbTemplateType = appToDbTemplate(templateType);

                    const { data, error } = await updateCarouselContent(
                        idToSave,
                        theme,
                        slides,
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
                if (err instanceof StorageLimitError) {
                    setSaveStatus('limit-reached');
                    setErrorMessage(err.message);
                } else {
                    setSaveStatus('error');
                    setErrorMessage('An unexpected error occurred');
                }
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
        carouselId,
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
        currentCarouselId: exposedCarouselId,
        errorMessage
    };
};
