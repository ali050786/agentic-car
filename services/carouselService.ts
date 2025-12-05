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

export interface CarouselData {
  userId: string;
  title: string;
  templateType: 'template1' | 'template2';
  theme: any;
  slides: any[];
  presetId: string | null;
  isPublic: boolean;
}

export interface Carousel extends CarouselData {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
}

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
  presetId: string | null = null
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    console.log('[createCarousel] Starting save...', { userId, title, templateType });

    const carouselData = {
      userId,
      title,
      templateType,
      theme: JSON.stringify(theme), // Appwrite stores as string
      slides: JSON.stringify(slides),
      presetId: presetId || null,
      isPublic,
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
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
      presetId: document.presetId,
      isPublic: document.isPublic,
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
      userId: doc.userId,
      title: doc.title,
      templateType: doc.templateType as 'template1' | 'template2',
      presetId: doc.presetId,
      isPublic: doc.isPublic,
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
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
      presetId: document.presetId,
      isPublic: document.isPublic,
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
      userId: doc.userId,
      title: doc.title,
      templateType: doc.templateType as 'template1' | 'template2',
      presetId: doc.presetId,
      isPublic: doc.isPublic,
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
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
      presetId: document.presetId,
      isPublic: document.isPublic,
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
 * Update carousel content (theme and slides)
 */
export const updateCarouselContent = async (
  carouselId: string,
  theme: any,
  slides: any[]
): Promise<{ data: Carousel | null; error: any }> => {
  return updateCarousel(carouselId, { theme, slides });
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
};
