-- Migration 00000000000015: Create search_queries table for analytics

CREATE TABLE IF NOT EXISTS public.search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  normalized_query TEXT,
  results_count INTEGER,
  clicked_product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
  source TEXT NULL,
  session_id TEXT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_queries_created_at
  ON public.search_queries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_queries_normalized_query
  ON public.search_queries (normalized_query);

ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_queries_allow_insert ON public.search_queries;
DROP POLICY IF EXISTS search_queries_admin_select ON public.search_queries;
DROP POLICY IF EXISTS "Public can insert search queries" ON public.search_queries;
DROP POLICY IF EXISTS "Admins can read search queries" ON public.search_queries;

-- Public insert only (anon + authenticated)
CREATE POLICY "Public can insert search queries"
  ON public.search_queries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admin select only; no public select/update/delete
CREATE POLICY "Admins can read search queries"
  ON public.search_queries
  FOR SELECT
  USING (public.is_admin());
