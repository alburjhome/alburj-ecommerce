-- ============================================
-- Store Settings: Analytics IDs
-- Migration: 00000000000009_add_analytics_ids_to_store_settings
-- Purpose: Allow admin to configure Meta Pixel and GA4 IDs from store_settings.
-- Notes:
-- - IDs are stored as plain strings (no scripts).
-- - Loading and validation enforced at app level.
-- ============================================

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS meta_pixel_id text NULL;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS ga4_measurement_id text NULL;
