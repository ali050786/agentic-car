/**
 * Analytics Service - Phase 6 (FIXED)
 * 
 * Handles view tracking and analytics for carousels.
 * Pure TypeScript service - no React components.
 * 
 * Location: src/services/analyticsService.ts
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Track a carousel view
 */
export const trackCarouselView = async (carouselId: string): Promise<void> => {
  try {
    // Increment view count
    const { error: incrementError } = await supabase.rpc('increment_carousel_views', {
      carousel_uuid: carouselId
    });

    if (incrementError) {
      console.error('Error incrementing view count:', incrementError);
    }

    // Log detailed view record
    const viewData: any = {
      carousel_id: carouselId,
      viewed_at: new Date().toISOString(),
    };

    // Get device info
    if (typeof window !== 'undefined') {
      viewData.viewer_device = /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop';
      viewData.referrer = document.referrer || 'direct';
    }

    const { error: insertError } = await supabase
      .from('carousel_views')
      .insert(viewData);

    if (insertError) {
      console.error('Error logging view:', insertError);
    }
  } catch (error) {
    console.error('Error in trackCarouselView:', error);
  }
};

/**
 * Get view analytics for a carousel
 */
export const getCarouselAnalytics = async (carouselId: string) => {
  try {
    const { data, error } = await supabase
      .from('carousel_views')
      .select('*')
      .eq('carousel_id', carouselId)
      .order('viewed_at', { ascending: false });

    if (error) {
      console.error('Error fetching analytics:', error);
      return { data: null, error };
    }

    // Calculate stats
    const totalViews = data.length;
    const mobileViews = data.filter(v => v.viewer_device === 'mobile').length;
    const desktopViews = data.filter(v => v.viewer_device === 'desktop').length;

    // Group by date
    const viewsByDate: { [key: string]: number } = {};
    data.forEach(view => {
      const date = new Date(view.viewed_at).toLocaleDateString();
      viewsByDate[date] = (viewsByDate[date] || 0) + 1;
    });

    return {
      data: {
        totalViews,
        mobileViews,
        desktopViews,
        viewsByDate,
        recentViews: data.slice(0, 10),
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in getCarouselAnalytics:', error);
    return { data: null, error };
  }
};

/**
 * Get analytics for all user's carousels
 */
export const getUserCarouselsAnalytics = async (userId: string) => {
  try {
    // Get user's carousels with view counts
    const { data, error } = await supabase
      .from('carousels')
      .select('id, title, views, created_at')
      .eq('user_id', userId)
      .order('views', { ascending: false });

    if (error) {
      console.error('Error fetching user analytics:', error);
      return { data: null, error };
    }

    const totalViews = data.reduce((sum, c) => sum + (c.views || 0), 0);
    const totalCarousels = data.length;

    return {
      data: {
        totalViews,
        totalCarousels,
        carousels: data,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in getUserCarouselsAnalytics:', error);
    return { data: null, error };
  }
};

export default {
  trackCarouselView,
  getCarouselAnalytics,
  getUserCarouselsAnalytics,
};