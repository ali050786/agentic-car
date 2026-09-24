/**
 * Deck version history for undo. One document per snapshot in
 * `carousel_versions`, written right BEFORE an edit changes the deck, so
 * "undo" restores exactly what the user saw before their last change.
 * Only the newest MAX_VERSIONS snapshots per carousel are kept.
 *
 * Setup: npx tsx scripts/setupCarouselVersions.ts
 */

import { databasesServer, serverConfig, ID, Query, Permission, Role } from '../lib/appwriteServer';
import type { BrandMode, CarouselTheme, SignaturePosition, SlideContent, TemplateId, CarouselFormat } from '../types';

export const VERSIONS_COLLECTION = process.env.APPWRITE_CAROUSEL_VERSIONS_COLLECTION_ID || 'carousel_versions';
const MAX_VERSIONS = 10;

export interface DeckSnapshot {
    slides: SlideContent[];
    theme: CarouselTheme;
    templateId: TemplateId;
    format: CarouselFormat;
    presetId: string;
    selectedPattern?: number;
    signaturePosition?: SignaturePosition;
    brandMode?: BrandMode;
    /** What the change that followed this snapshot was (e.g. "Rewrote slide 3"). */
    label: string;
    createdAt?: string;
}

/** Saves a snapshot and prunes old ones. Never throws (undo is a convenience, not a gate). */
export const saveVersionServer = async (carouselId: string, userId: string, snap: DeckSnapshot): Promise<boolean> => {
    try {
        await databasesServer.createDocument(
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
        return true;
    } catch (err: any) {
        if (err?.code === 404) {
            console.warn('[versionStore] carousel_versions collection missing. Run scripts/setupCarouselVersions.ts to enable undo.');
        } else {
            console.warn('[versionStore] snapshot failed (non-fatal):', err?.message || err);
        }
        return false;
    }
};

/** The newest snapshot (not removed), or null when there is nothing to undo. */
export const peekVersionServer = async (carouselId: string): Promise<(DeckSnapshot & { id: string }) | null> => {
    try {
        const res = await databasesServer.listDocuments(serverConfig.databaseId, VERSIONS_COLLECTION, [
            Query.equal('carouselId', carouselId),
            Query.orderDesc('createdAt'),
            Query.limit(1),
        ]);
        const doc: any = res.documents[0];
        if (!doc) return null;
        const snap = JSON.parse(doc.snapshot || 'null') as DeckSnapshot | null;
        return snap ? { ...snap, id: doc.$id, label: doc.label, createdAt: doc.createdAt } : null;
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
