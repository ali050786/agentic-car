/**
 * Restore points: one document per snapshot in `carousel_versions`. Every
 * agent reply that changes the deck (and the reply that created it) saves the
 * deck as it is right after that reply and carries the snapshot's id
 * (chat message `versionId`), so the studio can put the carousel back to any
 * reply. Only the newest MAX_VERSIONS snapshots per carousel are kept.
 *
 * Older snapshots (before restore points) were taken BEFORE a change and have
 * no `kind`; they're only used to undo on decks that have no restore point yet.
 *
 * Setup: npm run setup:versions
 */

import { databasesServer, serverConfig, ID, Query, Permission, Role } from '../lib/appwriteServer';
import type { BrandMode, CarouselTheme, SignaturePosition, SlideContent, TemplateId, CarouselFormat } from '../types';

export const VERSIONS_COLLECTION = process.env.APPWRITE_CAROUSEL_VERSIONS_COLLECTION_ID || 'carousel_versions';
const MAX_VERSIONS = 30;

export interface DeckSnapshot {
    slides: SlideContent[];
    theme: CarouselTheme;
    templateId: TemplateId;
    format: CarouselFormat;
    presetId: string;
    selectedPattern?: number;
    signaturePosition?: SignaturePosition;
    brandMode?: BrandMode;
    /** The change this snapshot records (e.g. "Rewrote slide 3"). */
    label: string;
    /** 'point': the deck right after a reply (restore point). Unset: an older before-change snapshot. */
    kind?: 'point';
    createdAt?: string;
}

/** Saves a snapshot and prunes old ones; returns its id. Never throws (restore is a convenience, not a gate). */
export const saveVersionServer = async (carouselId: string, userId: string, snap: DeckSnapshot): Promise<string | null> => {
    try {
        const created = await databasesServer.createDocument(
            serverConfig.databaseId,
            VERSIONS_COLLECTION,
            ID.unique(),
            {
                carouselId,
                userId,
                label: (snap.label || 'Edit').slice(0, 200),
                snapshot: JSON.stringify({ ...snap, createdAt: undefined }),
                createdAt: new Date().toISOString(),
            },
            [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))],
        );
        const res = await databasesServer.listDocuments(serverConfig.databaseId, VERSIONS_COLLECTION, [
            Query.equal('carouselId', carouselId),
            Query.orderDesc('createdAt'),
            Query.limit(50),
        ]);
        for (const doc of res.documents.slice(MAX_VERSIONS)) {
            await databasesServer.deleteDocument(serverConfig.databaseId, VERSIONS_COLLECTION, doc.$id).catch(() => undefined);
        }
        return created.$id;
    } catch (err: any) {
        if (err?.code === 404) {
            console.warn('[versionStore] carousel_versions collection missing. Run scripts/setupCarouselVersions.ts to enable undo.');
        } else {
            console.warn('[versionStore] snapshot failed (non-fatal):', err?.message || err);
        }
        return null;
    }
};

/** One snapshot by id, or null if it's gone (pruned). */
export const getVersionServer = async (id: string): Promise<(DeckSnapshot & { id: string }) | null> => {
    try {
        const doc: any = await databasesServer.getDocument(serverConfig.databaseId, VERSIONS_COLLECTION, id);
        const snap = JSON.parse(doc.snapshot || 'null') as DeckSnapshot | null;
        return snap ? { ...snap, id: doc.$id, label: doc.label, createdAt: doc.createdAt } : null;
    } catch {
        return null;
    }
};

/** The newest older-style (before-change) snapshot, or null. Only for decks with no restore point yet. */
export const peekVersionServer = async (carouselId: string): Promise<(DeckSnapshot & { id: string }) | null> => {
    try {
        const res = await databasesServer.listDocuments(serverConfig.databaseId, VERSIONS_COLLECTION, [
            Query.equal('carouselId', carouselId),
            Query.orderDesc('createdAt'),
            Query.limit(MAX_VERSIONS),
        ]);
        for (const doc of res.documents as any[]) {
            const snap = JSON.parse(doc.snapshot || 'null') as DeckSnapshot | null;
            if (snap && snap.kind !== 'point') return { ...snap, id: doc.$id, label: doc.label, createdAt: doc.createdAt };
        }
        return null;
    } catch (err: any) {
        console.warn('[versionStore] undo lookup failed:', err?.message || err);
        return null;
    }
};

/** Removes a snapshot once it has been restored. */
export const dropVersionServer = async (id: string): Promise<void> => {
    await databasesServer.deleteDocument(serverConfig.databaseId, VERSIONS_COLLECTION, id).catch((err) => {
        console.warn('[versionStore] could not remove restored snapshot:', err?.message || err);
    });
};

export const countVersionsServer = async (carouselId: string): Promise<number> => {
    try {
        const res = await databasesServer.listDocuments(serverConfig.databaseId, VERSIONS_COLLECTION, [
            Query.equal('carouselId', carouselId),
            Query.limit(1),
        ]);
        return res.total;
    } catch {
        return 0;
    }
};
