-- ============================================================================
-- Brand Kit Database Migration
-- ============================================================================
-- 
-- This migration adds the brand_kit column to the profiles table.
-- Run this in your database SQL editor (Appwrite/Supabase).
-- 
-- Location: database/migrations/add_brand_kit_to_profiles.sql
-- ============================================================================

-- Add brand_kit column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS brand_kit JSONB DEFAULT NULL;

-- Add comment to document the column structure
COMMENT ON COLUMN profiles.brand_kit IS 
'User custom brand kit configuration. Structure: { enabled: boolean, seeds: { primary: string, secondary: string, text: string, background: string } }';

-- Optional: Create an index for faster queries on enabled brand kits
CREATE INDEX IF NOT EXISTS idx_profiles_brand_kit_enabled 
ON profiles ((brand_kit->>'enabled')) 
WHERE brand_kit IS NOT NULL;

-- Optional: Add a constraint to validate the JSONB structure
-- This ensures data integrity
ALTER TABLE profiles
ADD CONSTRAINT brand_kit_structure_check
CHECK (
  brand_kit IS NULL OR (
    brand_kit ? 'enabled' AND
    brand_kit ? 'seeds' AND
    (brand_kit->'seeds') ? 'primary' AND
    (brand_kit->'seeds') ? 'secondary' AND
    (brand_kit->'seeds') ? 'text' AND
    (brand_kit->'seeds') ? 'background'
  )
);

-- ============================================================================
-- Example Queries
-- ============================================================================

-- Example 1: Update a user's brand kit
/*
UPDATE profiles
SET brand_kit = '{
  "enabled": true,
  "seeds": {
    "primary": "#3B82F6",
    "secondary": "#8B5CF6",
    "text": "#F9FAFB",
    "background": "#1F2937"
  }
}'::jsonb
WHERE id = 'user-id-here';
*/

-- Example 2: Query users with enabled brand kits
/*
SELECT id, email, brand_kit
FROM profiles
WHERE brand_kit->>'enabled' = 'true';
*/

-- Example 3: Check brand kit structure
/*
SELECT 
  id,
  email,
  brand_kit->'seeds'->>'primary' as primary_color,
  brand_kit->'seeds'->>'secondary' as secondary_color
FROM profiles
WHERE brand_kit IS NOT NULL;
*/
