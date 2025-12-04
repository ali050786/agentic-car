-- Add preset_id column to carousels table
-- Migration: Add color preset tracking
-- Date: 2025-12-04

ALTER TABLE public.carousels 
ADD COLUMN IF NOT EXISTS preset_id TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.carousels.preset_id IS 'ID of the color preset used (e.g., ocean-tech, sunset-energy). NULL if custom/AI-generated theme.';

-- Optional: Create index if we'll query by preset_id often
-- Uncomment if you need to filter/search by preset_id frequently
-- CREATE INDEX idx_carousels_preset_id ON public.carousels(preset_id);
