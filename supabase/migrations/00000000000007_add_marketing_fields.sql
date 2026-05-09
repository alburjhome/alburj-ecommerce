-- Add marketing fields to products table

ALTER TABLE products
ADD COLUMN IF NOT EXISTS marketing_tagline TEXT NULL,
ADD COLUMN IF NOT EXISTS key_features TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS product_badges TEXT[] DEFAULT '{}';

COMMENT ON COLUMN products.marketing_tagline IS 'Short marketing tagline shown under product name';
COMMENT ON COLUMN products.key_features IS 'Up to 6 key product features';
COMMENT ON COLUMN products.product_badges IS 'Marketing badges: bestselling, offer, new, wholesale, limited';
