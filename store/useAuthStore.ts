/**
 * Authentication Store - Appwrite
 * 
 * Manages user authentication state and operations using Zustand + Appwrite.
 * Handles login, signup, logout, and session management.
 * 
 * Location: src/store/useAuthStore.ts
 */

import { create } from 'zustand';
import { account, AppwriteUser } from '../lib/appwriteClient';
import { Models, OAuthProvider } from 'appwrite';
import { BrandKit } from '../types';
import { getUserBrandKit, updateUserBrandKit, initializeDefaultBrandKit, getFreeUsageCount } from '../services/profileService';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthResponse {
  error: { message: string; status?: number } | null;
  success: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface AuthState {
  // State
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  initialized: boolean;

  /**
   * Global brand kit from user profile
   * null = not yet fetched, or user has no global brand
   */
  globalBrandKit: BrandKit | null;
  brandKitLoading: boolean;

  /**
   * User's API key for BYOK (Bring Your Own Key)
   * Stored in localStorage for persistence
   */
  userApiKey: string | null;
  apiKeyProvider: 'openrouter' | 'openai' | 'anthropic' | null;

  /**
   * Free tier usage tracking
   */
  freeUsageCount: number;
  freeUsageLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<AuthResponse>;
  signIn: (data: SignInData) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  refreshSession: () => Promise<void>;

  /**
   * Fetch global brand kit from profile
   */
  fetchGlobalBrandKit: () => Promise<void>;

  /**
   * Update global brand kit in profile
   */
  updateGlobalBrandKit: (brandKit: BrandKit) => Promise<void>;

  /**
   * API Key Management (BYOK)
   */
  setUserApiKey: (key: string, provider: 'openrouter' | 'openai' | 'anthropic') => void;
  clearUserApiKey: () => void;

  /**
   * Free usage tracking
   */
  fetchFreeUsageCount: () => Promise<void>;
  refreshFreeUsageCount: () => Promise<void>;
}

// ============================================================================
// CREATE STORE
// ============================================================================

export const useAuthStore = create<AuthState>((set, get) => ({
  // ============================================================================
  // INITIAL STATE
  // ============================================================================

  user: null,
  loading: true,
  initialized: false,
  globalBrandKit: null,
  brandKitLoading: false,
  userApiKey: typeof window !== 'undefined' ? localStorage.getItem('user_api_key') : null,
  apiKeyProvider: typeof window !== 'undefined' ? localStorage.getItem('api_key_provider') as any : null,
  freeUsageCount: 0,
  freeUsageLoading: false,

  // ============================================================================
  // INITIALIZE - Setup auth and get current session
  // ============================================================================

  initialize: async () => {
    try {
      // Try to get current user
      const user = await account.get();

      set({
        user,
        loading: false,
        initialized: true
      });

      // Fetch global brand kit in background
      get().fetchGlobalBrandKit();

      // Fetch free usage count in background
      get().fetchFreeUsageCount();
    } catch (error) {
      // No active session
      set({
        user: null,
        loading: false,
        initialized: true
      });
    }
  },

  // ============================================================================
  // SIGN UP - Create new user account
  // ============================================================================

  signUp: async ({ email, password, fullName }: SignUpData) => {
    try {
      // Create account
      await account.create(
        'unique()', // Appwrite will generate unique ID
        email,
        password,
        fullName
      );

      // Auto sign in after signup
      const session = await account.createEmailPasswordSession(email, password);

      // Get user details
      const user = await account.get();

      set({ user });

      return { error: null, success: true };
    } catch (error: any) {
      return {
        error: { message: error.message || 'An error occurred during sign up' },
        success: false
      };
    }
  },

  // ============================================================================
  // SIGN IN - Authenticate existing user
  // ============================================================================

  signIn: async ({ email, password }: SignInData) => {
    try {
      // Delete any existing session first (Appwrite only allows one session at a time)
      try {
        await account.deleteSession('current');
      } catch {
        // No existing session, that's fine
      }

      // Create email session
      await account.createEmailPasswordSession(email, password);

      // Get user details
      const user = await account.get();

      set({ user });

      // Fetch global brand kit in background
      get().fetchGlobalBrandKit();

      // Fetch free usage count in background
      get().fetchFreeUsageCount();

      return { error: null, success: true };
    } catch (error: any) {
      return {
        error: { message: error.message || 'An error occurred during sign in' },
        success: false
      };
    }
  },

  // ============================================================================
  // GOOGLE OAUTH - Sign in with Google
  // ============================================================================

  signInWithGoogle: async () => {
    try {
      // Get current URL for redirect
      const currentUrl = window.location.origin;
      const successUrl = `${currentUrl}/auth/callback`;
      const failureUrl = `${currentUrl}/login?error=oauth_failed`;

      // Create OAuth2 session with Google
      account.createOAuth2Session(
        OAuthProvider.Google,
        successUrl,
        failureUrl
      );

      // The redirect happens automatically, so we return success
      // The actual auth state will be updated after redirect
      return { error: null, success: true };
    } catch (error: any) {
      return {
        error: { message: error.message || 'An error occurred with Google sign in' },
        success: false
      };
    }
  },

  // ============================================================================
  // SIGN OUT - End user session
  // ============================================================================

  signOut: async () => {
    try {
      await account.deleteSession('current');
      set({ user: null });
    } catch (error) {
      console.error('Sign out error:', error);
      // Clear state even on error
      set({ user: null });
    }
  },

  // ============================================================================
  // UPDATE PASSWORD - Change user password
  // ============================================================================

  updatePassword: async (newPassword: string) => {
    try {
      const currentPassword = prompt('Enter your current password:');

      if (!currentPassword) {
        return {
          error: { message: 'Current password is required' },
          success: false
        };
      }

      await account.updatePassword(newPassword, currentPassword);

      return { error: null, success: true };
    } catch (error: any) {
      return {
        error: { message: error.message || 'An error occurred updating password' },
        success: false
      };
    }
  },

  // ============================================================================
  // REFRESH SESSION - Manually refresh user data
  // ============================================================================

  refreshSession: async () => {
    try {
      const user = await account.get();
      set({ user });

      // Refresh brand kit too
      get().fetchGlobalBrandKit();
    } catch (error) {
      console.error('Error refreshing session:', error);
      set({ user: null });
    }
  },

  // ============================================================================
  // BRAND KIT MANAGEMENT
  // ============================================================================

  /**
   * Fetch global brand kit from user profile
   */
  fetchGlobalBrandKit: async () => {
    const { user } = get();
    if (!user) {
      console.log('[AuthStore] No user, skipping brand kit fetch');
      return;
    }

    set({ brandKitLoading: true });

    try {
      const brandKit = await getUserBrandKit(user.$id);

      if (brandKit) {
        set({ globalBrandKit: brandKit, brandKitLoading: false });
        console.log('[AuthStore] Global brand kit fetched successfully');
      } else {
        // No brand kit exists, initialize with defaults
        console.log('[AuthStore] No brand kit found, initializing defaults');
        const defaultBrandKit = await initializeDefaultBrandKit(user.$id, user.name || user.email);
        set({ globalBrandKit: defaultBrandKit, brandKitLoading: false });
      }
    } catch (error) {
      console.error('[AuthStore] Failed to fetch brand kit:', error);
      set({ brandKitLoading: false });
    }
  },

  /**
   * Update global brand kit and save to profile
   */
  updateGlobalBrandKit: async (brandKit: BrandKit) => {
    const { user } = get();
    if (!user) {
      throw new Error('No user logged in');
    }

    set({ brandKitLoading: true });

    try {
      await updateUserBrandKit(user.$id, brandKit);
      set({ globalBrandKit: brandKit, brandKitLoading: false });
      console.log('[AuthStore] Global brand kit updated successfully');
    } catch (error) {
      set({ brandKitLoading: false });
      console.error('[AuthStore] Failed to update brand kit:', error);
      throw error;
    }
  },

  // ============================================================================
  // API KEY MANAGEMENT (BYOK)
  // ============================================================================

  /**
   * Save user's API key to localStorage and state
   */
  setUserApiKey: (key: string, provider: 'openrouter' | 'openai' | 'anthropic') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_api_key', key);
      localStorage.setItem('api_key_provider', provider);
    }
    set({ userApiKey: key, apiKeyProvider: provider });
    console.log(`[AuthStore] User API key saved (${provider})`);
  },

  /**
   * Clear user's API key from localStorage and state
   */
  clearUserApiKey: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_api_key');
      localStorage.removeItem('api_key_provider');
    }
    set({ userApiKey: null, apiKeyProvider: null });
    console.log('[AuthStore] User API key cleared');
  },

  // ============================================================================
  // FREE USAGE TRACKING
  // ============================================================================

  /**
   * Fetch free usage count from Appwrite
   */
  fetchFreeUsageCount: async () => {
    const { user } = get();
    if (!user) {
      console.log('[AuthStore] No user, skipping free usage count fetch');
      return;
    }

    set({ freeUsageLoading: true });

    try {
      const count = await getFreeUsageCount(user.$id);
      set({ freeUsageCount: count, freeUsageLoading: false });
      console.log(`[AuthStore] Free usage count: ${count}/3`);
    } catch (error) {
      console.error('[AuthStore] Failed to fetch free usage count:', error);
      set({ freeUsageLoading: false });
    }
  },

  /**
   * Refresh free usage count (alias for fetchFreeUsageCount)
   */
  refreshFreeUsageCount: async () => {
    await get().fetchFreeUsageCount();
  },
}));

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = () => {
  const user = useAuthStore(state => state.user);
  const initialized = useAuthStore(state => state.initialized);
  return { isAuthenticated: !!user, initialized };
};

/**
 * Hook to get current user
 */
export const useCurrentUser = () => {
  return useAuthStore(state => ({
    user: state.user,
    loading: state.loading,
  }));
};

/**
 * Hook for auth loading state
 */
export const useAuthLoading = () => {
  return useAuthStore(state => state.loading);
};