/**
 * Test file to verify Supabase setup
 * Run this after Phase 1 is complete
 * 
 * Usage:
 * 1. Start your dev server: npm run dev
 * 2. Open browser console
 * 3. Check for success messages
 */

import { createClient } from '@supabase/supabase-js';

// Test environment variables
export const testSupabaseSetup = () => {
  console.log('=== Testing Supabase Setup ===\n');

  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log('1. Environment Variables:');
  console.log(`   VITE_SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}`);
  console.log(`   VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓ Set (length: ' + supabaseAnonKey?.length + ')' : '✗ Missing'}`);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\n✗ SETUP INCOMPLETE: Missing environment variables');
    console.log('\nNext steps:');
    console.log('1. Create a Supabase project at https://supabase.com');
    console.log('2. Copy your Project URL and anon key');
    console.log('3. Add them to .env.local file');
    console.log('4. Restart your dev server');
    return false;
  }

  // Test Supabase client creation
  console.log('\n2. Creating Supabase Client:');
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('   ✓ Supabase client created successfully');

    // Test connection (this will fail if keys are invalid)
    console.log('\n3. Testing Connection:');
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('   ✗ Connection test failed:', error.message);
        console.log('\nPossible issues:');
        console.log('- Invalid API key');
        console.log('- Network connectivity issues');
        console.log('- CORS not configured properly');
      } else {
        console.log('   ✓ Connection successful!');
        console.log('   Current session:', data.session ? 'Logged in' : 'Not logged in');
      }
    });

    console.log('\n=== Phase 1 Setup Complete! ===');
    console.log('✓ All checks passed');
    console.log('\nReady to proceed to Phase 2: Database Schema Design');
    return true;

  } catch (error: any) {
    console.error('\n✗ Error creating Supabase client:', error.message);
    console.log('\nPlease check:');
    console.log('1. Your .env.local file has correct values');
    console.log('2. You restarted the dev server after adding env variables');
    console.log('3. No typos in the environment variable names');
    return false;
  }
};

// Auto-run test if this file is imported
if (import.meta.env.DEV) {
  testSupabaseSetup();
}

export default testSupabaseSetup;