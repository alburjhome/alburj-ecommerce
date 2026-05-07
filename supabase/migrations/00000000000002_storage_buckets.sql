-- ============================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================
-- NOTE: Bucket creation via SQL requires appropriate permissions.
-- If these commands fail, create buckets manually in Supabase Dashboard
-- under Storage > Buckets, then run the policies section.
-- ============================================

-- ============================================
-- BUCKET CREATION
-- ============================================
-- These insert statements create buckets if they don't exist
-- Requires storage schema access

-- Create products bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create banners bucket for banner images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create categories bucket for category images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'categories',
  'categories',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================
-- These policies control access to storage objects
-- Requires storage schema access

-- ============================================
-- PRODUCTS BUCKET POLICIES
-- ============================================

-- Public can view product images (SELECT)
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Only admins can upload product images (INSERT)
DROP POLICY IF EXISTS "Only admins can upload product images" ON storage.objects;
CREATE POLICY "Only admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'products'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update product images (UPDATE)
DROP POLICY IF EXISTS "Only admins can update product images" ON storage.objects;
CREATE POLICY "Only admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'products'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete product images (DELETE)
DROP POLICY IF EXISTS "Only admins can delete product images" ON storage.objects;
CREATE POLICY "Only admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'products'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- BANNERS BUCKET POLICIES
-- ============================================

-- Public can view banner images (SELECT)
DROP POLICY IF EXISTS "Public can view banner images" ON storage.objects;
CREATE POLICY "Public can view banner images"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

-- Only admins can upload banner images (INSERT)
DROP POLICY IF EXISTS "Only admins can upload banner images" ON storage.objects;
CREATE POLICY "Only admins can upload banner images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banners'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update banner images (UPDATE)
DROP POLICY IF EXISTS "Only admins can update banner images" ON storage.objects;
CREATE POLICY "Only admins can update banner images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'banners'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete banner images (DELETE)
DROP POLICY IF EXISTS "Only admins can delete banner images" ON storage.objects;
CREATE POLICY "Only admins can delete banner images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banners'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- CATEGORIES BUCKET POLICIES
-- ============================================

-- Public can view category images (SELECT)
DROP POLICY IF EXISTS "Public can view category images" ON storage.objects;
CREATE POLICY "Public can view category images"
ON storage.objects FOR SELECT
USING (bucket_id = 'categories');

-- Only admins can upload category images (INSERT)
DROP POLICY IF EXISTS "Only admins can upload category images" ON storage.objects;
CREATE POLICY "Only admins can upload category images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'categories'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update category images (UPDATE)
DROP POLICY IF EXISTS "Only admins can upload category images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update category images" ON storage.objects;
CREATE POLICY "Only admins can update category images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'categories'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete category images (DELETE)
DROP POLICY IF EXISTS "Only admins can delete category images" ON storage.objects;
CREATE POLICY "Only admins can delete category images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'categories'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- MANUAL SETUP INSTRUCTIONS (if SQL fails)
-- ============================================
-- If the above SQL commands fail due to permissions,
-- follow these steps in Supabase Dashboard:
--
-- 1. Go to Storage > Buckets
-- 2. Create three buckets: products, banners, categories
-- 3. Set all buckets to "Public bucket"
-- 4. Configure file size limits:
--    - products: 5MB
--    - banners: 10MB  
--    - categories: 5MB
-- 5. Add policies for each bucket:
--    - SELECT: Allow public access
--    - INSERT: Allow authenticated + admin role
--    - UPDATE: Allow authenticated + admin role
--    - DELETE: Allow authenticated + admin role
-- ============================================
