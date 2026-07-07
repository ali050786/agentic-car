/**
 * Server-side port of services/profileService.ts's free-tier usage tracking.
 * Same collection/field shape (`profiles`, `free_usage_count`) — only the
 * client used to read/write it changes (node-appwrite instead of appwrite).
 */

import { databasesServer, serverConfig } from './appwriteServer';
import { FREE_TIER_LIMIT } from '../config/constants';

export const getFreeUsageCount = async (userId: string): Promise<number> => {
    try {
        const profile = await databasesServer.getDocument(serverConfig.databaseId, serverConfig.profilesCollectionId, userId);
        return (profile as any).free_usage_count || 0;
    } catch {
        return 0;
    }
};

export const incrementUsageCount = async (userId: string): Promise<number> => {
    const currentCount = await getFreeUsageCount(userId);
    const newCount = currentCount + 1;

    try {
        await databasesServer.updateDocument(serverConfig.databaseId, serverConfig.profilesCollectionId, userId, {
            free_usage_count: newCount,
        });
    } catch (updateError: any) {
        if (updateError.code === 404 || updateError.message?.includes('not be found')) {
            await databasesServer.createDocument(serverConfig.databaseId, serverConfig.profilesCollectionId, userId, {
                userId,
                free_usage_count: 1,
            });
            return 1;
        }
        throw updateError;
    }

    return newCount;
};

export class FreeLimitError extends Error {
    usageCount: number;
    constructor(message: string, usageCount: number) {
        super(message);
        this.name = 'FreeLimitError';
        this.usageCount = usageCount;
    }
}

/** Throws FreeLimitError if the user is out of free calls; else increments and returns the new count. */
export const assertAndConsumeFreeTier = async (userId: string): Promise<number> => {
    const current = await getFreeUsageCount(userId);
    if (current >= FREE_TIER_LIMIT) {
        throw new FreeLimitError('Free trial exhausted. Please contact admin for more credits.', current);
    }
    return incrementUsageCount(userId);
};
