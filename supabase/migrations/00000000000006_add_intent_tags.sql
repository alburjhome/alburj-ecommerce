-- Add intent_tags to products for intent-based filtering

ALTER TABLE products
ADD COLUMN IF NOT EXISTS intent_tags TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN products.intent_tags IS 'Tags for intent-based filtering: home, restaurants, shops, packaging, cleaning, bulk';
