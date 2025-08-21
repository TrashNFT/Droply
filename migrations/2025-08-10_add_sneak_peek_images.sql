-- Adds optional sneak peek images column to collections
-- Safe to run multiple times

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS sneak_peek_images JSONB;













