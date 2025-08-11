-- Create tables step by step
-- Run this in your Supabase SQL Editor

-- Step 1: Create collections table
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
  mint_page_url VARCHAR(255),
  status VARCHAR(20) DEFAULT 'draft',
  creator_address VARCHAR(100) NOT NULL,
  network VARCHAR(20) DEFAULT 'mainnet-beta',
  seller_fee_basis_points INTEGER DEFAULT 500,
  is_mutable BOOLEAN DEFAULT true,
  website TEXT,
  twitter TEXT,
  discord TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create mint_transactions table
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
  status VARCHAR(20) DEFAULT 'pending',
  network VARCHAR(20) DEFAULT 'mainnet-beta',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create platform_fees table
CREATE TABLE platform_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES mint_transactions(id) ON DELETE CASCADE,
  amount_usd DECIMAL(10, 2) NOT NULL,
  amount_sol DECIMAL(10, 6) NOT NULL,
  platform_wallet VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create users table
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

-- Step 5: Insert sample data
INSERT INTO collections (
  name, symbol, description, image_url, price, items_available, 
  items_minted, candy_machine_address, creator_address, status
) VALUES (
  'Sample Collection', 'SAMPLE', 'A sample NFT collection for testing',
  'https://via.placeholder.com/300x300', 0.1, 100, 0,
  '1111111111111111111111111111111111111111111111111111111111111111',
  'J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3', 'draft'
);

-- Step 6: Create view
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
