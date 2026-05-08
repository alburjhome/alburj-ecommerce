-- ============================================
-- Add social media URL fields to store_settings
-- ============================================

ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS facebook_url  TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS tiktok_url    TEXT,
ADD COLUMN IF NOT EXISTS snapchat_url  TEXT,
ADD COLUMN IF NOT EXISTS youtube_url   TEXT;
