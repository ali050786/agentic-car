/**
 * Per-carousel living brief store. One document per carousel (doc id =
 * carouselId) in `carousel_briefs`, holding the CarouselBrief as JSON. The brief
 * is the persisted source of truth for a deck's intent — authored at creation
 * and injected into every edit turn so edits stay consistent with the original
 * premise/audience/voice.
 */

import { databasesServer, serverConfig, Permission, Role } from '../lib/appwriteServer';
import { CarouselBrief } from '../types';

const COLLECTION = 'carousel_briefs';

/** Load a carousel's brief, or null when none has been authored yet. */
export const loadCarouselBriefServer = async (carouselId: string): Promise<CarouselBrief | null> => {
    try {
        const doc: any = await databasesServer.getDocument(serverConfig.databaseId, COLLECTION, carouselId);
        const parsed = JSON.parse(doc.brief || 'null');
        return parsed && typeof parsed === 'object' ? parsed as CarouselBrief : null;
    } catch {
        return null;
    }
};

/** Upsert a carousel's brief (best-effort; the caller treats failure as non-fatal). */
export const saveCarouselBriefServer = async (
    carouselId: string,
    userId: string,
    brief: CarouselBrief,
): Promise<void> => {
    const body = { userId, brief: JSON.stringify(brief), updatedAt: new Date().toISOString() };
    try {
        await databasesServer.updateDocument(serverConfig.databaseId, COLLECTION, carouselId, body);
    } catch (e: any) {
        if (e?.code === 404) {
            await databasesServer.createDocument(serverConfig.databaseId, COLLECTION, carouselId, body, [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ]);
        } else {
            throw e;
        }
    }
};
