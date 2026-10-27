ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS base_price_cents integer,
  ADD COLUMN IF NOT EXISTS network_addon_status text NOT NULL DEFAULT 'not_selected',
  ADD COLUMN IF NOT EXISTS network_addon_cancel_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_network_addon_status_chk
  CHECK (network_addon_status IN ('not_selected','trialing','active','past_due','canceling','canceled','needs_review'));

CREATE TABLE public.provider_membership_trials (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id),
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  source_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_membership_trials TO authenticated;
GRANT ALL ON public.provider_membership_trials TO service_role;
ALTER TABLE public.provider_membership_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and master admin read trials" ON public.provider_membership_trials FOR SELECT TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.provider_membership_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_row_id uuid NOT NULL UNIQUE REFERENCES public.subscriptions(id),
  workspace_id uuid REFERENCES public.workspaces(id),
  environment text NOT NULL,
  current_cents integer,
  proposed_cents integer NOT NULL DEFAULT 1500,
  renewal_at timestamptz,
  status text NOT NULL DEFAULT 'needs_review' CHECK (status IN ('pending','needs_review','approved_for_renewal','completed','canceled')),
  reason text,
  prepared_by uuid, prepared_by_mfn_id text, prepared_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid, activated_by_mfn_id text, activated_at timestamptz
);
GRANT SELECT ON public.provider_membership_transitions TO authenticated;
GRANT ALL ON public.provider_membership_transitions TO service_role;
ALTER TABLE public.provider_membership_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and master admin read transitions" ON public.provider_membership_transitions FOR SELECT TO authenticated
  USING ((workspace_id IS NOT NULL AND public.workspace_role_of(workspace_id, auth.uid()) = 'owner') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.prepare_membership_transitions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; r record; linked boolean; mfn text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Master Admin only'; END IF;
  SELECT mfn_id INTO mfn FROM public.user_profiles WHERE user_id = auth.uid();
  FOR r IN SELECT s.* FROM public.subscriptions s WHERE s.price_id = 'nemt_membership_monthly_v2' AND s.status IN ('active','trialing','past_due')
    AND NOT EXISTS (SELECT 1 FROM public.provider_membership_transitions t WHERE t.subscription_row_id = s.id) LOOP
    linked := r.workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workspace_members m JOIN public.workspaces w ON w.id=m.workspace_id
      WHERE m.workspace_id=r.workspace_id AND m.user_id=r.user_id AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL AND w.account_type='provider');
    INSERT INTO public.provider_membership_transitions(subscription_row_id, workspace_id, environment, current_cents, proposed_cents, renewal_at, status, reason, prepared_by, prepared_by_mfn_id)
    VALUES (r.id, CASE WHEN linked THEN r.workspace_id END, r.environment, 1000, 1500, r.current_period_end,
      CASE WHEN linked THEN 'pending' ELSE 'needs_review' END, CASE WHEN linked THEN NULL ELSE 'Subscription is not linked to one verified provider business owner.' END, auth.uid(), mfn);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prepare_membership_transitions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_membership_transitions() TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_membership_transition(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mfn text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Master Admin only'; END IF;
  IF NOT COALESCE((SELECT enabled FROM public.platform_launch_flags WHERE key='membership_renewal_transition'), false) THEN
    RAISE EXCEPTION 'Renewal transition is not enabled'; END IF;
  SELECT mfn_id INTO mfn FROM public.user_profiles WHERE user_id = auth.uid();
  UPDATE public.provider_membership_transitions SET status='approved_for_renewal', activated_by=auth.uid(), activated_by_mfn_id=mfn, activated_at=now()
   WHERE id=_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only pending linked transitions can be approved'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.approve_membership_transition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_membership_transition(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.provider_network_entitled(_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions s JOIN public.workspace_members m ON m.workspace_id=s.workspace_id AND m.user_id=s.user_id
    WHERE s.workspace_id=_ws AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL AND (
      (s.price_id='nemt_membership_monthly_v2' AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now()))
      OR (s.price_id='nemt_provider_base_monthly' AND s.status='trialing' AND s.network_addon_status='trialing')
      OR (s.price_id='nemt_provider_base_monthly' AND s.status='active' AND s.current_period_end>now() AND (s.network_addon_status='active'
          OR (s.network_addon_status='canceling' AND s.network_addon_cancel_at>now())))))
$$;
REVOKE ALL ON FUNCTION public.provider_network_entitled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_network_entitled(uuid) TO authenticated, service_role;

ALTER TABLE public.saved_patients
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id),
  ADD COLUMN IF NOT EXISTS weight_lbs integer CHECK (weight_lbs IS NULL OR weight_lbs BETWEEN 1 AND 1500),
  ADD COLUMN IF NOT EXISTS mobility_device text,
  ADD COLUMN IF NOT EXISTS wheelchair_type text,
  ADD COLUMN IF NOT EXISTS assistance_needs text,
  ADD COLUMN IF NOT EXISTS oxygen_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS communication_needs text,
  ADD COLUMN IF NOT EXISTS service_requirements text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

CREATE POLICY "Workspace managers read workspace patients" ON public.saved_patients FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "Workspace managers update workspace patients" ON public.saved_patients FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (workspace_id IS NOT NULL AND public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));

CREATE TABLE public.saved_patient_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.saved_patients(id),
  workspace_id uuid,
  action text NOT NULL CHECK (action IN ('created','edited','deactivated','restored')),
  actor_user_id uuid, actor_mfn_id text, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.saved_patient_events TO authenticated;
GRANT ALL ON public.saved_patient_events TO service_role;
ALTER TABLE public.saved_patient_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient managers read history" ON public.saved_patient_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.saved_patients p WHERE p.id = patient_id));

CREATE OR REPLACE FUNCTION public.saved_patients_guard_and_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text; mfn text;
BEGIN
  IF NEW.workspace_id IS NOT NULL AND auth.uid() IS NOT NULL
     AND COALESCE(public.workspace_role_of(NEW.workspace_id, auth.uid())::text,'') NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Not authorized for this workspace';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id AND OLD.workspace_id IS NOT NULL THEN
    RAISE EXCEPTION 'Patient workspace cannot be changed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.active IS DISTINCT FROM OLD.active THEN
    IF NEW.active THEN NEW.deactivated_at := NULL; ELSE NEW.deactivated_at := now();
      IF COALESCE(trim(NEW.deactivation_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF; END IF;
  END IF;
  act := CASE WHEN TG_OP='INSERT' THEN 'created' WHEN NEW.active IS DISTINCT FROM OLD.active THEN CASE WHEN NEW.active THEN 'restored' ELSE 'deactivated' END ELSE 'edited' END;
  SELECT mfn_id INTO mfn FROM public.user_profiles WHERE user_id = auth.uid();
  INSERT INTO public.saved_patient_events(patient_id, workspace_id, action, actor_user_id, actor_mfn_id, reason)
  VALUES (NEW.id, NEW.workspace_id, act, auth.uid(), mfn, CASE WHEN act IN ('deactivated','restored') THEN NEW.deactivation_reason END);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_saved_patients_audit_ins AFTER INSERT ON public.saved_patients FOR EACH ROW EXECUTE FUNCTION public.saved_patients_guard_and_audit();
CREATE TRIGGER trg_saved_patients_guard_upd BEFORE UPDATE ON public.saved_patients FOR EACH ROW EXECUTE FUNCTION public.saved_patients_guard_and_audit();

CREATE TABLE public.user_portal_preferences (
  user_id uuid PRIMARY KEY,
  interface_density text NOT NULL DEFAULT 'standard' CHECK (interface_density IN ('compact','standard','comfortable')),
  default_payer_id uuid REFERENCES public.payers(id) ON DELETE SET NULL,
  default_payment_method_id uuid REFERENCES public.saved_payment_methods(id) ON DELETE SET NULL,
  pay_by_invoice boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_portal_preferences TO authenticated;
GRANT ALL ON public.user_portal_preferences TO service_role;
ALTER TABLE public.user_portal_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own portal preferences" ON public.user_portal_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());