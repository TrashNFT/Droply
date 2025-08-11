-- Add items_reserved counter to collections for atomic URI allocation
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS items_reserved INTEGER DEFAULT 0;

-- Optional safety: ensure it never goes negative
CREATE OR REPLACE FUNCTION ensure_nonnegative_items_reserved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.items_reserved < 0 THEN
    NEW.items_reserved := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nonnegative_items_reserved ON collections;
CREATE TRIGGER trg_nonnegative_items_reserved
BEFORE UPDATE ON collections
FOR EACH ROW
EXECUTE FUNCTION ensure_nonnegative_items_reserved();


