
-- ── Provider Medicaid verification fields ──
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS medicaid_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS medicaid_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS allow_live_medicaid_verification boolean NOT NULL DEFAULT false;

-- ── Packet audit history ──
CREATE TABLE IF NOT EXISTS public.medicaid_packet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.medicaid_packets(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_display_id text,
  action text NOT NULL,
  from_status text,
  to_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medicaid_packet_events_packet ON public.medicaid_packet_events(packet_id, created_at DESC);

GRANT SELECT, INSERT ON public.medicaid_packet_events TO authenticated;
GRANT ALL ON public.medicaid_packet_events TO service_role;

ALTER TABLE public.medicaid_packet_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider views own packet events"
  ON public.medicaid_packet_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medicaid_packets p
                 WHERE p.id = packet_id AND p.provider_user_id = auth.uid()));

CREATE POLICY "ops staff views all packet events"
  ON public.medicaid_packet_events FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "provider inserts own packet events"
  ON public.medicaid_packet_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.medicaid_packets p
                WHERE p.id = packet_id AND p.provider_user_id = auth.uid())
  );

-- ── Eligibility checks log ──
CREATE TABLE IF NOT EXISTS public.medicaid_eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicaid_number text NOT NULL,
  patient_last_name text,
  patient_dob date,
  result_status text NOT NULL DEFAULT 'pending',
  result_plan text,
  result_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medicaid_eligibility_provider ON public.medicaid_eligibility_checks(provider_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.medicaid_eligibility_checks TO authenticated;
GRANT ALL ON public.medicaid_eligibility_checks TO service_role;

ALTER TABLE public.medicaid_eligibility_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider manages own eligibility checks"
  ON public.medicaid_eligibility_checks FOR SELECT TO authenticated
  USING (provider_user_id = auth.uid() OR public.is_ops_staff(auth.uid()));

CREATE POLICY "provider inserts eligibility checks"
  ON public.medicaid_eligibility_checks FOR INSERT TO authenticated
  WITH CHECK (provider_user_id = auth.uid());

-- ── Trigger: audit + notify on packet status change ──
CREATE OR REPLACE FUNCTION public.on_medicaid_packet_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_display text;
  v_title text;
  v_body text;
  v_type text;
BEGIN
  SELECT display_id INTO v_display FROM public.member_profiles WHERE user_id = v_actor;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.medicaid_packet_events (packet_id, actor_user_id, actor_display_id, action, to_status, metadata)
      VALUES (NEW.id, v_actor, v_display, 'created', NEW.status, jsonb_build_object('title', NEW.title));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.medicaid_packet_events (packet_id, actor_user_id, actor_display_id, action, from_status, to_status, metadata)
      VALUES (NEW.id, v_actor, v_display, 'status_changed', OLD.status, NEW.status,
              jsonb_build_object('submission_reference', NEW.submission_reference));

    IF NEW.status IN ('approved','accepted','rejected') THEN
      IF NEW.status = 'rejected' THEN
        v_type := 'medicaid_packet_rejected';
        v_title := 'Medicaid packet rejected';
        v_body := 'Your packet "' || NEW.title || '" was rejected. Open the Medicaid Submission Center to review details.';
      ELSE
        v_type := 'medicaid_packet_approved';
        v_title := 'Medicaid packet approved';
        v_body := 'Your packet "' || NEW.title || '" was approved. Open the Medicaid Submission Center to review details.';
      END IF;
      INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (NEW.provider_user_id, v_type, v_title, v_body, '/provider/dashboard?tab=medicaid');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_medicaid_packets_events ON public.medicaid_packets;
CREATE TRIGGER trg_medicaid_packets_events
  AFTER INSERT OR UPDATE ON public.medicaid_packets
  FOR EACH ROW EXECUTE FUNCTION public.on_medicaid_packet_change();

-- ── Trigger: log packet item add/remove into audit ──
CREATE OR REPLACE FUNCTION public.on_medicaid_packet_item_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_display text;
BEGIN
  SELECT display_id INTO v_display FROM public.member_profiles WHERE user_id = v_actor;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.medicaid_packet_events (packet_id, actor_user_id, actor_display_id, action, metadata)
      VALUES (NEW.packet_id, v_actor, v_display, 'item_added',
              jsonb_build_object('kind', NEW.kind, 'label', NEW.label, 'doc_path', NEW.doc_path, 'trip_id', NEW.trip_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.medicaid_packet_events (packet_id, actor_user_id, actor_display_id, action, metadata)
      VALUES (OLD.packet_id, v_actor, v_display, 'item_removed',
              jsonb_build_object('kind', OLD.kind, 'label', OLD.label, 'doc_path', OLD.doc_path, 'trip_id', OLD.trip_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_medicaid_packet_items_events ON public.medicaid_packet_items;
CREATE TRIGGER trg_medicaid_packet_items_events
  AFTER INSERT OR DELETE ON public.medicaid_packet_items
  FOR EACH ROW EXECUTE FUNCTION public.on_medicaid_packet_item_change();

-- ── Block Medicaid-funded trip assignments when provider is not Medicaid-verified ──
CREATE OR REPLACE FUNCTION public.enforce_medicaid_verification_on_assign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_verified boolean;
  is_medicaid boolean;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  is_medicaid := (
    coalesce(lower(NEW.payer), '') LIKE '%medicaid%'
    OR NEW.medicaid_number IS NOT NULL
    OR NEW.medicaid_plan IS NOT NULL
  );

  IF NOT is_medicaid THEN RETURN NEW; END IF;

  SELECT medicaid_verified INTO v_verified FROM public.member_profiles WHERE user_id = NEW.assigned_to;
  IF NOT coalesce(v_verified, false) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.assigned_to, 'medicaid_verification_required',
              'Medicaid trip blocked — verification required',
              'A Medicaid-funded trip could not be assigned because your Medicaid credentials are missing or unverified. Open the Medicaid Submission Center to submit or update documentation.',
              '/provider/dashboard?tab=medicaid');
    RAISE EXCEPTION 'Provider Medicaid credentials are not verified; Medicaid trip assignment blocked.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_medicaid_verification ON public.trips;
CREATE TRIGGER trg_enforce_medicaid_verification
  BEFORE UPDATE OF assigned_to ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.enforce_medicaid_verification_on_assign();
