/**
 * Restore points in the studio: every agent reply that changed the carousel
 * carries a versionId (a snapshot of the deck right after that reply, saved
 * by the worker in `carousel_versions`). Restoring puts the carousel back to
 * that reply instantly, with no chat message and no agent run.
 *
 * After a restore the replies that came later are shown faded; restoring the
 * latest reply goes forward again. The first time the deck leaves its latest
 * state, that state is kept (the "tip", including any hand edits made after
 * the last reply) so going forward returns exactly to it. When the user sends
 * a new message, the faded replies are dropped (the worker trims the thread).
 *
 * The restore position is remembered per carousel in localStorage, so the
 * faded state survives a reload on this device.
 */

import { databases, config } from '../lib/appwriteClient';
import { useCarouselStore } from '../store/useCarouselStore';
import { updateCarouselContent } from './carouselService';
import { appToDbTemplate, withoutLayouts } from '../utils/templateConverter';
import { restorePoints } from '../core/agents/undo';
import type { BrandMode, CarouselFormat, CarouselTheme, ChatMessage, SignaturePosition, SlideContent, TemplateId } from '../types';

const VERSIONS_COLLECTION_ID = 'carousel_versions';

export interface DeckState {
    slides: SlideContent[];
    theme: CarouselTheme | null;
    templateId: TemplateId;
    format: CarouselFormat;
    presetId: string;
    selectedPattern?: number;
    signaturePosition?: SignaturePosition;
    brandMode?: BrandMode;
}

interface SavedRestore {
    /** The reply the carousel is restored to. */
    to: string;
    /** The latest state before the first restore (so "forward" returns exactly to it). */
    tip?: DeckState;
}

const key = (carouselId: string) => `carousel-restore-${carouselId}`;

export const readRestore = (carouselId: string): SavedRestore | null => {
    try {
        const raw = localStorage.getItem(key(carouselId));
        const v = raw ? JSON.parse(raw) : null;
        return v && typeof v.to === 'string' ? v : null;
    } catch {
        return null;
    }
};

const writeRestore = (carouselId: string, value: SavedRestore) => {
    try { localStorage.setItem(key(carouselId), JSON.stringify(value)); } catch { /* storage unavailable: kept in memory only */ }
};

export const clearRestore = (carouselId: string | null | undefined) => {
    if (!carouselId) return;
    try { localStorage.removeItem(key(carouselId)); } catch { /* ignore */ }
};

/** The deck as a restore point saved it, or null if it's gone (only the newest 30 are kept). */
export const loadRestorePoint = async (versionId: string): Promise<DeckState | null> => {
    try {
        const doc: any = await databases.getDocument(config.databaseId, VERSIONS_COLLECTION_ID, versionId);
        const snap = JSON.parse(doc.snapshot || 'null');
        return snap && Array.isArray(snap.slides) ? snap as DeckState : null;
    } catch {
        return null;
    }
};

const currentDeckState = (): DeckState => {
    const s = useCarouselStore.getState();
    return {
        slides: s.slides as SlideContent[],
        theme: s.theme,
        templateId: s.selectedTemplate,
        format: s.selectedFormat,
        presetId: s.presetId,
        selectedPattern: s.selectedPattern,
        signaturePosition: s.signaturePosition,
        brandMode: s.brandMode,
    };
};

/** Puts a deck state on screen and saves it right away (a message sent next works on this version). */
const applyDeckState = async (carouselId: string, st: DeckState) => {
    const s = useCarouselStore.getState();
    s.setTemplate(st.templateId);
    s.setFormat(st.format);
    if (st.presetId) s.setPresetId(st.presetId);
    if (st.brandMode) s.setBrandMode(st.brandMode);
    s.setPattern(typeof st.selectedPattern === 'number' ? st.selectedPattern : 1);
    if (st.signaturePosition) s.setSignaturePosition(st.signaturePosition);
    if (st.theme) s.setTheme(st.theme);
    s.setSlides(st.slides as any);
    const sel = useCarouselStore.getState().selectedSlideIndex;
    if (sel !== null && sel >= st.slides.length) s.setSelectedSlideIndex(null);

    const n = useCarouselStore.getState();
    const { error } = await updateCarouselContent(
        carouselId,
        st.theme,
        withoutLayouts(st.slides),
        n.brandMode,
        n.presetId,
        n.brandKit,
        n.signaturePosition,
        n.selectedPattern,
        n.patternOpacity,
        appToDbTemplate(st.templateId),
        st.format,
    );
    if (error) console.warn('[restore] saving the restored carousel failed (autosave will retry):', error);
};

export type RestoreOutcome = 'restored' | 'latest' | 'missing' | 'unavailable';

/**
 * Restores the carousel to the state right after `messageId`'s reply.
 * 'latest' means it went back to the newest reply (nothing faded any more).
 */
export const restoreToReply = async (messageId: string): Promise<RestoreOutcome> => {
    const store = useCarouselStore.getState();
    const carouselId = store.activeCarouselId;
    const msgs = store.chatMessages;
    const msg = msgs.find((m) => m.id === messageId);
    if (!carouselId || !msg?.versionId) return 'unavailable';
    const points = restorePoints(msgs);
    const latest = points[points.length - 1];
    const saved = readRestore(carouselId);
    const toLatest = !!latest && latest.id === msg.id;

    const state = toLatest && saved?.tip ? saved.tip : await loadRestorePoint(msg.versionId);
    if (!state) return 'missing';

    // Leaving the latest state for the first time: keep it, hand edits included.
    const tip = saved?.tip ?? (store.restoredTo ? undefined : currentDeckState());
    await applyDeckState(carouselId, state);

    if (toLatest) {
        clearRestore(carouselId);
        useCarouselStore.getState().setRestoredTo(null);
        return 'latest';
    }
    writeRestore(carouselId, { to: msg.id, tip });
    useCarouselStore.getState().setRestoredTo(msg.id);
    return 'restored';
};

/**
 * Before sending a message after a restore: drops the faded replies from the
 * chat and forgets the restore position. Returns the reply the worker should
 * trim the thread to (sent with the job), or undefined if nothing was restored.
 */
export const commitRestore = (): string | undefined => {
    const store = useCarouselStore.getState();
    const to = store.restoredTo;
    if (!to) return undefined;
    const at = store.chatMessages.findIndex((m) => m.id === to);
    if (at >= 0) {
        const kept: ChatMessage[] = store.chatMessages.slice(0, at + 1);
        store.setChatMessages(kept);
        if (store.chatSummarizedUpTo > kept.length) store.setChatSummarizedUpTo(kept.length);
    }
    clearRestore(store.activeCarouselId);
    store.setRestoredTo(null);
    return at >= 0 ? to : undefined;
};

/** On opening a carousel: brings back a restore position saved on this device. */
export const rehydrateRestore = (carouselId: string, messages: ChatMessage[]) => {
    const saved = readRestore(carouselId);
    const valid = !!saved && messages.some((m) => m.id === saved.to && m.versionId);
    if (saved && !valid) clearRestore(carouselId);
    useCarouselStore.getState().setRestoredTo(valid ? saved!.to : null);
};
