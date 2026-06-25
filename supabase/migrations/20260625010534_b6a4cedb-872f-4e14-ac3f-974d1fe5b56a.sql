CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.platform_theme (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  primary_color TEXT NOT NULL DEFAULT '#13335a',
  accent_color TEXT NOT NULL DEFAULT '#e07a1f',
  background_color TEXT NOT NULL DEFAULT '#ffffff',
  foreground_color TEXT NOT NULL DEFAULT '#0f172a',
  card_color TEXT NOT NULL DEFAULT '#ffffff',
  muted_color TEXT NOT NULL DEFAULT '#64748b',
  border_color TEXT NOT NULL DEFAULT '#e2e8f0',
  layout_style TEXT NOT NULL DEFAULT 'standard',
  header_style TEXT NOT NULL DEFAULT 'classic',
  footer_style TEXT NOT NULL DEFAULT 'expanded',
  card_style TEXT NOT NULL DEFAULT 'rounded',
  radius_scale TEXT NOT NULL DEFAULT 'medium',
  custom_css TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_theme TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_theme TO authenticated;
GRANT ALL ON public.platform_theme TO service_role;

ALTER TABLE public.platform_theme ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active theme" ON public.platform_theme
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can insert theme" ON public.platform_theme
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update theme" ON public.platform_theme
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_platform_theme_updated_at
  BEFORE UPDATE ON public.platform_theme
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_theme (is_active) VALUES (true);