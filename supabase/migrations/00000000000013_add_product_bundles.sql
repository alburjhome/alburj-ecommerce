-- Product bundles system
-- Keeps bundles as regular products and stores bundle composition separately.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'single';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_type_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_type_check
      CHECK (product_type IN ('single', 'bundle'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  item_product_id UUID NOT NULL REFERENCES public.products(id),
  item_variant_id UUID NULL REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 10,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bundle_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT bundle_items_no_self_reference CHECK (bundle_product_id <> item_product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_product_id
  ON public.bundle_items(bundle_product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_bundle_items_item_product_id
  ON public.bundle_items(item_product_id);

CREATE INDEX IF NOT EXISTS idx_bundle_items_item_variant_id
  ON public.bundle_items(item_variant_id);

CREATE UNIQUE INDEX IF NOT EXISTS bundle_items_unique_component
  ON public.bundle_items (
    bundle_product_id,
    item_product_id,
    COALESCE(item_variant_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS bundle_items_snapshot JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_item_type_check'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_item_type_check
      CHECK (item_type IN ('product', 'bundle'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_bundle_items_updated_at ON public.bundle_items;
CREATE TRIGGER update_bundle_items_updated_at
  BEFORE UPDATE ON public.bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active bundle items" ON public.bundle_items;
DROP POLICY IF EXISTS "Admins can view all bundle items" ON public.bundle_items;
DROP POLICY IF EXISTS "Admins can insert bundle items" ON public.bundle_items;
DROP POLICY IF EXISTS "Admins can update bundle items" ON public.bundle_items;
DROP POLICY IF EXISTS "Admins can delete bundle items" ON public.bundle_items;

CREATE POLICY "Public can view active bundle items"
  ON public.bundle_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.products bundle
      JOIN public.products component ON component.id = bundle_items.item_product_id
      LEFT JOIN public.product_variants variant ON variant.id = bundle_items.item_variant_id
      WHERE bundle.id = bundle_items.bundle_product_id
        AND bundle.is_active = TRUE
        AND bundle.product_type = 'bundle'
        AND component.is_active = TRUE
        AND (
          bundle_items.item_variant_id IS NULL
          OR variant.is_active = TRUE
        )
    )
  );

CREATE POLICY "Admins can view all bundle items"
  ON public.bundle_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert bundle items"
  ON public.bundle_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update bundle items"
  ON public.bundle_items FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete bundle items"
  ON public.bundle_items FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.bundle_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bundle_items TO authenticated;
