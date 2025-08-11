-- Fix existing Supabase schema by altering column sizes
-- Run this in your Supabase SQL Editor

-- Alter collections table columns
ALTER TABLE collections ALTER COLUMN candy_machine_address TYPE VARCHAR(100);
ALTER TABLE collections ALTER COLUMN collection_address TYPE VARCHAR(100);
ALTER TABLE collections ALTER COLUMN creator_address TYPE VARCHAR(100);

-- Alter mint_transactions table columns
ALTER TABLE mint_transactions ALTER COLUMN minter_address TYPE VARCHAR(100);
ALTER TABLE mint_transactions ALTER COLUMN nft_address TYPE VARCHAR(100);
ALTER TABLE mint_transactions ALTER COLUMN transaction_signature TYPE VARCHAR(200);

-- Alter platform_fees table columns
ALTER TABLE platform_fees ALTER COLUMN platform_wallet TYPE VARCHAR(100);

-- Alter users table columns
ALTER TABLE users ALTER COLUMN wallet_address TYPE VARCHAR(100);

-- Now insert the sample data
INSERT INTO collections (
  name, symbol, description, image_url, price, items_available, 
  items_minted, candy_machine_address, creator_address, status
) VALUES (
  'Sample Collection', 'SAMPLE', 'A sample NFT collection for testing',
  'https://via.placeholder.com/300x300', 0.1, 100, 0,
  '1111111111111111111111111111111111111111111111111111111111111111',
  'J17NcCGvRzY82yp5nw2RYngfdQy6RivravcTnJfKSne3', 'draft'
);

-- Create the view
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
