-- Product variants system
-- Adds structured options/values and extends the existing product_variants table.

CREATE TABLE IF NOT EXISTS public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS compare_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

UPDATE public.product_variants AS pv
SET
  price = GREATEST(0, p.price + COALESCE(pv.price_adjustment, 0)),
  track_stock = COALESCE(pv.track_stock, TRUE),
  sort_order = COALESCE(pv.sort_order, 0)
FROM public.products AS p
WHERE pv.product_id = p.id
  AND pv.price IS NULL;

ALTER TABLE public.product_variants
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN track_stock SET DEFAULT TRUE,
  ALTER COLUMN sort_order SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.product_variant_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT product_variant_values_variant_option_unique UNIQUE (variant_id, option_id)
);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id),
  ADD COLUMN IF NOT EXISTS variant_options JSONB,
  ADD COLUMN IF NOT EXISTS variant_sku TEXT;

CREATE INDEX IF NOT EXISTS idx_product_options_product_id
  ON public.product_options(product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_option_values_option_id
  ON public.product_option_values(option_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id_active
  ON public.product_variants(product_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_variant_values_variant_id
  ON public.product_variant_values(variant_id);

CREATE INDEX IF NOT EXISTS idx_product_variant_values_option_value_id
  ON public.product_variant_values(option_value_id);

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id
  ON public.order_items(variant_id);

DROP TRIGGER IF EXISTS update_product_options_updated_at ON public.product_options;
CREATE TRIGGER update_product_options_updated_at
  BEFORE UPDATE ON public.product_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_option_values_updated_at ON public.product_option_values;
CREATE TRIGGER update_product_option_values_updated_at
  BEFORE UPDATE ON public.product_option_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view options of active products" ON public.product_options;
DROP POLICY IF EXISTS "Admins can view all product options" ON public.product_options;
DROP POLICY IF EXISTS "Admins can insert product options" ON public.product_options;
DROP POLICY IF EXISTS "Admins can update product options" ON public.product_options;
DROP POLICY IF EXISTS "Admins can delete product options" ON public.product_options;

CREATE POLICY "Public can view options of active products"
  ON public.product_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_options.product_id
        AND p.is_active = TRUE
    )
  );

CREATE POLICY "Admins can view all product options"
  ON public.product_options FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert product options"
  ON public.product_options FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update product options"
  ON public.product_options FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete product options"
  ON public.product_options FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view option values of active products" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can view all product option values" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can insert product option values" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can update product option values" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can delete product option values" ON public.product_option_values;

CREATE POLICY "Public can view option values of active products"
  ON public.product_option_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_options po
      JOIN public.products p ON p.id = po.product_id
      WHERE po.id = product_option_values.option_id
        AND p.is_active = TRUE
    )
  );

CREATE POLICY "Admins can view all product option values"
  ON public.product_option_values FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert product option values"
  ON public.product_option_values FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update product option values"
  ON public.product_option_values FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete product option values"
  ON public.product_option_values FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view active variants of active products" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view active product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can view all product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin can manage product variants" ON public.product_variants;

CREATE POLICY "Public can view active variants of active products"
  ON public.product_variants FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.is_active = TRUE
    )
  );

CREATE POLICY "Admins can view all product variants"
  ON public.product_variants FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert product variants"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update product variants"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete product variants"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view variant values of active variants" ON public.product_variant_values;
DROP POLICY IF EXISTS "Admins can view all product variant values" ON public.product_variant_values;
DROP POLICY IF EXISTS "Admins can insert product variant values" ON public.product_variant_values;
DROP POLICY IF EXISTS "Admins can update product variant values" ON public.product_variant_values;
DROP POLICY IF EXISTS "Admins can delete product variant values" ON public.product_variant_values;

CREATE POLICY "Public can view variant values of active variants"
  ON public.product_variant_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = product_variant_values.variant_id
        AND pv.is_active = TRUE
        AND p.is_active = TRUE
    )
  );

CREATE POLICY "Admins can view all product variant values"
  ON public.product_variant_values FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert product variant values"
  ON public.product_variant_values FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update product variant values"
  ON public.product_variant_values FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete product variant values"
  ON public.product_variant_values FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.product_options TO anon, authenticated;
GRANT SELECT ON public.product_option_values TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.product_variant_values TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_option_values TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variant_values TO authenticated;
