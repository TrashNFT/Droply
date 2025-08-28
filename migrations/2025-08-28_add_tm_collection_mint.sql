-- Add Legacy Token Metadata collection mint column for TM-compatibility
-- Safe to run multiple times

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS tm_collection_mint TEXT;


