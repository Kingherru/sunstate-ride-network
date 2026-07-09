
-- =============================================================
-- Item 55: unify Saved Contacts + Saved Patients (add "kind")
-- =============================================================
ALTER TABLE public.saved_patients
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'patient'
    CHECK (kind IN ('patient', 'contact'));

-- =============================================================
-- Item 50: Provider Ride Request Embed tokens
-- =============================================================
CREATE TABLE IF NOT EXISTS public.provider_embed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS provider_embed_tokens_provider_idx
  ON public.provider_embed_tokens (provider_user_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_embed_tokens TO authenticated;
GRANT ALL ON public.provider_embed_tokens TO service_role;
-- Anonymous embed page needs to resolve a token; only exposes provider id.
GRANT SELECT ON public.provider_embed_tokens TO anon;

ALTER TABLE public.provider_embed_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider can manage own embed tokens"
  ON public.provider_embed_tokens FOR ALL
  TO authenticated
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());

CREATE POLICY "Anon can read active embed tokens"
  ON public.provider_embed_tokens FOR SELECT
  TO anon
  USING (revoked_at IS NULL);

-- =============================================================
-- Item 53: Manual trip completion — trip summary logs
-- =============================================================
CREATE TABLE IF NOT EXISTS public.trip_summary_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_arrival_at timestamptz,
  dropoff_arrival_at timestamptz,
  odometer_start numeric,
  odometer_end numeric,
  total_miles numeric,
  notes text,
  incidents text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_summary_logs_trip_idx ON public.trip_summary_logs(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_summary_logs TO authenticated;
GRANT ALL ON public.trip_summary_logs TO service_role;

ALTER TABLE public.trip_summary_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider can manage own trip summary logs"
  ON public.trip_summary_logs FOR ALL
  TO authenticated
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());

CREATE POLICY "Ops staff can view all trip summary logs"
  ON public.trip_summary_logs FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE TRIGGER trip_summary_logs_updated_at
  BEFORE UPDATE ON public.trip_summary_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Flag on trips indicating a manual completion + link to log
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS manually_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manually_completed_by uuid REFERENCES auth.users(id);

-- =============================================================
-- Item 52: Auto-upgrade Patient -> Facility when >3 patients saved
-- =============================================================
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS auto_upgraded_to_facility_at timestamptz;

CREATE OR REPLACE FUNCTION public.auto_upgrade_patient_to_facility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := NEW.owner_user_id;
  v_portal text;
  v_count int;
BEGIN
  IF v_owner IS NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.kind, 'patient') <> 'patient' THEN RETURN NEW; END IF;

  SELECT lower(coalesce(raw_user_meta_data->>'portal',''))
    INTO v_portal
    FROM auth.users WHERE id = v_owner;

  IF v_portal <> 'patient' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count
    FROM public.saved_patients
   WHERE owner_user_id = v_owner
     AND coalesce(kind, 'patient') = 'patient';

  IF v_count > 3 THEN
    UPDATE auth.users
       SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('portal','facility')
     WHERE id = v_owner;

    UPDATE public.member_profiles
       SET auto_upgraded_to_facility_at = coalesce(auto_upgraded_to_facility_at, now())
     WHERE user_id = v_owner;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_owner, 'facility_auto_upgrade',
            'Your account was upgraded to Facility',
            'Because you manage more than 3 patients, your account was automatically upgraded to a Facility Portal. Pricing does not change — it''s determined by provider availability in your area.',
            '/dashboard');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS saved_patients_auto_upgrade ON public.saved_patients;
CREATE TRIGGER saved_patients_auto_upgrade
  AFTER INSERT ON public.saved_patients
  FOR EACH ROW EXECUTE FUNCTION public.auto_upgrade_patient_to_facility();
