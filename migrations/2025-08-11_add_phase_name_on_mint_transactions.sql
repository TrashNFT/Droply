-- Add phase_name to mint_transactions for per-phase analytics and enforcement
ALTER TABLE mint_transactions
  ADD COLUMN IF NOT EXISTS phase_name VARCHAR(64);

-- Optional: helpful index for phase lookups
CREATE INDEX IF NOT EXISTS idx_mint_transactions_phase
  ON mint_transactions(phase_name);


