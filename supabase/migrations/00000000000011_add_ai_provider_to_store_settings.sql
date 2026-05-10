-- ============================================
-- Add ai_provider column to store_settings table
-- ============================================

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini';

-- Add constraint to ensure only valid providers are allowed
ALTER TABLE public.store_settings
ADD CONSTRAINT store_settings_ai_provider_check
CHECK (ai_provider IN ('gemini', 'openai'));
