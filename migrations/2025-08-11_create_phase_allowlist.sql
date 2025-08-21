-- Create allowlist table used by /api/allowlist and /api/mint reserve checks
-- Safe to run multiple times

CREATE TABLE IF NOT EXISTS phase_allowlist (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  phase_name    VARCHAR(64) NOT NULL,
  wallet_address VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, phase_name, wallet_address)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_phase_allowlist_collection_phase
  ON phase_allowlist (collection_id, phase_name);

CREATE INDEX IF NOT EXISTS idx_phase_allowlist_wallet
  ON phase_allowlist (wallet_address);













