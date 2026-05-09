-- ============================================
-- WhatsApp Click Events Analytics
-- Migration: 00000000000008_add_whatsapp_click_events
-- Purpose: Store aggregated-safe WhatsApp click tracking events for admin analytics.
-- Notes:
-- - NO public insert/select policies (events inserted via server API using service role)
-- - Only admins can SELECT
-- ============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  product_id uuid NULL,
  product_name text NULL,
  product_slug text NULL,
  price numeric NULL,
  use_case text NULL,
  needs_count int NULL,
  has_bundle boolean NULL,
  bundle_name text NULL,
  cta_name text NULL,
  path text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_click_events ENABLE ROW LEVEL SECURITY;

-- Allow only admins to view analytics
DROP POLICY IF EXISTS "whatsapp_click_events_select_admin" ON public.whatsapp_click_events;
CREATE POLICY "whatsapp_click_events_select_admin"
  ON public.whatsapp_click_events
  FOR SELECT
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: client cannot write/read directly.
