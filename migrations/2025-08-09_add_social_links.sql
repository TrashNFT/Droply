-- Adds optional social link columns for collections
-- Safe to run multiple times

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS twitter TEXT,
  ADD COLUMN IF NOT EXISTS discord TEXT;









