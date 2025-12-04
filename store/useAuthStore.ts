/**
 * Authentication Store
 * 
 * Manages user authentication state and operations using Zustand.
 * Handles login, signup, logout, and session management.
 * 
 * Location: src/store/useAuthStore.ts
 */

import { create } from 'zustand';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, Profile, SignUpData, SignInData, AuthResponse } from '../lib/supabaseClient';

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<AuthResponse>;
  signIn: (data: SignInData) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signInWithGitHub: () => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  updateProfile: (updates: Partial<Profile>) => Promise<AuthResponse>;
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
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  // ============================================================================
  // INITIALIZE - Setup auth and listen for changes
  // ============================================================================
  
  initialize: async () => {
    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        set({ loading: false, initialized: true });
        return;
      }

      if (session?.user) {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        set({ 
          user: session.user, 
          session, 
          profile: profile || null,
          loading: false,
          initialized: true
        });
      } else {
        set({ 
          user: null, 
          session: null, 
          profile: null,
          loading: false,
          initialized: true
        });
      }

      // Listen to auth changes
      supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
        console.log('Auth state changed:', event);

        if (session?.user) {
          // Fetch updated profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          set({ 
            user: session.user, 
            session, 
            profile: profile || null,
            loading: false
          });
        } else {
          set({ 
            user: null, 
            session: null, 
            profile: null,
            loading: false
          });
        }

        // Handle specific events
        if (event === 'SIGNED_OUT') {
          // Clear any cached data
          set({ user: null, session: null, profile: null });
        }
      });

    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ loading: false, initialized: true });
    }
  },

  // ============================================================================
  // SIGN UP - Create new user account
  // ============================================================================
  
  signUp: async ({ email, password, fullName }: SignUpData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { 
          error: { message: error.message, status: error.status },
          success: false 
        };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          error: null,
          success: true,
          // Note: User needs to verify email before they can sign in
        };
      }

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { 
          error: { message: error.message, status: error.status },
          success: false 
        };
      }

      return { error: null, success: true };
    } catch (error: any) {
      return { 
        error: { message: error.message || 'An error occurred during sign in' },
        success: false 
      };
    }
  },

  // ============================================================================
  // SIGN IN WITH GOOGLE - OAuth authentication
  // ============================================================================
  
  signInWithGoogle: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { 
          error: { message: error.message },
          success: false 
        };
      }

      return { error: null, success: true };
    } catch (error: any) {
      return { 
        error: { message: error.message || 'An error occurred during Google sign in' },
        success: false 
      };
    }
  },

  // ============================================================================
  // SIGN IN WITH GITHUB - OAuth authentication
  // ============================================================================
  
  signInWithGitHub: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { 
          error: { message: error.message },
          success: false 
        };
      }

      return { error: null, success: true };
    } catch (error: any) {
      return { 
        error: { message: error.message || 'An error occurred during GitHub sign in' },
        success: false 
      };
    }
  },

  // ============================================================================
  // SIGN OUT - End user session
  // ============================================================================
  
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
      }
      
      // Clear state regardless of error
      set({ user: null, session: null, profile: null });
    } catch (error) {
      console.error('Sign out error:', error);
      // Clear state even on error
      set({ user: null, session: null, profile: null });
    }
  },

  // ============================================================================
  // RESET PASSWORD - Send password reset email
  // ============================================================================
  
  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return { 
          error: { message: error.message },
          success: false 
        };
      }

      return { error: null, success: true };
    } catch (error: any) {
      return { 
        error: { message: error.message || 'An error occurred sending reset email' },
        success: false 
      };
    }
  },

  // ============================================================================
  // UPDATE PASSWORD - Change user password
  // ============================================================================
  
  updatePassword: async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { 
          error: { message: error.message },
          success: false 
        };
      }

      return { error: null, success: true };
    } catch (error: any) {
      return { 
        error: { message: error.message || 'An error occurred updating password' },
        success: false 
      };
    }
  },

  // ============================================================================
  // UPDATE PROFILE - Update user profile information
  // ============================================================================
  
  updateProfile: async (updates: Partial<Profile>) => {
    const { user } = get();
    
    if (!user) {
      return { 
        error: { message: 'Not authenticated' },
        success: false 
      };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { 
          error: { message: error.message },
          success: false 
        };
      }

      // Fetch updated profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        set({ profile });
      }

      return { error: null, success: true };
    } catch (error: any) {
      return { 
        error: { message: error.message || 'An error occurred updating profile' },
        success: false 
      };
    }
  },

  // ============================================================================
  // REFRESH SESSION - Manually refresh the session
  // ============================================================================
  
  refreshSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return;
      }

      if (session) {
        set({ session });
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
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
    profile: state.profile,
    loading: state.loading,
  }));
};

/**
 * Hook for auth loading state
 */
export const useAuthLoading = () => {
  return useAuthStore(state => state.loading);
};