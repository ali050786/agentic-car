/**
 * Appwrite Client Configuration
 * 
 * This file creates and exports the Appwrite client instance
 * and configuration for database collections.
 * 
 * Location: src/lib/appwriteClient.ts
 */

import { Client, Account, Databases, Storage, ID } from 'appwrite';

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const carouselsCollectionId = import.meta.env.VITE_APPWRITE_CAROUSELS_COLLECTION_ID;
const analyticsCollectionId = import.meta.env.VITE_APPWRITE_ANALYTICS_COLLECTION_ID;
const storageBucketId = import.meta.env.VITE_APPWRITE_STORAGE_BUCKET_ID;

// Validate environment variables
if (!endpoint || !projectId) {
    throw new Error(
        'Missing Appwrite environment variables. ' +
        'Please check that VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID ' +
        'are set in your .env file.'
    );
}

// ============================================================================
// APPWRITE CLIENT
// ============================================================================

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// ============================================================================
// CONFIGURATION
// ============================================================================

export const config = {
    databaseId: databaseId || '',
    carouselsCollectionId: carouselsCollectionId || '',
    analyticsCollectionId: analyticsCollectionId || '',
    storageBucketId: storageBucketId || '',
};

// ============================================================================
// HELPER: Generate ID
// =================================
export { ID };

// =================================
// TYPESCRIPT TYPES FOR DATABASE
// =================================

/**
 * User Profile (from Appwrite auth)
 */
export interface AppwriteUser {
    $id: string;
    email: string;
    name: string;
    emailVerification: boolean;
    prefs: any;
}

/**
 * Carousel Document
 */
export interface CarouselDocument {
    $id: string;
    userId: string;
    title: string;
    templateType: 'template1' | 'template2';
    theme: any;
    slides: any[];
    presetId: string | null;
    isPublic: boolean;
    $createdAt: string;
    $updatedAt: string;
}

/**
 * User Analytics Document
 */
export interface UserAnalyticsDocument {
    $id: string;
    userId: string;
    carouselsGenerated: number;
    templatesUsed: Record<string, number>;
    lastGenerationAt: string | null;
    $createdAt: string;
    $updatedAt: string;
}

// ===========================
// EXPORTS
// ===========================

export default client;
