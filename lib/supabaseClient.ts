/**
 * Supabase Client Configuration
 * 
 * This file creates and exports the Supabase client instance
 * and TypeScript types for your database tables.
 * 
 * Location: src/lib/supabaseClient.ts
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'are set in your .env.local file.'
  );
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Optional: Configure auth settings
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ============================================================================
// TYPESCRIPT TYPES FOR DATABASE
// ============================================================================

/**
 * User Profile
 * Matches the 'profiles' table structure
 */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Carousel
 * Matches the 'carousels' table structure
 */
export interface Carousel {
  id: string;
  user_id: string;
  title: string;
  template_type: 'template1' | 'template2';
  theme: CarouselTheme;
  slides: SlideContent[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Carousel Theme Configuration
 * Stored in JSONB 'theme' column
 */
export interface CarouselTheme {
  background?: string;
  background2?: string;
  textDefault?: string;
  textHighlight?: string;
  bgGradStart?: string;
  bgGradEnd?: string;
  [key: string]: string | undefined; // Allow additional custom properties
}

/**
 * Slide Content
 * Each slide in the 'slides' JSONB array
 */
export interface SlideContent {
  variant?: 'hero' | 'list' | 'closing' | string;
  preHeader?: string;
  headline?: string;
  headlineHighlight?: string;
  body?: string;
  listItems?: string[];
  [key: string]: any; // Allow additional custom properties
}

/**
 * User Analytics
 * Matches the 'user_analytics' table structure
 */
export interface UserAnalytics {
  id: string;
  user_id: string;
  carousels_generated: number;
  templates_used: TemplateUsage;
  last_generation_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Template Usage Statistics
 * Stored in JSONB 'templates_used' column
 */
export interface TemplateUsage {
  template1?: number;
  template2?: number;
  [key: string]: number | undefined;
}

// ============================================================================
// DATABASE HELPER TYPES
// ============================================================================

/**
 * Database insert types (omit auto-generated fields)
 */
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type CarouselInsert = Omit<Carousel, 'id' | 'created_at' | 'updated_at'>;
export type UserAnalyticsInsert = Omit<UserAnalytics, 'id' | 'created_at' | 'updated_at'>;

/**
 * Database update types (all fields optional except id)
 */
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
export type CarouselUpdate = Partial<Omit<Carousel, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
export type UserAnalyticsUpdate = Partial<Omit<UserAnalytics, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// ============================================================================
// AUTH HELPER TYPES
// ============================================================================

/**
 * Sign up data
 */
export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Sign in data
 */
export interface SignInData {
  email: string;
  password: string;
}

/**
 * Auth error response
 */
export interface AuthError {
  message: string;
  status?: number;
}

/**
 * Auth response
 */
export interface AuthResponse {
  error: AuthError | null;
  success: boolean;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default supabase;

// Re-export commonly used Supabase types
export type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';