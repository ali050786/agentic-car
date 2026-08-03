/**
 * Profile Service - Global Brand Kit Persistence
 * 
 * Handles saving and fetching global brand kits from Appwrite profiles table.
 * 
 * Location: services/profileService.ts
 */

import { databases, config } from '../lib/appwriteClient';
import { BrandKit } from '../types';

const getEnv = (key: string) => (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env[key] : process.env[key]);
const PROFILES_COLLECTION_ID = getEnv('VITE_APPWRITE_PROFILES_COLLECTION_ID') || 'profiles';

/**
 * Update user's global brand kit in their profile
 * 
 * @param userId - Appwrite user ID
 * @param brandKit - Brand kit to save
 * @returns Promise<void>
 */
export const updateUserBrandKit = async (
    userId: string,
    brandKit: BrandKit
): Promise<void> => {
    try {
        // Try to update first
        try {
            await databases.updateDocument(
                config.databaseId,
                PROFILES_COLLECTION_ID,
                userId,
                {
                    brand_kit: JSON.stringify(brandKit)
                }
            );
            console.log('[ProfileService] Global brand kit updated successfully');
        } catch (updateError: any) {
            // If document doesn't exist (404), create it
            if (updateError.code === 404 || updateError.message?.includes('not be found')) {
                console.log('[ProfileService] Profile not found, creating new one');
                await databases.createDocument(
                    config.databaseId,
                    PROFILES_COLLECTION_ID,
                    userId, // Use userId as document ID
                    {
                        userId: userId,
                        brand_kit: JSON.stringify(brandKit)
                    }
                );
                console.log('[ProfileService] Profile created with brand kit');
            } else {
                throw updateError;
            }
        }
    } catch (error: any) {
        console.error('[ProfileService] Failed to update brand kit:', error);
        throw new Error(`Failed to save global brand: ${error.message}`);
    }
};

/**
 * Fetch user's global brand kit from their profile
 * 
 * @param userId - Appwrite user ID
 * @returns Promise<BrandKit | null> - Brand kit or null if not set
 */
export const getUserBrandKit = async (
    userId: string
): Promise<BrandKit | null> => {
    try {
        const profile = await databases.getDocument(
            config.databaseId,
            PROFILES_COLLECTION_ID,
            userId
        );

        // brand_kit is stored as JSON string in database
        if (profile.brand_kit) {
            const brandKit = typeof profile.brand_kit === 'string'
                ? JSON.parse(profile.brand_kit)
                : profile.brand_kit;

            console.log('[ProfileService] Global brand kit fetched successfully');
            return brandKit as BrandKit;
        }

        console.log('[ProfileService] No global brand kit found for user');
        return null;
    } catch (error: any) {
        console.error('[ProfileService] Failed to fetch brand kit:', error);

        // Return null if profile doesn't exist or brand_kit field is missing
        // (graceful degradation)
        return null;
    }
};

/**
 * Initialize profile with default brand kit if one doesn't exist
 * Called after signup or when user first accesses brand features
 * 
 * @param userId - Appwrite user ID
 * @param userName - User's display name
 * @returns Promise<BrandKit> - The initialized brand kit
 */
export const initializeDefaultBrandKit = async (
    userId: string,
    userName: string
): Promise<BrandKit> => {
    // Create default brand kit with user's name
    const defaultBrandKit: BrandKit = {
        enabled: true,
        identity: {
            name: userName || 'Your Name',
            title: 'Creator',
            imageUrl: 'https://sgp.cloud.appwrite.io/v1/storage/buckets/693df05200140fb6514a/files/694278bd001f8831ffc8/view?project=6932ab3b00290095e2e1'
        },
        colors: {
            primary: '#0EA5E9',    // Ocean Tech blue
            secondary: '#06B6D4',  // Cyan
            text: '#E0F2FE',       // Light blue
            background: '#0C4A6E'  // Deep blue
        }
    };

    try {
        await updateUserBrandKit(userId, defaultBrandKit);
        console.log('[ProfileService] Default brand kit initialized');
        return defaultBrandKit;
    } catch (error) {
        console.error('[ProfileService] Failed to initialize default brand kit:', error);
        // Return the default even if save fails (optimistic)
        return defaultBrandKit;
    }
};
