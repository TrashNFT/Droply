-- Supabase SQL Schema for Solana NFT Launchpad
-- Run this in your Supabase SQL Editor

-- Create collections table
CREATE TABLE collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  description TEXT,
  image_url TEXT,
  price DECIMAL(10, 6) DEFAULT 0,
  items_available INTEGER NOT NULL,
  items_minted INTEGER DEFAULT 0,
  candy_machine_address VARCHAR(100),
  collection_address VARCHAR(100),
  merkle_tree_address VARCHAR(100),
  mint_page_url VARCHAR(255),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'deployed', 'minting', 'completed')),
  creator_address VARCHAR(100) NOT NULL,
  network VARCHAR(20) DEFAULT 'mainnet-beta' CHECK (network IN ('mainnet-beta', 'devnet')),
  seller_fee_basis_points INTEGER DEFAULT 500,
  is_mutable BOOLEAN DEFAULT true,
  standard VARCHAR(10) DEFAULT 'core',
  phases JSONB,
  item_uris JSONB,
  website TEXT,
  twitter TEXT,
  discord TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure one row per on-chain collection address
CREATE UNIQUE INDEX IF NOT EXISTS uq_collections_collection_address ON collections(collection_address);

-- Phase allowlist table for large lists
CREATE TABLE IF NOT EXISTS phase_allowlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  wallet_address VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_phase_allowlist_entry
  ON phase_allowlist(collection_id, phase_name, wallet_address);

CREATE INDEX IF NOT EXISTS idx_phase_allowlist_lookup
  ON phase_allowlist(collection_id, phase_name);

-- Enable RLS and basic policies (public read, insert)
ALTER TABLE phase_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allowlist viewable" ON phase_allowlist FOR SELECT USING (true);
CREATE POLICY "Allowlist insert" ON phase_allowlist FOR INSERT WITH CHECK (true);

-- Create mint transactions table
CREATE TABLE mint_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  minter_address VARCHAR(100) NOT NULL,
  nft_address VARCHAR(100),
  transaction_signature VARCHAR(200),
  mint_price DECIMAL(10, 6) NOT NULL,
  platform_fee DECIMAL(10, 6) NOT NULL,
  total_paid DECIMAL(10, 6) NOT NULL,
  quantity INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  network VARCHAR(20) DEFAULT 'mainnet-beta',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create platform fees table
CREATE TABLE platform_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES mint_transactions(id) ON DELETE CASCADE,
  amount_usd DECIMAL(10, 2) NOT NULL,
  amount_sol DECIMAL(10, 6) NOT NULL,
  platform_wallet VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (optional - for future features)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address VARCHAR(100) UNIQUE NOT NULL,
  username VARCHAR(50),
  email VARCHAR(255),
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_collections_creator ON collections(creator_address);
CREATE INDEX idx_collections_status ON collections(status);
CREATE INDEX idx_collections_network ON collections(network);
CREATE INDEX idx_mint_transactions_collection ON mint_transactions(collection_id);
CREATE INDEX idx_mint_transactions_minter ON mint_transactions(minter_address);
CREATE INDEX idx_mint_transactions_status ON mint_transactions(status);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Enable Row Level Security
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mint_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Collections: Anyone can read, creators can modify their own
CREATE POLICY "Collections are viewable by everyone" ON collections FOR SELECT USING (true);
CREATE POLICY "Users can insert collections" ON collections FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own collections" ON collections FOR UPDATE USING (creator_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Mint transactions: Anyone can read, users can insert their own
CREATE POLICY "Mint transactions are viewable by everyone" ON mint_transactions FOR SELECT USING (true);
CREATE POLICY "Users can insert mint transactions" ON mint_transactions FOR INSERT WITH CHECK (true);

-- Platform fees: Read-only for everyone
CREATE POLICY "Platform fees are viewable by everyone" ON platform_fees FOR SELECT USING (true);
CREATE POLICY "Platform fees can be inserted by system" ON platform_fees FOR INSERT WITH CHECK (true);

-- Users: Users can read/write their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Create functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mint_transactions_updated_at BEFORE UPDATE ON mint_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional)
INSERT INTO collections (
  name, symbol, description, image_url, price, items_available, 
  items_minted, candy_machine_address, creator_address, status
) VALUES (
  'Sample Collection', 'SAMPLE', 'A sample NFT collection for testing',
  'https://via.placeholder.com/300x300', 0.1, 100, 0,
  '1111111111111111111111111111111111111111111111111111111111111111',
  'J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3', 'draft'
);

-- Create view for collection stats
CREATE VIEW collection_stats AS
SELECT 
  c.id,
  c.name,
  c.symbol,
  c.items_available,
  c.items_minted,
  c.price,
  COUNT(mt.id) as total_mints,
  SUM(mt.total_paid) as total_revenue,
  AVG(mt.total_paid) as avg_mint_price
FROM collections c
LEFT JOIN mint_transactions mt ON c.id = mt.collection_id
GROUP BY c.id, c.name, c.symbol, c.items_available, c.items_minted, c.price;
