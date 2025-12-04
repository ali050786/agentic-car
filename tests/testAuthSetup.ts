/**
 * Authentication Setup Test
 * 
 * Run this file to verify your authentication setup is working correctly.
 * Import this in your main App.tsx temporarily to test.
 * 
 * Location: src/tests/testAuthSetup.ts
 * 
 * Usage:
 * 1. Import in your App.tsx: import './tests/testAuthSetup';
 * 2. Start dev server: npm run dev
 * 3. Open browser console (F12)
 * 4. Look for test results
 */

import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import * as authUtils from '../utils/authUtils';

/**
 * Test Supabase client connection
 */
const testSupabaseConnection = async () => {
  console.log('\n=== Testing Supabase Connection ===');
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      return false;
    }
    
    console.log('✅ Supabase client connected');
    console.log('   Current session:', data.session ? 'Active' : 'None');
    return true;
  } catch (error: any) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
};

/**
 * Test environment variables
 */
const testEnvironmentVariables = () => {
  console.log('\n=== Testing Environment Variables ===');
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    console.error('❌ VITE_SUPABASE_URL is not set');
    return false;
  }
  
  if (!supabaseKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY is not set');
    return false;
  }
  
  console.log('✅ VITE_SUPABASE_URL:', supabaseUrl);
  console.log('✅ VITE_SUPABASE_ANON_KEY:', supabaseKey.substring(0, 20) + '...');
  return true;
};

/**
 * Test auth store initialization
 */
const testAuthStore = () => {
  console.log('\n=== Testing Auth Store ===');
  
  try {
    const store = useAuthStore.getState();
    
    console.log('✅ Auth store accessible');
    console.log('   Initialized:', store.initialized);
    console.log('   Loading:', store.loading);
    console.log('   User:', store.user ? 'Logged in' : 'Not logged in');
    console.log('   Profile:', store.profile ? 'Loaded' : 'None');
    
    // Check all methods exist
    const methods = [
      'initialize',
      'signUp',
      'signIn',
      'signOut',
      'resetPassword',
      'updatePassword',
      'updateProfile',
    ];
    
    const missingMethods = methods.filter(method => {
      return typeof (store as any)[method] !== 'function';
    });
    
    if (missingMethods.length > 0) {
      console.error('❌ Missing methods:', missingMethods);
      return false;
    }
    
    console.log('✅ All auth methods present');
    return true;
  } catch (error: any) {
    console.error('❌ Auth store error:', error.message);
    return false;
  }
};

/**
 * Test auth utilities
 */
const testAuthUtils = () => {
  console.log('\n=== Testing Auth Utilities ===');
  
  try {
    // Test email validation
    const validEmail = authUtils.isValidEmail('test@example.com');
    const invalidEmail = authUtils.isValidEmail('invalid-email');
    
    if (!validEmail || invalidEmail) {
      console.error('❌ Email validation failed');
      return false;
    }
    console.log('✅ Email validation works');
    
    // Test password validation
    const validPassword = authUtils.isValidPassword('password123');
    const invalidPassword = authUtils.isValidPassword('pass');
    
    if (!validPassword || invalidPassword) {
      console.error('❌ Password validation failed');
      return false;
    }
    console.log('✅ Password validation works');
    
    // Test password strength
    const weak = authUtils.getPasswordStrength('pass');
    const medium = authUtils.getPasswordStrength('Pass1234');
    const strong = authUtils.getPasswordStrength('Pass1234!@#');
    
    console.log('✅ Password strength calculator works');
    console.log('   Weak:', weak);
    console.log('   Medium:', medium);
    console.log('   Strong:', strong);
    
    // Test user initials
    const initials = authUtils.getUserInitials('John Doe');
    if (initials !== 'JD') {
      console.error('❌ User initials failed');
      return false;
    }
    console.log('✅ User initials works');
    
    // Test error formatting
    const formatted = authUtils.formatAuthError({ 
      message: 'Invalid login credentials' 
    });
    console.log('✅ Error formatting works:', formatted);
    
    return true;
  } catch (error: any) {
    console.error('❌ Auth utilities error:', error.message);
    return false;
  }
};

/**
 * Test database connectivity
 */
const testDatabaseAccess = async () => {
  console.log('\n=== Testing Database Access ===');
  
  try {
    // Try to query profiles table (should work even if empty)
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Database query error:', error.message);
      console.log('   Make sure Phase 2 database setup is complete');
      return false;
    }
    
    console.log('✅ Database accessible');
    console.log('   Profiles table exists');
    
    // Test carousels table
    const { error: carouselError } = await supabase
      .from('carousels')
      .select('count')
      .limit(1);
    
    if (carouselError) {
      console.error('❌ Carousels table error:', carouselError.message);
      return false;
    }
    
    console.log('✅ Carousels table accessible');
    
    // Test user_analytics table
    const { error: analyticsError } = await supabase
      .from('user_analytics')
      .select('count')
      .limit(1);
    
    if (analyticsError) {
      console.error('❌ User analytics table error:', analyticsError.message);
      return false;
    }
    
    console.log('✅ User analytics table accessible');
    
    return true;
  } catch (error: any) {
    console.error('❌ Database access failed:', error.message);
    return false;
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   AUTH SETUP TEST SUITE              ║');
  console.log('╚═══════════════════════════════════════╝');
  
  const results = {
    environment: testEnvironmentVariables(),
    connection: await testSupabaseConnection(),
    authStore: testAuthStore(),
    utilities: testAuthUtils(),
    database: await testDatabaseAccess(),
  };
  
  console.log('\n=== Test Results Summary ===');
  console.log('Environment Variables:', results.environment ? '✅' : '❌');
  console.log('Supabase Connection:', results.connection ? '✅' : '❌');
  console.log('Auth Store:', results.authStore ? '✅' : '❌');
  console.log('Auth Utilities:', results.utilities ? '✅' : '❌');
  console.log('Database Access:', results.database ? '✅' : '❌');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Your auth setup is ready.');
    console.log('Next steps:');
    console.log('1. Remove this test import from App.tsx');
    console.log('2. Start building your auth UI components');
    console.log('3. Proceed to Phase 4: UI Components');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above.');
    console.log('Common fixes:');
    console.log('- Check .env.local has correct Supabase credentials');
    console.log('- Ensure Phase 2 database setup is complete');
    console.log('- Restart dev server after adding environment variables');
  }
  
  return allPassed;
};

// Auto-run tests in development
if (import.meta.env.DEV) {
  runAllTests().catch(console.error);
}

export { runAllTests, testSupabaseConnection, testAuthStore, testAuthUtils };
export default runAllTests;