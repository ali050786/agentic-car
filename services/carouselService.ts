/**
 * Carousel Database Service - Appwrite
 * 
 * All database operations for carousels using Appwrite.
 * 
 * Location: src/services/carouselService.ts
 */

import { databases, config, ID } from '../lib/appwriteClient';
import { Query } from 'appwrite';
import { BrandKit, BrandMode, SignaturePosition } from '../types';

// ============================================================================
// TYPES
// ============================================================================

// Legacy type for backward compatibility
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
  isPublic: boolean;
  format: 'portrait' | 'square';
  selectedPattern: number;
  patternOpacity: number;
  // New Brand Kit fields
  brandMode: BrandMode;
  presetId: string;
  brandKit: BrandKit;
  signaturePosition: SignaturePosition;
  // Legacy field for backward compatibility
  branding?: BrandingConfig;
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
  brandMode: BrandMode = 'preset',
  presetId: string = 'ocean-tech',
  brandKit: BrandKit = {
    enabled: true,
    identity: { name: '', title: '', imageUrl: '' },
    colors: { primary: '#0EA5E9', secondary: '#06B6D4', text: '#E0F2FE', background: '#0C4A6E' }
  },
  signaturePosition: SignaturePosition = 'bottom-left',
  format: 'portrait' | 'square' = 'portrait',
  selectedPattern: number = 1,
  patternOpacity: number = 0.2
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    console.log('[createCarousel] Starting save...', { userId, title, templateType });

    // Check carousel limit before creating
    const limitReached = await checkCarouselLimit(userId);
    if (limitReached) {
      console.warn('[createCarousel] User has reached carousel limit');
      throw new StorageLimitError('You have reached the maximum of 5 carousels. Please delete old ones to save new work.');
    }

    // Store brand kit in existing branding field (extended format)
    const extendedBranding = {
      // Keep old fields for backward compatibility
      enabled: brandKit.enabled,
      name: brandKit.identity.name,
      title: brandKit.identity.title,
      imageUrl: brandKit.identity.imageUrl,
      position: signaturePosition,
      // New brand kit fields
      brandMode,
      presetId,
      colors: brandKit.colors
    };

    const carouselData = {
      userId,
      title,
      templateType,
      theme: JSON.stringify(theme),
      slides: JSON.stringify(slides),
      presetId,
      isPublic,
      format,
      selectedPattern,
      patternOpacity,
      branding: JSON.stringify(extendedBranding),
    };

    const document = await databases.createDocument(
      config.databaseId,
      config.carouselsCollectionId,
      ID.unique(),
      carouselData
    );

    console.log('[createCarousel] Successfully saved carousel:', document.$id);

    // Parse branding with brand kit data
    const parsedBranding = JSON.parse(document.branding as string || '{}');

    const carousel: Carousel = {
      ...document,
      theme: JSON.parse(document.theme as string),
      slides: JSON.parse(document.slides as string),
      brandMode: (parsedBranding.brandMode as BrandMode) || 'preset',
      presetId: parsedBranding.presetId || document.presetId || 'ocean-tech',
      brandKit: {
        enabled: parsedBranding.enabled !== undefined ? parsedBranding.enabled : true,
        identity: {
          name: parsedBranding.name || '',
          title: parsedBranding.title || '',
          imageUrl: parsedBranding.imageUrl || ''
        },
        colors: parsedBranding.colors || {
          primary: '#0EA5E9',
          secondary: '#06B6D4',
          text: '#E0F2FE',
          background: '#0C4A6E'
        }
      },
      signaturePosition: (parsedBranding.position as SignaturePosition) || 'bottom-left',
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
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

    const carousels: Carousel[] = documents.map(doc => {
      // Backward compatibility: migrate old branding to brandKit if needed
      let brandMode: BrandMode = (doc.brandMode as BrandMode) || 'preset';
      let brandKit: BrandKit;
      let signaturePosition: SignaturePosition = (doc.signaturePosition as SignaturePosition) || 'bottom-left';

      if (doc.brandKit) {
        brandKit = JSON.parse(doc.brandKit as string);
      } else if (doc.branding) {
        // Migrate old branding format
        const oldBranding = JSON.parse(doc.branding as string);
        brandKit = {
          enabled: oldBranding.enabled,
          identity: {
            name: oldBranding.name || '',
            title: oldBranding.title || '',
            imageUrl: oldBranding.imageUrl || ''
          },
          colors: {
            primary: '#0EA5E9',
            secondary: '#06B6D4',
            text: '#E0F2FE',
            background: '#0C4A6E'
          }
        };
        signaturePosition = oldBranding.position || 'bottom-left';
        brandMode = 'preset'; // Default to preset for migrated carousels
      } else {
        // Fallback defaults
        brandKit = {
          enabled: true,
          identity: { name: '', title: '', imageUrl: '' },
          colors: { primary: '#0EA5E9', secondary: '#06B6D4', text: '#E0F2FE', background: '#0C4A6E' }
        };
      }

      return {
        ...doc,
        theme: JSON.parse(doc.theme as string),
        slides: JSON.parse(doc.slides as string),
        brandMode,
        presetId: doc.presetId || 'ocean-tech',
        brandKit,
        signaturePosition,
        userId: doc.userId,
        title: doc.title,
        templateType: doc.templateType as 'template1' | 'template2',
        isPublic: doc.isPublic,
        format: (doc.format as 'portrait' | 'square') || 'portrait',
        selectedPattern: doc.selectedPattern || 1,
        patternOpacity: doc.patternOpacity || 0.2,
      };
    });

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

    // Parse branding with brand kit data
    const parsedBranding = JSON.parse(document.branding as string || '{}');

    const carousel: Carousel = {
      ...document,
      theme: JSON.parse(document.theme as string),
      slides: JSON.parse(document.slides as string),
      brandMode: (parsedBranding.brandMode as BrandMode) || 'preset',
      presetId: parsedBranding.presetId || document.presetId || 'ocean-tech',
      brandKit: {
        enabled: parsedBranding.enabled !== undefined ? parsedBranding.enabled : true,
        identity: {
          name: parsedBranding.name || '',
          title: parsedBranding.title || '',
          imageUrl: parsedBranding.imageUrl || ''
        },
        colors: parsedBranding.colors || {
          primary: '#0EA5E9',
          secondary: '#06B6D4',
          text: '#E0F2FE',
          background: '#0C4A6E'
        }
      },
      signaturePosition: (parsedBranding.position as SignaturePosition) || 'bottom-left',
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
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

    const carousels: Carousel[] = documents.map(doc => {
      // Parse extended branding format
      const parsedBranding = JSON.parse(doc.branding as string || '{}');

      return {
        ...doc,
        theme: JSON.parse(doc.theme as string),
        slides: JSON.parse(doc.slides as string),
        brandMode: (parsedBranding.brandMode as BrandMode) || 'preset',
        presetId: parsedBranding.presetId || doc.presetId || 'ocean-tech',
        brandKit: {
          enabled: parsedBranding.enabled !== undefined ? parsedBranding.enabled : true,
          identity: {
            name: parsedBranding.name || '',
            title: parsedBranding.title || '',
            imageUrl: parsedBranding.imageUrl || ''
          },
          colors: parsedBranding.colors || {
            primary: '#0EA5E9',
            secondary: '#06B6D4',
            text: '#E0F2FE',
            background: '#0C4A6E'
          }
        },
        signaturePosition: (parsedBranding.position as SignaturePosition) || 'bottom-left',
        userId: doc.userId,
        title: doc.title,
        templateType: doc.templateType as 'template1' | 'template2',
        isPublic: doc.isPublic,
        format: (doc.format as 'portrait' | 'square') || 'portrait',
        selectedPattern: doc.selectedPattern || 1,
        patternOpacity: doc.patternOpacity || 0.2,
      };
    });

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

    // Convert brand kit to extended branding format
    if (updates.brandKit || updates.brandMode || updates.signaturePosition) {
      const extendedBranding: any = {};
      if (updates.brandKit) {
        extendedBranding.enabled = updates.brandKit.enabled;
        extendedBranding.name = updates.brandKit.identity.name;
        extendedBranding.title = updates.brandKit.identity.title;
        extendedBranding.imageUrl = updates.brandKit.identity.imageUrl;
        extendedBranding.colors = updates.brandKit.colors;
      }
      if (updates.brandMode) extendedBranding.brandMode = updates.brandMode;
      if (updates.presetId) extendedBranding.presetId = updates.presetId;
      if (updates.signaturePosition) extendedBranding.position = updates.signaturePosition;

      updateData.branding = JSON.stringify(extendedBranding);
      // Remove the separate fields since we're storing in branding
      delete updateData.brandKit;
      delete updateData.brandMode;
      delete updateData.signaturePosition;
    }

    const document = await databases.updateDocument(
      config.databaseId,
      config.carouselsCollectionId,
      carouselId,
      updateData
    );

    // Parse document with backward compatibility
    let brandMode: BrandMode = (document.brandMode as BrandMode) || 'preset';
    let brandKit: BrandKit;
    let signaturePosition: SignaturePosition = (document.signaturePosition as SignaturePosition) || 'bottom-left';

    if (document.brandKit) {
      brandKit = JSON.parse(document.brandKit as string);
    } else if (document.branding) {
      const oldBranding = JSON.parse(document.branding as string || '{}');
      brandKit = {
        enabled: oldBranding.enabled || true,
        identity: {
          name: oldBranding.name || '',
          title: oldBranding.title || '',
          imageUrl: oldBranding.imageUrl || ''
        },
        colors: {
          primary: '#0EA5E9',
          secondary: '#06B6D4',
          text: '#E0F2FE',
          background: '#0C4A6E'
        }
      };
      signaturePosition = oldBranding.position || 'bottom-left';
    } else {
      brandKit = {
        enabled: true,
        identity: { name: '', title: '', imageUrl: '' },
        colors: { primary: '#0EA5E9', secondary: '#06B6D4', text: '#E0F2FE', background: '#0C4A6E' }
      };
    }

    const carousel: Carousel = {
      ...document,
      theme: JSON.parse(document.theme as string),
      slides: JSON.parse(document.slides as string),
      brandMode,
      presetId: document.presetId || 'ocean-tech',
      brandKit,
      signaturePosition,
      userId: document.userId,
      title: document.title,
      templateType: document.templateType as 'template1' | 'template2',
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
 * Update carousel content (theme, slides, pattern, brand kit, template, format)
 */
export const updateCarouselContent = async (
  carouselId: string,
  theme: any,
  slides: any[],
  brandMode: BrandMode,
  presetId: string,
  brandKit: BrandKit,
  signaturePosition: SignaturePosition,
  selectedPattern?: number,
  patternOpacity?: number,
  templateType?: 'template1' | 'template2',
  format?: 'portrait' | 'square'
): Promise<{ data: Carousel | null; error: any }> => {
  const updates: Partial<CarouselData> = {
    theme,
    slides,
    brandMode,
    presetId,
    brandKit,
    signaturePosition
  };
  if (selectedPattern !== undefined) updates.selectedPattern = selectedPattern;
  if (patternOpacity !== undefined) updates.patternOpacity = patternOpacity;
  if (templateType !== undefined) updates.templateType = templateType;
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
