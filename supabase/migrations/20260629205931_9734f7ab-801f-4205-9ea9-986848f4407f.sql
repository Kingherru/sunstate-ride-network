ALTER TABLE public.platform_theme
  ADD COLUMN IF NOT EXISTS portal_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS portal_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS portal_background_color TEXT,
  ADD COLUMN IF NOT EXISTS portal_card_color TEXT,
  ADD COLUMN IF NOT EXISTS portal_foreground_color TEXT,
  ADD COLUMN IF NOT EXISTS portal_border_color TEXT,
  ADD COLUMN IF NOT EXISTS form_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS form_accent_color TEXT;