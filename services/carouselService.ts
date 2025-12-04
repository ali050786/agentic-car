/**
 * Carousel Database Service - FIXED VERSION
 * 
 * Updated template types to match database: 'template1' and 'template2'
 * 
 * Location: src/services/carouselService.ts
 */

import { supabase, Carousel, CarouselInsert, CarouselUpdate } from '../lib/supabaseClient';

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

/**
 * Create a new carousel in the database
 */
export const createCarousel = async (
  userId: string,
  title: string,
  templateType: 'template1' | 'template2',  // FIXED: Removed hyphens
  theme: any,
  slides: any[],
  isPublic: boolean = false
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    const carouselData: CarouselInsert = {
      user_id: userId,
      title,
      template_type: templateType,
      theme,
      slides,
      is_public: isPublic,
    };

    const { data, error } = await supabase
      .from('carousels')
      .insert(carouselData)
      .select()
      .single();

    if (error) {
      console.error('Error creating carousel:', error);
      return { data: null, error };
    }

    // Update user analytics
    await incrementCarouselCount(userId, templateType);

    return { data, error: null };
  } catch (error) {
    console.error('Error in createCarousel:', error);
    return { data: null, error };
  }
};

/**
 * Increment user's carousel generation count
 */
const incrementCarouselCount = async (userId: string, templateType: string) => {
  try {
    // Get current analytics
    const { data: analytics } = await supabase
      .from('user_analytics')
      .select('carousels_generated, templates_used')
      .eq('user_id', userId)
      .single();

    if (analytics) {
      const newCount = analytics.carousels_generated + 1;
      const templatesUsed = analytics.templates_used || {};
      const templateCount = (templatesUsed[templateType] || 0) + 1;

      await supabase
        .from('user_analytics')
        .update({
          carousels_generated: newCount,
          templates_used: { ...templatesUsed, [templateType]: templateCount },
          last_generation_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('Error updating analytics:', error);
  }
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
    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user carousels:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getUserCarousels:', error);
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
    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .eq('id', carouselId)
      .single();

    if (error) {
      console.error('Error fetching carousel:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getCarouselById:', error);
    return { data: null, error };
  }
};

/**
 * Get public carousels (for sharing/discovery)
 */
export const getPublicCarousels = async (
  limit: number = 20
): Promise<{ data: Carousel[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching public carousels:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getPublicCarousels:', error);
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
    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', `%${searchQuery}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching carousels:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in searchUserCarousels:', error);
    return { data: null, error };
  }
};

/**
 * Get carousels by template type
 */
export const getCarouselsByTemplate = async (
  userId: string,
  templateType: 'template1' | 'template2'  // FIXED: Removed hyphens
): Promise<{ data: Carousel[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('carousels')
      .select('*')
      .eq('user_id', userId)
      .eq('template_type', templateType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching carousels by template:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getCarouselsByTemplate:', error);
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
  updates: CarouselUpdate
): Promise<{ data: Carousel | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('carousels')
      .update(updates)
      .eq('id', carouselId)
      .select()
      .single();

    if (error) {
      console.error('Error updating carousel:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in updateCarousel:', error);
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
 * Toggle carousel public status
 */
export const toggleCarouselPublic = async (
  carouselId: string,
  isPublic: boolean
): Promise<{ data: Carousel | null; error: any }> => {
  return updateCarousel(carouselId, { is_public: isPublic });
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
    const { error } = await supabase
      .from('carousels')
      .delete()
      .eq('id', carouselId);

    if (error) {
      console.error('Error deleting carousel:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Error in deleteCarousel:', error);
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
    const { error } = await supabase
      .from('carousels')
      .delete()
      .in('id', carouselIds);

    if (error) {
      console.error('Error deleting carousels:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Error in deleteCarousels:', error);
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
    const { data, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user analytics:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getUserAnalytics:', error);
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
    // Get original carousel
    const { data: original, error: fetchError } = await getCarouselById(carouselId);

    if (fetchError || !original) {
      return { data: null, error: fetchError };
    }

    // Create duplicate with "Copy" suffix
    const newTitle = `${original.title} (Copy)`;
    const { data, error } = await createCarousel(
      userId,
      newTitle,
      original.template_type,
      original.theme,
      original.slides,
      false
    );

    return { data, error };
  } catch (error) {
    console.error('Error in duplicateCarousel:', error);
    return { data: null, error };
  }
};

/**
 * Check if user can edit carousel
 */
export const canEditCarousel = async (
  carouselId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('carousels')
      .select('user_id')
      .eq('id', carouselId)
      .single();

    return data?.user_id === userId;
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return false;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Create
  createCarousel,
  
  // Read
  getUserCarousels,
  getCarouselById,
  getPublicCarousels,
  searchUserCarousels,
  getCarouselsByTemplate,
  
  // Update
  updateCarousel,
  updateCarouselTitle,
  toggleCarouselPublic,
  updateCarouselContent,
  
  // Delete
  deleteCarousel,
  deleteCarousels,
  
  // Utility
  getUserAnalytics,
  duplicateCarousel,
  canEditCarousel,
};