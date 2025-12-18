/**
 * Authentication Utilities
 * 
 * Helper functions for authentication operations
 * 
 * Location: src/utils/authUtils.ts
 */

import { account } from '../lib/appwriteClient';

// ============================================================================
// SESSION HELPERS
// ============================================================================

/**
 * Check if user has an active session
 */
export const hasActiveSession = async (): Promise<boolean> => {
  try {
    await account.get();
    return true;
  } catch {
    return false;
  }
};

/**
 * Get current user ID
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const user = await account.get();
    return user.$id || null;
  } catch {
    return null;
  }
};

/**
 * Get current session (user)
 */
export const getCurrentSession = async () => {
  try {
    return await account.get();
  } catch {
    return null;
  }
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * Requirements: At least 6 characters
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Get password strength
 * Returns: 'weak', 'medium', 'strong'
 */
export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  if (password.length < 6) return 'weak';

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const strength = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (strength >= 3 && password.length >= 10) return 'strong';
  if (strength >= 2 && password.length >= 8) return 'medium';
  return 'weak';
};

/**
 * Validate full name
 */
export const isValidFullName = (name: string): boolean => {
  return name.trim().length >= 2;
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Format auth errors for display
 */
export const formatAuthError = (error: any): string => {
  if (!error) return 'An unknown error occurred';

  // Common error messages
  const errorMap: { [key: string]: string } = {
    'Invalid login credentials': 'Invalid email or password',
    'Email not confirmed': 'Please verify your email before signing in',
    'User already registered': 'An account with this email already exists',
    'Password should be at least 6 characters': 'Password must be at least 6 characters long',
    'Unable to validate email address: invalid format': 'Please enter a valid email address',
    'Email rate limit exceeded': 'Too many attempts. Please try again later',
    'Signup requires a valid password': 'Please enter a valid password',
  };

  const message = error.message || error.error_description || error.msg || String(error);

  return errorMap[message] || message;
};

// ============================================================================
// TOKEN HELPERS (Not needed with Appwrite - handled internally)
// ============================================================================

/**
 * Check if session is expired
 */
export const isSessionExpired = (session: any): boolean => {
  if (!session || !session.expires_at) return true;
  return Date.now() >= session.expires_at * 1000;
};

// ============================================================================
// REDIRECT HELPERS
// ============================================================================

/**
 * Get redirect URL after authentication
 * Checks for 'redirectTo' query parameter
 */
export const getAuthRedirectUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  return params.get('redirectTo') || '/app';
};

/**
 * Create login URL with redirect
 */
export const createLoginUrl = (redirectTo?: string): string => {
  const url = '/login';
  if (redirectTo) {
    return `${url}?redirectTo=${encodeURIComponent(redirectTo)}`;
  }
  return url;
};

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

/**
 * Save redirect path to use after login
 */
export const saveRedirectPath = (path: string): void => {
  sessionStorage.setItem('auth_redirect', path);
};

/**
 * Get and clear saved redirect path
 */
export const getAndClearRedirectPath = (): string | null => {
  const path = sessionStorage.getItem('auth_redirect');
  sessionStorage.removeItem('auth_redirect');
  return path;
};

// ============================================================================
// PROFILE HELPERS
// ============================================================================

/**
 * Get user initials from name
 */
export const getUserInitials = (name: string | null | undefined): string => {
  if (!name) return '?';

  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Get display name (or email if name not set)
 */
export const getDisplayName = (fullName: string | null, email: string): string => {
  return fullName || email.split('@')[0];
};

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

/**
 * Check if user can edit carousel
 */
export const canEditCarousel = (carouselUserId: string, currentUserId: string | null): boolean => {
  if (!currentUserId) return false;
  return carouselUserId === currentUserId;
};

/**
 * Check if user can delete carousel
 */
export const canDeleteCarousel = (carouselUserId: string, currentUserId: string | null): boolean => {
  return canEditCarousel(carouselUserId, currentUserId);
};

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Simple client-side rate limiting for auth attempts
 */
const authAttempts = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Check if auth attempts should be rate limited
 * @param identifier - Usually email address
 * @param maxAttempts - Maximum attempts allowed
 * @param windowMs - Time window in milliseconds
 */
export const shouldRateLimit = (
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 5 * 60 * 1000 // 5 minutes
): boolean => {
  const now = Date.now();
  const attempt = authAttempts.get(identifier);

  if (!attempt) {
    authAttempts.set(identifier, { count: 1, firstAttempt: now });
    return false;
  }

  // Reset if window has passed
  if (now - attempt.firstAttempt > windowMs) {
    authAttempts.set(identifier, { count: 1, firstAttempt: now });
    return false;
  }

  // Increment count
  attempt.count++;

  return attempt.count > maxAttempts;
};

/**
 * Clear rate limit for identifier
 */
export const clearRateLimit = (identifier: string): void => {
  authAttempts.delete(identifier);
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Session
  hasActiveSession,
  getCurrentUserId,
  getCurrentSession,

  // Validation
  isValidEmail,
  isValidPassword,
  getPasswordStrength,
  isValidFullName,

  // Errors
  formatAuthError,

  // Tokens
  isSessionExpired,

  // Redirects
  getAuthRedirectUrl,
  createLoginUrl,
  saveRedirectPath,
  getAndClearRedirectPath,

  // Profile
  getUserInitials,
  getDisplayName,

  // Permissions
  canEditCarousel,
  canDeleteCarousel,

  // Rate limiting
  shouldRateLimit,
  clearRateLimit,
};