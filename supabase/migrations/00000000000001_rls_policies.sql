-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================
CREATE POLICY "Profiles are viewable by authenticated users" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ============================================
-- CATEGORIES POLICIES
-- ============================================
CREATE POLICY "Active categories are viewable by everyone" 
  ON categories FOR SELECT 
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can insert categories" 
  ON categories FOR INSERT 
  WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can update categories" 
  ON categories FOR UPDATE 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can delete categories" 
  ON categories FOR DELETE 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- SUBCATEGORIES POLICIES
-- ============================================
CREATE POLICY "Active subcategories are viewable by everyone" 
  ON subcategories FOR SELECT 
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can manage subcategories" 
  ON subcategories FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- PRODUCTS POLICIES
-- ============================================
CREATE POLICY "Active products are viewable by everyone" 
  ON products FOR SELECT 
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can insert products" 
  ON products FOR INSERT 
  WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can update products" 
  ON products FOR UPDATE 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can delete products" 
  ON products FOR DELETE 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- PRODUCT IMAGES POLICIES
-- ============================================
CREATE POLICY "Product images are viewable by everyone" 
  ON product_images FOR SELECT 
  USING (true);

CREATE POLICY "Only admins can manage product images" 
  ON product_images FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- PRODUCT VARIANTS POLICIES
-- ============================================
CREATE POLICY "Active product variants are viewable by everyone" 
  ON product_variants FOR SELECT 
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can manage product variants" 
  ON product_variants FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- SHIPPING RATES POLICIES
-- ============================================
CREATE POLICY "Active shipping rates are viewable by everyone" 
  ON shipping_rates FOR SELECT 
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can manage shipping rates" 
  ON shipping_rates FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- ORDERS POLICIES
-- ============================================
CREATE POLICY "Anyone can insert orders" 
  ON orders FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Only admins can view orders" 
  ON orders FOR SELECT 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can update orders" 
  ON orders FOR UPDATE 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- ORDER ITEMS POLICIES
-- ============================================
CREATE POLICY "Anyone can insert order items" 
  ON order_items FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Only admins can view order items" 
  ON order_items FOR SELECT 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- BANNERS POLICIES
-- ============================================
CREATE POLICY "Active banners are viewable by everyone" 
  ON banners FOR SELECT 
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can manage banners" 
  ON banners FOR ALL 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- ============================================
-- STORE SETTINGS POLICIES
-- ============================================
CREATE POLICY "Store settings are viewable by everyone" 
  ON store_settings FOR SELECT 
  USING (true);

CREATE POLICY "Only admins can update store settings" 
  ON store_settings FOR UPDATE 
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));
