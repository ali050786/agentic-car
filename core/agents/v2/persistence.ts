/**
 * Everything the v2 pipelines read from or write to the outside world, behind
 * one interface. The worker uses the Appwrite implementation; tests and evals
 * use the in-memory one, so the whole pipeline runs offline with a mock model.
 *
 * The Appwrite modules are imported lazily because lib/appwriteServer throws
 * at import time when its env vars are missing.
 */

import type { BrandKit, BrandMode, CarouselBrief, CarouselFormat, CarouselTheme, ChatMessage, SignaturePosition, SlideContent, StructuredMemory, TemplateId } from '../../../types';
import { appToDbTemplate, stampTheme, withoutLayouts } from '../../../utils/templateConverter';

export interface LoadedDeck {
    slides: SlideContent[];
    theme: CarouselTheme;
    templateId: TemplateId;
    format: CarouselFormat;
    presetId: string;
    selectedPattern?: number;
    signaturePosition?: SignaturePosition;
    brandMode?: BrandMode;
}

export interface DeckSnapshot extends LoadedDeck {
    label: string;
    /** 'point': the deck right after a reply (restore point). Unset: an older before-change snapshot. */
    kind?: 'point';
    createdAt?: string;
}

export type StoredSnapshot = DeckSnapshot & { id: string };

export interface DeckUpdate {
    theme?: CarouselTheme;
    slides?: SlideContent[];
    templateId?: TemplateId;
    format?: CarouselFormat;
    /** An empty string is a real value here (a deck on custom brand colors). */
    presetId?: string;
    selectedPattern?: number;
}

export interface NewCarousel {
    userId: string;
    title: string;
    templateId: TemplateId;
    theme: CarouselTheme;
    slides: SlideContent[];
    brandMode: BrandMode;
    presetId: string;
    brandKit: BrandKit;
    signaturePosition: SignaturePosition;
    format: CarouselFormat;
    selectedPattern: number;
    patternOpacity: number;
}

/** Extended brief persisted with the deck (fits the 8000-char `brief` attribute). */
export type StoredBrief = CarouselBrief & {
    takeaway?: string;
    sources?: { title: string; url: string }[];
    facts?: string[];
    pipeline?: string;
    /** The Creative Director's settings, so whole-deck edits keep the same content type and voice. */
    creative?: {
        contentType?: string;
        approachMode?: string;
        audienceType?: string;
        vocabulary?: string;
        humorAllowed?: boolean;
        stayFactuallyAccurate?: boolean;
        language?: string;
        emotion?: string;
    };
};

export interface PipelineStore {
    loadMemory(userId: string): Promise<StructuredMemory>;
    remember(userId: string, note: string, category: keyof StructuredMemory): Promise<void>;
    createCarousel(input: NewCarousel): Promise<string>;
    deleteCarousel(carouselId: string): Promise<void>;
    loadDeck(carouselId: string): Promise<LoadedDeck>;
    updateDeck(carouselId: string, updates: DeckUpdate): Promise<void>;
    appendMessage(carouselId: string, userId: string, msg: ChatMessage): Promise<void>;
    loadThread(carouselId: string): Promise<ChatMessage[]>;
    /** Removes every message after `messageId` (the user restored to that reply and moved on). */
    truncateThreadAfter(carouselId: string, messageId: string): Promise<number>;
    /** Attaches a restore point to an existing message. */
    setMessageVersion(carouselId: string, messageId: string, versionId: string): Promise<void>;
    saveBrief(carouselId: string, userId: string, brief: StoredBrief): Promise<void>;
    loadBrief(carouselId: string): Promise<StoredBrief | null>;
    /** Saves a snapshot; returns its id (null if versions aren't available). */
    saveVersion(carouselId: string, userId: string, snap: DeckSnapshot): Promise<string | null>;
    getVersion(id: string): Promise<StoredSnapshot | null>;
    /** Newest older-style (before-change) snapshot, for decks with no restore point yet. */
    peekVersion(carouselId: string): Promise<StoredSnapshot | null>;
    dropVersion(carouselId: string, id: string): Promise<void>;
    generateDoodle(prompt: string, aspectRatio: string, seed?: number): Promise<string>;
}

/** Production store: Appwrite + Replicate, loaded on first use. */
export const appwriteStore = (): PipelineStore => ({
    async loadMemory(userId) {
        const { getUserMemory } = await import('../../../lib/memoryServer');
        return getUserMemory(userId);
    },
    async remember(userId, note, category) {
        const { rememberUserPreference } = await import('../../../lib/memoryServer');
        await rememberUserPreference(userId, note, category);
    },
    async createCarousel(input) {
        const { createCarouselServer } = await import('../../../worker/carouselStoreServer');
        return createCarouselServer({
            ...input,
            theme: stampTheme(input.theme, input.templateId),
            slides: withoutLayouts(input.slides as any[]) as SlideContent[],
            templateType: appToDbTemplate(input.templateId),
        });
    },
    async deleteCarousel(id) {
        const { deleteCarouselServer } = await import('../../../worker/carouselStoreServer');
        await deleteCarouselServer(id);
    },
    async loadDeck(id) {
        const { loadCarouselServer } = await import('../../../worker/carouselStoreServer');
        return loadCarouselServer(id);
    },
    async updateDeck(id, updates) {
        const { databasesServer, serverConfig } = await import('../../../lib/appwriteServer');
        const data: Record<string, unknown> = {};
        if (updates.theme) data.theme = JSON.stringify(updates.templateId ? stampTheme(updates.theme, updates.templateId) : updates.theme);
        if (updates.slides) data.slides = JSON.stringify(withoutLayouts(updates.slides as any[]));
        if (updates.templateId) data.templateType = appToDbTemplate(updates.templateId);
        if (updates.format) data.format = updates.format;
        if (updates.presetId !== undefined) data.presetId = updates.presetId;
        if (typeof updates.selectedPattern === 'number') data.selectedPattern = updates.selectedPattern;
        if (Object.keys(data).length) await databasesServer.updateDocument(serverConfig.databaseId, serverConfig.carouselsCollectionId, id, data);
    },
    async appendMessage(carouselId, userId, msg) {
        const { appendMessage } = await import('../../../worker/threadStoreServer');
        await appendMessage(carouselId, userId, msg);
    },
    async loadThread(carouselId) {
        const { loadThread, } = await import('../../../worker/threadStoreServer');
        return loadThread(carouselId);
    },
    async truncateThreadAfter(carouselId, messageId) {
        const { truncateThreadAfter } = await import('../../../worker/threadStoreServer');
        return truncateThreadAfter(carouselId, messageId);
    },
    async setMessageVersion(carouselId, messageId, versionId) {
        const { setMessageVersion } = await import('../../../worker/threadStoreServer');
        await setMessageVersion(carouselId, messageId, versionId);
    },
    async saveBrief(carouselId, userId, brief) {
        const { saveCarouselBriefServer } = await import('../../../worker/briefStoreServer');
        await saveCarouselBriefServer(carouselId, userId, brief);
    },
    async loadBrief(carouselId) {
        const { loadCarouselBriefServer } = await import('../../../worker/briefStoreServer');
        return (await loadCarouselBriefServer(carouselId)) as StoredBrief | null;
    },
    async saveVersion(carouselId, userId, snap) {
        const { saveVersionServer } = await import('../../../worker/versionStoreServer');
        return saveVersionServer(carouselId, userId, snap);
    },
    async getVersion(id) {
        const { getVersionServer } = await import('../../../worker/versionStoreServer');
        return getVersionServer(id);
    },
    async peekVersion(carouselId) {
        const { peekVersionServer } = await import('../../../worker/versionStoreServer');
        return peekVersionServer(carouselId);
    },
    async dropVersion(_carouselId, id) {
        const { dropVersionServer } = await import('../../../worker/versionStoreServer');
        await dropVersionServer(id);
    },
    async generateDoodle(prompt, aspectRatio, seed) {
        const { generateAndPersistDoodle } = await import('../../../worker/doodleGen');
        return generateAndPersistDoodle(prompt, aspectRatio, seed);
    },
});

/** In-memory store for tests, evals and dry runs. */
export const memoryStore = (seed: { memory?: StructuredMemory } = {}): PipelineStore & { decks: Map<string, LoadedDeck & { userId: string }>; versions: Map<string, StoredSnapshot[]>; threads: Map<string, ChatMessage[]>; briefs: Map<string, StoredBrief>; memory: StructuredMemory } => {
    const decks = new Map<string, LoadedDeck & { userId: string }>();
    const versions = new Map<string, StoredSnapshot[]>();
    const threads = new Map<string, ChatMessage[]>();
    const briefs = new Map<string, StoredBrief>();
    const memory: StructuredMemory = seed.memory
        ? JSON.parse(JSON.stringify(seed.memory))
        : { brandRules: [], bannedWords: [], tonePrefs: [], pastDecisions: [] };
    let n = 0;
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    return {
        decks, versions, threads, briefs, memory,
        async loadMemory() { return clone(memory); },
        async remember(_u, note, category) {
            const bucket = memory[category] || (memory[category] = []);
            if (!bucket.some((x) => x.toLowerCase() === note.toLowerCase())) bucket.push(note);
            memory[category] = bucket.slice(-10);
        },
        async createCarousel(input) {
            const id = `mem-${++n}`;
            decks.set(id, { userId: input.userId, slides: clone(input.slides), theme: clone(input.theme), templateId: input.templateId, format: input.format, presetId: input.presetId, selectedPattern: input.selectedPattern, signaturePosition: input.signaturePosition, brandMode: input.brandMode });
            return id;
        },
        async deleteCarousel(id) { decks.delete(id); },
        async loadDeck(id) {
            const d = decks.get(id);
            if (!d) throw Object.assign(new Error('not found'), { code: 404 });
            return clone(d);
        },
        async updateDeck(id, u) {
            const d = decks.get(id);
            if (!d) throw Object.assign(new Error('not found'), { code: 404 });
            if (u.slides) d.slides = clone(u.slides);
            if (u.theme) d.theme = clone(u.theme);
            if (u.templateId) d.templateId = u.templateId;
            if (u.format) d.format = u.format;
            if (u.presetId !== undefined) d.presetId = u.presetId;
            if (typeof u.selectedPattern === 'number') d.selectedPattern = u.selectedPattern;
        },
        async appendMessage(carouselId, _u, msg) {
            const t = threads.get(carouselId) || [];
            t.push(clone(msg));
            threads.set(carouselId, t);
        },
        async loadThread(carouselId) { return clone(threads.get(carouselId) || []); },
        async truncateThreadAfter(carouselId, messageId) {
            const t = threads.get(carouselId) || [];
            const at = t.findIndex((m) => m.id === messageId);
            if (at < 0) return 0;
            threads.set(carouselId, t.slice(0, at + 1));
            return t.length - at - 1;
        },
        async setMessageVersion(carouselId, messageId, versionId) {
            const m = (threads.get(carouselId) || []).find((x) => x.id === messageId);
            if (m) m.versionId = versionId;
        },
        async saveBrief(carouselId, _u, brief) { briefs.set(carouselId, clone(brief)); },
        async loadBrief(carouselId) { return briefs.has(carouselId) ? clone(briefs.get(carouselId)!) : null; },
        async saveVersion(carouselId, _u, snap) {
            const list = versions.get(carouselId) || [];
            const id = `v-${++n}`;
            list.push(clone({ ...snap, id, createdAt: new Date().toISOString() }));
            versions.set(carouselId, list.slice(-30));
            return id;
        },
        async getVersion(id) {
            for (const list of versions.values()) {
                const v = list.find((x) => x.id === id);
                if (v) return clone(v);
            }
            return null;
        },
        async peekVersion(carouselId) {
            const list = (versions.get(carouselId) || []).filter((v) => v.kind !== 'point');
            return list.length ? clone(list[list.length - 1]) : null;
        },
        async dropVersion(carouselId, id) {
            versions.set(carouselId, (versions.get(carouselId) || []).filter((v) => v.id !== id));
        },
        async generateDoodle(prompt) { return `mock://doodle/${encodeURIComponent(prompt.slice(0, 40))}`; },
    };
};
