-- ============================================
-- Add mobile_image_url column to banners table
-- ============================================

ALTER TABLE banners
ADD COLUMN IF NOT EXISTS mobile_image_url TEXT NULL;
