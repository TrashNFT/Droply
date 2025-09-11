-- Add optional human-friendly slug for mint URLs
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Enforce uniqueness when provided (allow NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS collections_slug_key ON collections (slug) WHERE slug IS NOT NULL;


