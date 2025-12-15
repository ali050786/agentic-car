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
import { createCarousel, updateCarouselContent, StorageLimitError, BrandingConfig } from '../services/carouselService';
import { appToDbTemplate } from '../utils/templateConverter';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'limit-reached';

interface UseAutoSaveParams {
    carouselId: string | null;
    slides: any[];
    theme: any | null;
    topic: string;
    userId: string;
    templateType: 'template-1' | 'template-2';
    presetId: string | null;
    format: 'portrait' | 'square';
    selectedPattern: number;
    patternOpacity: number;
    branding: BrandingConfig;
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
        presetId,
        format,
        selectedPattern,
        patternOpacity,
        branding
    } = params;

    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [currentCarouselId, setCurrentCarouselId] = useState<string | null>(carouselId);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>('');

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
            presetId,
            format,
            selectedPattern,
            patternOpacity,
            branding
        });

        // Skip if data hasn't changed
        if (currentSignature === lastSavedRef.current) {
            return;
        }

        // Set up debounced save
        timeoutRef.current = setTimeout(async () => {
            try {
                setSaveStatus('saving');
                setErrorMessage(null);

                const dbTemplateType = appToDbTemplate(templateType);

                if (!currentCarouselId) {
                    // NEW CAROUSEL: Create in database
                    console.log('[useAutoSave] Creating new carousel...');

                    const { data, error } = await createCarousel(
                        userId,
                        topic || 'Untitled Carousel',
                        dbTemplateType,
                        theme,
                        slides,
                        false, // isPublic
                        presetId,
                        format,
                        selectedPattern,
                        patternOpacity,
                        branding
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
                        setCurrentCarouselId(data.$id);
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
                        currentCarouselId,
                        theme,
                        slides,
                        selectedPattern,
                        patternOpacity,
                        branding,
                        dbTemplateType,
                        presetId,
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
            }
        }, DEBOUNCE_DELAY);

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [
        currentCarouselId,
        slides,
        theme,
        userId,
        topic,
        templateType,
        presetId,
        format,
        selectedPattern,
        patternOpacity,
        branding
    ]);

    // Update local carousel ID when prop changes
    useEffect(() => {
        if (carouselId !== currentCarouselId) {
            setCurrentCarouselId(carouselId);
        }
    }, [carouselId]);

    return {
        saveStatus,
        currentCarouselId,
        errorMessage
    };
};
