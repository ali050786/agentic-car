/**
 * Server-side port of services/carouselService.ts's create/update path —
 * same collection, same document shape (JSON-stringified theme/slides,
 * brand kit folded into the legacy `branding` field) — so carousels written
 * here render identically in the existing browser-side reader functions.
 */

import { databasesServer, serverConfig, ID, Query } from '../lib/appwriteServer';
import { BrandKit, BrandMode, SignaturePosition, SlideContent, CarouselTheme } from '../types';

const incrementCarouselCount = (userId: string, templateType: string) => {
    setTimeout(async () => {
        try {
            const { documents } = await databasesServer.listDocuments(serverConfig.databaseId, serverConfig.analyticsCollectionId, [
                Query.equal('userId', userId),
            ]);
            if (documents.length > 0) {
                const analytics: any = documents[0];
                const templatesUsed = JSON.parse(analytics.templatesUsed || '{}');
                templatesUsed[templateType] = (templatesUsed[templateType] || 0) + 1;
                await databasesServer.updateDocument(serverConfig.databaseId, serverConfig.analyticsCollectionId, analytics.$id, {
                    carouselsGenerated: analytics.carouselsGenerated + 1,
                    templatesUsed: JSON.stringify(templatesUsed),
                    lastGenerationAt: new Date().toISOString(),
                });
            } else {
                await databasesServer.createDocument(serverConfig.databaseId, serverConfig.analyticsCollectionId, ID.unique(), {
                    userId,
                    carouselsGenerated: 1,
                    templatesUsed: JSON.stringify({ [templateType]: 1 }),
                    lastGenerationAt: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.warn('[carouselStoreServer] Error updating analytics (non-critical):', error);
        }
    }, 0);
};

export interface CreateCarouselParams {
    userId: string;
    title: string;
    templateType: 'template1' | 'template3' | 'template4';
    theme: CarouselTheme;
    slides: SlideContent[];
    brandMode: BrandMode;
    presetId: string;
    brandKit: BrandKit;
    signaturePosition: SignaturePosition;
    format: 'portrait' | 'square';
    selectedPattern: number;
    patternOpacity: number;
}

/** Returns the new carousel's document id. */
export const createCarouselServer = async (params: CreateCarouselParams): Promise<string> => {
    const extendedBranding = {
        enabled: params.brandKit.enabled,
        name: params.brandKit.identity.name,
        title: params.brandKit.identity.title,
        imageUrl: params.brandKit.identity.imageUrl,
        position: params.signaturePosition,
        brandMode: params.brandMode,
        presetId: params.presetId,
        colors: params.brandKit.colors,
    };

    const document = await databasesServer.createDocument(serverConfig.databaseId, serverConfig.carouselsCollectionId, ID.unique(), {
        userId: params.userId,
        title: params.title,
        templateType: params.templateType,
        theme: JSON.stringify(params.theme),
        slides: JSON.stringify(params.slides),
        presetId: params.presetId,
        isPublic: false,
        format: params.format,
        selectedPattern: params.selectedPattern,
        patternOpacity: params.patternOpacity,
        branding: JSON.stringify(extendedBranding),
    });

    incrementCarouselCount(params.userId, params.templateType);
    return document.$id;
};

export class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

/** Throws ForbiddenError if the carousel isn't owned by userId. Uses the privileged
 * server key, which bypasses Appwrite's own document permissions — this check is
 * what stands in for those. */
export const assertOwnsCarousel = async (carouselId: string, userId: string): Promise<void> => {
    const doc = await databasesServer.getDocument(serverConfig.databaseId, serverConfig.carouselsCollectionId, carouselId);
    if ((doc as any).userId !== userId) throw new ForbiddenError('You do not own this carousel');
};

import { TemplateId, CarouselFormat } from '../types';

export interface LoadedCarousel {
    slides: SlideContent[];
    theme: CarouselTheme;
    templateId: TemplateId;
    format: CarouselFormat;
    presetId: string;
}

/**
 * Server-authoritative deck load. Reads the carousel doc by id and parses the
 * JSON-stringified slides/theme back into the shapes the agents work with, so a
 * continuation turn never has to trust client-supplied state. `templateType` is
 * stored compactly (`template1`) — normalise it to a `TemplateId` (`template-1`).
 */
export const loadCarouselServer = async (carouselId: string): Promise<LoadedCarousel> => {
    const doc: any = await databasesServer.getDocument(
        serverConfig.databaseId,
        serverConfig.carouselsCollectionId,
        carouselId
    );

    const parse = <T>(raw: unknown, fallback: T): T => {
        if (typeof raw !== 'string') return fallback;
        try { return JSON.parse(raw) as T; } catch { return fallback; }
    };

    const rawTemplate: string = doc.templateType || 'template1';
    const templateId = (rawTemplate.includes('-')
        ? rawTemplate
        : rawTemplate.replace(/^template(\d+)$/, 'template-$1')) as TemplateId;

    return {
        slides: parse<SlideContent[]>(doc.slides, []),
        theme: parse<CarouselTheme>(doc.theme, {} as CarouselTheme),
        templateId,
        format: (doc.format === 'square' ? 'square' : 'portrait') as CarouselFormat,
        presetId: doc.presetId || '',
    };
};

export const updateCarouselContentServer = async (
    carouselId: string,
    updates: { theme?: CarouselTheme; slides?: SlideContent[] }
): Promise<void> => {
    const updateData: any = {};
    if (updates.theme) updateData.theme = JSON.stringify(updates.theme);
    if (updates.slides) updateData.slides = JSON.stringify(updates.slides);
    await databasesServer.updateDocument(serverConfig.databaseId, serverConfig.carouselsCollectionId, carouselId, updateData);
};

/** Hard-delete a carousel. Used to clean up when output moderation rejects a freshly generated deck. */
export const deleteCarouselServer = async (carouselId: string): Promise<void> => {
    await databasesServer.deleteDocument(serverConfig.databaseId, serverConfig.carouselsCollectionId, carouselId);
};
