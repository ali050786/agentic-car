/**
 * Carousel Database Service - Appwrite
 * 
 * All database operations for carousels using Appwrite.
 * 
 * Location: src/services/carouselService.ts
 */

import { databases, config, ID } from '../lib/appwriteClient';
import { Query } from 'appwrite';

// ============================================================================
// TYPES
// ============================================================================

export interface BrandingConfig {
  enabled: boolean;
  name: string;
  title: string;
  imageUrl: string;
  position: 'bottom-left' | 'top-left' | 'top-right';
}

export interface CarouselData {
  userId: string;
  title: string;
  templateType: 'template1' | 'template2';
  theme: any;
  slides: any[];
  presetId: string | null;
  isPublic: boolean;
  format: 'portrait' | 'square';
  selectedPattern: number;           // Background pattern ID (1-12)
  patternOpacity: number;             // Pattern opacity (0-1)
  branding: BrandingConfig;           // Signature/branding config
}

export interface Carousel extends CarouselData {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
}

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

export class StorageLimitError extends Error {
  constructor(message: string = 'Storage limit reached') {
    super(message);
    this.name = 'StorageLimitError';
  }
}

// ============================================================================
// LIMIT CHECKING
// ============================================================================

/**
 * Check if user has reached carousel limit (5 carousels)
 */
export const checkCarouselLimit = async (userId: string): Promise<boolean> => {
  try {
    const { total } = await databases.listDocuments(
      config.databaseId,
      config.carouselsCollectionId,
      [
        Query.equal('userId', userId),
        Query.limit(1) // We only need the count
      ]
    );

    return total >= 5;
  } catch (error) {
    console.error('[checkCarouselLimit] Error:', error);
    // If there's an error checking, allow the operation (fail open)
    return false;
  }
};

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

/**
 * Create a new carousel in the database
 */
export const createCarousel = async (
  userId: string,
  title: string,
  templateType: 'template1' | 'template2',
  theme: any,
  slides: any[],
  isPublic: boolean = false,
  presetId: string | null = null,
  format: 'portrait' | 'square' = 'portrait',
  selectedPattern: number = 1,
  patternOpacity: number = 0.2,
  branding: BrandingConfig = {
    enabled: true,
    name: '',
    title: '',
    imageUrl: '',
    position: 'bottom-left'
  }
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    console.log('[createCarousel] Starting save...', { userId, title, templateType });

    // Check carousel limit before creating
    const limitReached = await checkCarouselLimit(userId);
    if (limitReached) {
      console.warn('[createCarousel] User has reached carousel limit');
      throw new StorageLimitError('You have reached the maximum of 5 carousels. Please delete old ones to save new work.');
    }

    const carouselData = {
      userId,
      title,
      templateType,
      theme: JSON.stringify(theme), // Appwrite stores as string
      slides: JSON.stringify(slides),
      presetId: presetId || null,
      isPublic,
      format,
      selectedPattern,
      patternOpacity,
      branding: JSON.stringify(branding), // Store branding as JSON string
    };

    const document = await databases.createDocument(
      config.databaseId,
      config.carouselsCollectionId,
      ID.unique(),
      carouselData
    );

    console.log('[createCarousel] Successfully saved carousel:', document.$id);

    // Parse JSON strings back to objects
    const carousel: Carousel = {
      ...document,
      theme: JSON.parse(document.theme as string),
      slides: JSON.parse(document.slides as string),
      branding: JSON.parse(document.branding as string),
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
      presetId: document.presetId,
      isPublic: document.isPublic,
      format: (document.format as 'portrait' | 'square') || 'portrait',
      selectedPattern: document.selectedPattern || 1,
      patternOpacity: document.patternOpacity || 0.2,
    };

    // Update user analytics (non-blocking)
    incrementCarouselCount(userId, templateType);

    return { data: carousel, error: null };
  } catch (error: any) {
    console.error('[createCarousel] Error:', error);
    return { data: null, error };
  }
};

/**
 * Increment user's carousel generation count (non-blocking)
 */
const incrementCarouselCount = async (userId: string, templateType: string) => {
  setTimeout(async () => {
    try {
      // Try to get existing analytics
      const { documents } = await databases.listDocuments(
        config.databaseId,
        config.analyticsCollectionId,
        [Query.equal('userId', userId)]
      );

      if (documents.length > 0) {
        // Update existing
        const analytics = documents[0];
        const templatesUsed = JSON.parse(analytics.templatesUsed as string || '{}');
        templatesUsed[templateType] = (templatesUsed[templateType] || 0) + 1;

        await databases.updateDocument(
          config.databaseId,
          config.analyticsCollectionId,
          analytics.$id,
          {
            carouselsGenerated: analytics.carouselsGenerated + 1,
            templatesUsed: JSON.stringify(templatesUsed),
            lastGenerationAt: new Date().toISOString(),
          }
        );
      } else {
        // Create new analytics
        const templatesUsed = { [templateType]: 1 };

        await databases.createDocument(
          config.databaseId,
          config.analyticsCollectionId,
          ID.unique(),
          {
            userId,
            carouselsGenerated: 1,
            templatesUsed: JSON.stringify(templatesUsed),
            lastGenerationAt: new Date().toISOString(),
          }
        );
      }
    } catch (error) {
      console.warn('Error updating analytics (non-critical):', error);
    }
  }, 0);
};

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all carousels for a user
 */
export const getUserCarousels = async (
  userId: string
): Promise<{ data: Carousel[] | null; error: any }> => {
  try {
    // Validate userId
    if (!userId) {
      console.error('getUserCarousels: userId is required');
      return { data: [], error: null };
    }

    const { documents } = await databases.listDocuments(
      config.databaseId,
      config.carouselsCollectionId,
      [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt')
      ]
    );

    const carousels: Carousel[] = documents.map(doc => ({
      ...doc,
      theme: JSON.parse(doc.theme as string),
      slides: JSON.parse(doc.slides as string),
      branding: JSON.parse(doc.branding as string || '{}'),
      userId: doc.userId,
      title: doc.title,
      templateType: doc.templateType as 'template1' | 'template2',
      presetId: doc.presetId,
      isPublic: doc.isPublic,
      format: (doc.format as 'portrait' | 'square') || 'portrait',
      selectedPattern: doc.selectedPattern || 1,
      patternOpacity: doc.patternOpacity || 0.2,
    }));

    return { data: carousels, error: null };
  } catch (error: any) {
    console.error('Error fetching user carousels:', error);
    return { data: null, error };
  }
};

/**
 * Get a single carousel by ID
 */
export const getCarouselById = async (
  carouselId: string
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    const document = await databases.getDocument(
      config.databaseId,
      config.carouselsCollectionId,
      carouselId
    );

    const carousel: Carousel = {
      ...document,
      theme: JSON.parse(document.theme as string),
      slides: JSON.parse(document.slides as string),
      branding: JSON.parse(document.branding as string || '{}'),
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
      presetId: document.presetId,
      isPublic: document.isPublic,
      format: (document.format as 'portrait' | 'square') || 'portrait',
      selectedPattern: document.selectedPattern || 1,
      patternOpacity: document.patternOpacity || 0.2,
    };

    return { data: carousel, error: null };
  } catch (error: any) {
    console.error('Error fetching carousel:', error);
    return { data: null, error };
  }
};

/**
 * Search user's carousels by title
 */
export const searchUserCarousels = async (
  userId: string,
  searchQuery: string
): Promise<{ data: Carousel[] | null; error: any }> => {
  try {
    const { documents } = await databases.listDocuments(
      config.databaseId,
      config.carouselsCollectionId,
      [
        Query.equal('userId', userId),
        Query.search('title', searchQuery),
        Query.orderDesc('$createdAt')
      ]
    );

    const carousels: Carousel[] = documents.map(doc => ({
      ...doc,
      theme: JSON.parse(doc.theme as string),
      slides: JSON.parse(doc.slides as string),
      branding: JSON.parse(doc.branding as string || '{}'),
      userId: doc.userId,
      title: doc.title,
      templateType: doc.templateType as 'template1' | 'template2',
      presetId: doc.presetId,
      isPublic: doc.isPublic,
      format: (doc.format as 'portrait' | 'square') || 'portrait',
      selectedPattern: doc.selectedPattern || 1,
      patternOpacity: doc.patternOpacity || 0.2,
    }));

    return { data: carousels, error: null };
  } catch (error: any) {
    console.error('Error searching carousels:', error);
    return { data: null, error };
  }
};

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Update an existing carousel
 */
export const updateCarousel = async (
  carouselId: string,
  updates: Partial<CarouselData>
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    // Serialize JSON fields
    const updateData: any = { ...updates };
    if (updates.theme) updateData.theme = JSON.stringify(updates.theme);
    if (updates.slides) updateData.slides = JSON.stringify(updates.slides);
    if (updates.branding) updateData.branding = JSON.stringify(updates.branding);

    const document = await databases.updateDocument(
      config.databaseId,
      config.carouselsCollectionId,
      carouselId,
      updateData
    );

    const carousel: Carousel = {
      ...document,
      theme: JSON.parse(document.theme as string),
      slides: JSON.parse(document.slides as string),
      branding: JSON.parse(document.branding as string || '{}'),
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
      presetId: document.presetId,
      isPublic: document.isPublic,
      format: (document.format as 'portrait' | 'square') || 'portrait',
      selectedPattern: document.selectedPattern || 1,
      patternOpacity: document.patternOpacity || 0.2,
    };

    return { data: carousel, error: null };
  } catch (error: any) {
    console.error('Error updating carousel:', error);
    return { data: null, error };
  }
};

/**
 * Update carousel title only
 */
export const updateCarouselTitle = async (
  carouselId: string,
  newTitle: string
): Promise<{ data: Carousel | null; error: any }> => {
  return updateCarousel(carouselId, { title: newTitle });
};

/**
 * Update carousel content (theme, slides, pattern, branding, template, preset, format)
 */
export const updateCarouselContent = async (
  carouselId: string,
  theme: any,
  slides: any[],
  selectedPattern?: number,
  patternOpacity?: number,
  branding?: BrandingConfig,
  templateType?: 'template1' | 'template2',
  presetId?: string | null,
  format?: 'portrait' | 'square'
): Promise<{ data: Carousel | null; error: any }> => {
  const updates: Partial<CarouselData> = { theme, slides };
  if (selectedPattern !== undefined) updates.selectedPattern = selectedPattern;
  if (patternOpacity !== undefined) updates.patternOpacity = patternOpacity;
  if (branding !== undefined) updates.branding = branding;
  if (templateType !== undefined) updates.templateType = templateType;
  if (presetId !== undefined) updates.presetId = presetId;
  if (format !== undefined) updates.format = format;
  return updateCarousel(carouselId, updates);
};

/**
 * Toggle carousel public status
 */
export const toggleCarouselPublic = async (
  carouselId: string,
  isPublic: boolean
): Promise<{ data: Carousel | null; error: any }> => {
  return updateCarousel(carouselId, { isPublic });
};

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

/**
 * Delete a carousel
 */
export const deleteCarousel = async (
  carouselId: string
): Promise<{ error: any }> => {
  try {
    await databases.deleteDocument(
      config.databaseId,
      config.carouselsCollectionId,
      carouselId
    );

    return { error: null };
  } catch (error: any) {
    console.error('Error deleting carousel:', error);
    return { error };
  }
};

/**
 * Delete multiple carousels
 */
export const deleteCarousels = async (
  carouselIds: string[]
): Promise<{ error: any }> => {
  try {
    await Promise.all(
      carouselIds.map(id =>
        databases.deleteDocument(
          config.databaseId,
          config.carouselsCollectionId,
          id
        )
      )
    );

    return { error: null };
  } catch (error: any) {
    console.error('Error deleting carousels:', error);
    return { error };
  }
};

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Get user analytics
 */
export const getUserAnalytics = async (userId: string) => {
  try {
    const { documents } = await databases.listDocuments(
      config.databaseId,
      config.analyticsCollectionId,
      [Query.equal('userId', userId)]
    );

    if (documents.length > 0) {
      const analytics = documents[0];
      return {
        data: {
          ...analytics,
          templatesUsed: JSON.parse(analytics.templatesUsed as string || '{}'),
        },
        error: null,
      };
    }

    return { data: null, error: null };
  } catch (error: any) {
    console.error('Error fetching user analytics:', error);
    return { data: null, error };
  }
};

/**
 * Duplicate a carousel
 */
export const duplicateCarousel = async (
  carouselId: string,
  userId: string
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    const { data: original, error: fetchError } = await getCarouselById(carouselId);

    if (fetchError || !original) {
      return { data: null, error: fetchError };
    }

    const newTitle = `${original.title} (Copy)`;
    const { data, error } = await createCarousel(
      userId,
      newTitle,
      original.templateType,
      original.theme,
      original.slides,
      false,
      original.presetId
    );

    return { data, error };
  } catch (error: any) {
    console.error('Error duplicating carousel:', error);
    return { data: null, error };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createCarousel,
  getUserCarousels,
  getCarouselById,
  searchUserCarousels,
  updateCarousel,
  updateCarouselTitle,
  updateCarouselContent,
  toggleCarouselPublic,
  deleteCarousel,
  deleteCarousels,
  getUserAnalytics,
  duplicateCarousel,
  checkCarouselLimit,
};
