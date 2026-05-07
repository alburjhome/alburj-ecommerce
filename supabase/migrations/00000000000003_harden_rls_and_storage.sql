-- ============================================
-- RLS HARDENING AND STORAGE POLICIES
-- Migration: 00000000000003_harden_rls_and_storage
-- Purpose: Fix weak RLS policies and add is_admin() helper
-- WARNING: This drops and recreates policies - run carefully
-- ============================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get current user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES (HARDENED)
-- ============================================

-- Drop old weak policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- New secure SELECT: User sees only own profile, admin sees all
CREATE POLICY "profiles_select_secure"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- New secure INSERT: User can only insert own profile
CREATE POLICY "profiles_insert_secure"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- New secure UPDATE: User can update own non-role fields only
-- Admin can update any profile including role
CREATE POLICY "profiles_update_secure"
  ON public.profiles FOR UPDATE
  USING (
    -- User can update their own profile
    auth.uid() = id 
    -- But cannot change role (enforced by check below)
    OR public.is_admin()
  )
  WITH CHECK (
    -- Non-admin cannot change role
    (auth.uid() = id AND (
      -- Either role unchanged or they weren't trying to change it
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      OR role IS NULL
    ))
    OR public.is_admin()
  );

-- Prevent DELETE of profiles (should use soft delete or admin only)
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- ============================================
-- CATEGORIES POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Active categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Only admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Only admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Only admins can delete categories" ON public.categories;

CREATE POLICY "categories_select_secure"
  ON public.categories FOR SELECT
  USING (is_active = true OR public.is_admin());

CREATE POLICY "categories_insert_secure"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_secure"
  ON public.categories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "categories_delete_secure"
  ON public.categories FOR DELETE
  USING (public.is_admin());

-- ============================================
-- SUBCATEGORIES POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Active subcategories are viewable by everyone" ON public.subcategories;
DROP POLICY IF EXISTS "Only admins can manage subcategories" ON public.subcategories;

CREATE POLICY "subcategories_select_secure"
  ON public.subcategories FOR SELECT
  USING (
    -- Check if parent category is active and subcategory is active
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM public.categories 
      WHERE id = category_id AND is_active = true
    )
    OR public.is_admin()
  );

CREATE POLICY "subcategories_insert_secure"
  ON public.subcategories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "subcategories_update_secure"
  ON public.subcategories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "subcategories_delete_secure"
  ON public.subcategories FOR DELETE
  USING (public.is_admin());

-- ============================================
-- PRODUCTS POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admins can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;

CREATE POLICY "products_select_secure"
  ON public.products FOR SELECT
  USING (is_active = true OR public.is_admin());

CREATE POLICY "products_insert_secure"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "products_update_secure"
  ON public.products FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "products_delete_secure"
  ON public.products FOR DELETE
  USING (public.is_admin());

-- ============================================
-- PRODUCT IMAGES POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Product images are viewable by everyone" ON public.product_images;
DROP POLICY IF EXISTS "Only admins can manage product images" ON public.product_images;

CREATE POLICY "product_images_select_secure"
  ON public.product_images FOR SELECT
  USING (
    -- Anyone can see images of active products
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE id = product_id AND is_active = true
    )
    OR public.is_admin()
  );

CREATE POLICY "product_images_insert_secure"
  ON public.product_images FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "product_images_update_secure"
  ON public.product_images FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "product_images_delete_secure"
  ON public.product_images FOR DELETE
  USING (public.is_admin());

-- ============================================
-- PRODUCT VARIANTS POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Active product variants are viewable by everyone" ON public.product_variants;
DROP POLICY IF EXISTS "Only admins can manage product variants" ON public.product_variants;

CREATE POLICY "product_variants_select_secure"
  ON public.product_variants FOR SELECT
  USING (
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM public.products 
      WHERE id = product_id AND is_active = true
    )
    OR public.is_admin()
  );

CREATE POLICY "product_variants_insert_secure"
  ON public.product_variants FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "product_variants_update_secure"
  ON public.product_variants FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "product_variants_delete_secure"
  ON public.product_variants FOR DELETE
  USING (public.is_admin());

-- ============================================
-- SHIPPING RATES POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Active shipping rates are viewable by everyone" ON public.shipping_rates;
DROP POLICY IF EXISTS "Only admins can manage shipping rates" ON public.shipping_rates;

CREATE POLICY "shipping_rates_select_secure"
  ON public.shipping_rates FOR SELECT
  USING (is_active = true OR public.is_admin());

CREATE POLICY "shipping_rates_insert_secure"
  ON public.shipping_rates FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "shipping_rates_update_secure"
  ON public.shipping_rates FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "shipping_rates_delete_secure"
  ON public.shipping_rates FOR DELETE
  USING (public.is_admin());

-- ============================================
-- ORDERS POLICIES (HARDENED)
-- ============================================
-- SECURITY NOTICE: Orders and order_items are created ONLY through
-- the secure Server Action (app/actions/checkout.ts) using service role.
-- Public/anonymous inserts are intentionally DISABLED.
-- The Server Action validates all prices, stock, and shipping from DB.
-- ============================================

DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Only admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Only admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_anonymous" ON public.orders;

-- NO public INSERT policy - orders created only via Server Action with service role

-- Only admins can view orders (for order management)
CREATE POLICY "orders_select_secure"
  ON public.orders FOR SELECT
  USING (public.is_admin());

-- Only admins can update orders (status changes, etc)
CREATE POLICY "orders_update_secure"
  ON public.orders FOR UPDATE
  USING (public.is_admin());

-- Only admins can delete orders (if needed)
CREATE POLICY "orders_delete_secure"
  ON public.orders FOR DELETE
  USING (public.is_admin());

-- ============================================
-- ORDER ITEMS POLICIES (HARDENED - CRITICAL!)
-- ============================================
-- SECURITY NOTICE: Order items are created ONLY through
-- the secure Server Action (app/actions/checkout.ts) using service role.
-- Public/anonymous inserts are intentionally DISABLED.
-- ============================================

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Only admins can view order items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_secure" ON public.order_items;

-- NO public INSERT policy - order_items created only via Server Action with service role

-- Only admins can view order items
CREATE POLICY "order_items_select_secure"
  ON public.order_items FOR SELECT
  USING (public.is_admin());

-- Only admins can update order items (if needed)
CREATE POLICY "order_items_update_secure"
  ON public.order_items FOR UPDATE
  USING (public.is_admin());

-- Only admins can delete order items (if needed)
CREATE POLICY "order_items_delete_secure"
  ON public.order_items FOR DELETE
  USING (public.is_admin());

-- ============================================
-- BANNERS POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Active banners are viewable by everyone" ON public.banners;
DROP POLICY IF EXISTS "Only admins can manage banners" ON public.banners;

CREATE POLICY "banners_select_secure"
  ON public.banners FOR SELECT
  USING (
    is_active = true 
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
    OR public.is_admin()
  );

CREATE POLICY "banners_insert_secure"
  ON public.banners FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "banners_update_secure"
  ON public.banners FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "banners_delete_secure"
  ON public.banners FOR DELETE
  USING (public.is_admin());

-- ============================================
-- STORE SETTINGS POLICIES (HARDENED)
-- ============================================

DROP POLICY IF EXISTS "Store settings are viewable by everyone" ON public.store_settings;
DROP POLICY IF EXISTS "Only admins can update store settings" ON public.store_settings;

CREATE POLICY "store_settings_select_secure"
  ON public.store_settings FOR SELECT
  USING (true);

CREATE POLICY "store_settings_update_secure"
  ON public.store_settings FOR UPDATE
  USING (public.is_admin());

-- ============================================
-- STORAGE BUCKET CREATION (if not exists)
-- ============================================

-- Create buckets if they don't exist
-- Note: If these fail, create manually in Dashboard
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'categories',
  'categories',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES (FIXED - DROP IF EXISTS + CREATE)
-- ============================================

-- Policies for 'products' bucket
DROP POLICY IF EXISTS "products_public_select" ON storage.objects;
DROP POLICY IF EXISTS "products_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "products_admin_delete" ON storage.objects;

-- Public read for products bucket
CREATE POLICY "products_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

-- Admin-only write for products bucket
CREATE POLICY "products_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'products' 
    AND public.is_admin()
  );

CREATE POLICY "products_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'products' 
    AND public.is_admin()
  );

CREATE POLICY "products_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'products' 
    AND public.is_admin()
  );

-- Policies for 'banners' bucket
DROP POLICY IF EXISTS "banners_public_select" ON storage.objects;
DROP POLICY IF EXISTS "banners_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "banners_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "banners_admin_delete" ON storage.objects;

CREATE POLICY "banners_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

CREATE POLICY "banners_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'banners' AND public.is_admin());

CREATE POLICY "banners_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'banners' AND public.is_admin());

CREATE POLICY "banners_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'banners' AND public.is_admin());

-- Policies for 'categories' bucket
DROP POLICY IF EXISTS "categories_public_select" ON storage.objects;
DROP POLICY IF EXISTS "categories_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "categories_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "categories_admin_delete" ON storage.objects;

CREATE POLICY "categories_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'categories' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

CREATE POLICY "categories_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'categories' AND public.is_admin());

CREATE POLICY "categories_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'categories' AND public.is_admin());

CREATE POLICY "categories_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'categories' AND public.is_admin());

-- ============================================
-- END OF MIGRATION
-- ============================================
