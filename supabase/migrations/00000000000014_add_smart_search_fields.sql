-- Migration 00000000000014: Add smart search fields and enable pg_trgm

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_keywords TEXT[] DEFAULT '{}';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS normalized_search_text TEXT;

CREATE INDEX IF NOT EXISTS idx_products_search_keywords
  ON public.products USING GIN (search_keywords);

CREATE INDEX IF NOT EXISTS idx_products_normalized_search_text_trgm
  ON public.products USING GIN (normalized_search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_is_active
  ON public.products (is_active);

CREATE INDEX IF NOT EXISTS idx_products_product_type
  ON public.products (product_type);

CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON public.products (created_at DESC)
  WHERE is_active = true;
