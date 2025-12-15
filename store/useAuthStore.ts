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

  // Actions
  initialize: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<AuthResponse>;
  signIn: (data: SignInData) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  refreshSession: () => Promise<void>;
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
    } catch (error) {
      console.error('Error refreshing session:', error);
      set({ user: null });
    }
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