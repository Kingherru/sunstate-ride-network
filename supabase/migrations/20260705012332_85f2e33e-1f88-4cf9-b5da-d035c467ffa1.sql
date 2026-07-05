
-- Rename trip prefix: FLN- -> TRP-
UPDATE public.trips
   SET display_id = 'TRP-' || substring(display_id from '\d+')
 WHERE display_id LIKE 'FLN-%';

CREATE OR REPLACE FUNCTION public.set_trip_display_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
    NEW.display_id := 'TRP-' || lpad(nextval('public.trip_display_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

-- Sequences for other record types
CREATE SEQUENCE IF NOT EXISTS public.patient_display_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS public.facility_display_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.staff_display_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS public.provider_display_seq START 1;

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS display_id text UNIQUE;
ALTER TABLE public.provider_applications
  ADD COLUMN IF NOT EXISTS display_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_member_display_id ON public.member_profiles (display_id);
CREATE INDEX IF NOT EXISTS idx_provider_app_display_id ON public.provider_applications (display_id);

-- Backfill provider_applications with FLNP-XXXXXX
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.provider_applications WHERE display_id IS NULL ORDER BY created_at LOOP
    UPDATE public.provider_applications
       SET display_id = 'FLNP-' || lpad(nextval('public.provider_display_seq')::text, 6, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- Trigger to auto-assign provider_application display id on insert
CREATE OR REPLACE FUNCTION public.set_provider_app_display_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
    NEW.display_id := 'FLNP-' || lpad(nextval('public.provider_display_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_provider_app_display_id ON public.provider_applications;
CREATE TRIGGER trg_provider_app_display_id
  BEFORE INSERT ON public.provider_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_provider_app_display_id();

-- Function callable by any signed-in user to lazily assign a display id
CREATE OR REPLACE FUNCTION public.ensure_member_display_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
  v_portal text;
  v_prefix text;
  v_seq text;
  v_new text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT display_id INTO v_current FROM public.member_profiles WHERE user_id = v_uid;
  IF v_current IS NOT NULL AND v_current <> '' THEN
    RETURN v_current;
  END IF;

  -- Resolve portal: staff role wins, then user_metadata.portal, else provider
  IF public.has_role(v_uid, 'staff') OR public.has_role(v_uid, 'admin') THEN
    v_portal := 'staff';
  ELSE
    SELECT lower(coalesce(raw_user_meta_data->>'portal', 'provider'))
      INTO v_portal FROM auth.users WHERE id = v_uid;
  END IF;

  IF v_portal = 'patient' THEN
    v_prefix := 'PAT'; v_seq := 'public.patient_display_seq';
  ELSIF v_portal = 'facility' THEN
    v_prefix := 'FAC'; v_seq := 'public.facility_display_seq';
  ELSIF v_portal = 'staff' THEN
    v_prefix := 'STF'; v_seq := 'public.staff_display_seq';
  ELSE
    v_prefix := 'FLNP'; v_seq := 'public.provider_display_seq';
  END IF;

  EXECUTE format('SELECT %I(%L)::bigint', 'nextval', v_seq) INTO v_new;
  v_new := v_prefix || '-' || lpad(v_new, 6, '0');

  -- Insert profile if missing, else update
  INSERT INTO public.member_profiles (user_id, display_id)
    VALUES (v_uid, v_new)
    ON CONFLICT (user_id) DO UPDATE SET display_id = EXCLUDED.display_id
    WHERE public.member_profiles.display_id IS NULL;

  SELECT display_id INTO v_current FROM public.member_profiles WHERE user_id = v_uid;
  RETURN v_current;
END; $$;

REVOKE ALL ON FUNCTION public.ensure_member_display_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_member_display_id() TO authenticated;

-- Admin-only trip reassignment/cancel policies: extend trips update to allow admins
DROP POLICY IF EXISTS "admins manage trips" ON public.trips;
CREATE POLICY "admins manage trips"
  ON public.trips FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
