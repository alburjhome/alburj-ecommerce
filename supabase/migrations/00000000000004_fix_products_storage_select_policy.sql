-- ============================================
-- FIX PRODUCTS STORAGE SELECT POLICY
-- Purpose: ensure authenticated users can only read from the products bucket
-- ============================================

DROP POLICY IF EXISTS "products_public_select" ON storage.objects;

CREATE POLICY "products_public_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'products'
    AND (auth.role() = 'anon' OR auth.role() = 'authenticated')
  );
