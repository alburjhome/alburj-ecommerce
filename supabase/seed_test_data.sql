-- ============================================
-- TEST DATA SEED
-- Run this in Supabase SQL Editor to add sample data
-- Matches the schema in supabase/migrations/00000000000000_initial_schema.sql
-- ============================================

-- Insert categories
INSERT INTO categories (id, name, slug, description, sort_order, is_active)
VALUES
  (gen_random_uuid(), 'Electronics', 'electronics', 'Electronic devices and accessories', 1, true),
  (gen_random_uuid(), 'Fashion', 'fashion', 'Clothing and accessories', 2, true),
  (gen_random_uuid(), 'Home & Kitchen', 'home-kitchen', 'Home and kitchen products', 3, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories
WITH cats AS (
  SELECT id, slug FROM categories WHERE slug IN ('electronics', 'fashion', 'home-kitchen')
)
INSERT INTO subcategories (id, category_id, name, slug, description, sort_order, is_active)
SELECT
  gen_random_uuid(),
  cats.id,
  CASE cats.slug
    WHEN 'electronics' THEN 'Smartphones'
    WHEN 'fashion' THEN 'Men'
    ELSE 'Kitchen Tools'
  END,
  CASE cats.slug
    WHEN 'electronics' THEN 'smartphones'
    WHEN 'fashion' THEN 'men'
    ELSE 'kitchen-tools'
  END,
  CASE cats.slug
    WHEN 'electronics' THEN 'Phones and mobile accessories'
    WHEN 'fashion' THEN 'Men clothing and accessories'
    ELSE 'Useful tools for the kitchen'
  END,
  1,
  true
FROM cats
ON CONFLICT (category_id, slug) DO NOTHING;

-- Insert products
WITH subcats AS (
  SELECT id FROM subcategories WHERE slug = 'smartphones' LIMIT 1
)
INSERT INTO products (
  id, subcategory_id, name, slug, description, short_description, price,
  compare_price, stock_quantity, track_stock, is_active, is_featured
)
SELECT
  gen_random_uuid(),
  subcats.id,
  'iPhone 15 Pro Max',
  'iphone-15-pro-max',
  'Apple smartphone with A17 Pro processor and Super Retina XDR display',
  'Apple flagship smartphone',
  899.00,
  999.00,
  10,
  true,
  true,
  true
FROM subcats
ON CONFLICT (slug) DO NOTHING;

WITH subcats AS (
  SELECT id FROM subcategories WHERE slug = 'smartphones' LIMIT 1
)
INSERT INTO products (
  id, subcategory_id, name, slug, description, short_description, price,
  compare_price, stock_quantity, track_stock, is_active, is_featured
)
SELECT
  gen_random_uuid(),
  subcats.id,
  'Samsung Galaxy S24',
  'samsung-galaxy-s24',
  'Samsung flagship smartphone with advanced AI features',
  'Samsung flagship smartphone',
  749.00,
  849.00,
  15,
  true,
  true,
  false
FROM subcats
ON CONFLICT (slug) DO NOTHING;

-- Insert banner
INSERT INTO banners (
  id, title, subtitle, image_url, link_url,
  position, sort_order, is_active
)
VALUES (
  gen_random_uuid(),
  'End of Season Sale',
  'Discounts up to 50% on electronics',
  '/placeholder-banner.svg',
  '/category/electronics',
  'home_hero',
  1,
  true
)
ON CONFLICT DO NOTHING;

-- Verify data was inserted
SELECT 'Categories:' as info, COUNT(*) as count FROM categories
UNION ALL
SELECT 'Subcategories:', COUNT(*) FROM subcategories
UNION ALL
SELECT 'Products:', COUNT(*) FROM products
UNION ALL
SELECT 'Banners:', COUNT(*) FROM banners;
