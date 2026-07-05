
CREATE TABLE IF NOT EXISTS public.staff_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_display_id text,
  actor_email text,
  action text NOT NULL,
  target_kind text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_audit_log_created_at_idx
  ON public.staff_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS staff_audit_log_action_idx
  ON public.staff_audit_log (action);

GRANT SELECT ON public.staff_audit_log TO authenticated;
GRANT ALL ON public.staff_audit_log TO service_role;
ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit log readable by admin/app_manager"
  ON public.staff_audit_log FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','app_manager']::app_role[]));

-- Security-definer logger; callable from any authenticated context
CREATE OR REPLACE FUNCTION public.log_staff_action(
  _action text,
  _target_kind text,
  _target_id text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_display text;
  v_email text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT display_id INTO v_display FROM public.member_profiles WHERE user_id = v_uid;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.staff_audit_log
    (actor_user_id, actor_display_id, actor_email, action, target_kind, target_id, metadata)
    VALUES (v_uid, v_display, v_email, _action, _target_kind, _target_id, COALESCE(_metadata, '{}'::jsonb))
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.log_staff_action(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_staff_action(text, text, text, jsonb) TO authenticated;

-- Trigger: log provider application status changes
CREATE OR REPLACE FUNCTION public.log_provider_app_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','denied') THEN
    PERFORM public.log_staff_action(
      'provider_application_' || NEW.status,
      'provider_application',
      NEW.id::text,
      jsonb_build_object(
        'display_id', NEW.display_id,
        'company_name', NEW.company_name,
        'email', NEW.email,
        'review_notes', NEW.review_notes
      )
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_provider_app_status ON public.provider_applications;
CREATE TRIGGER trg_log_provider_app_status
  AFTER UPDATE ON public.provider_applications
  FOR EACH ROW EXECUTE FUNCTION public.log_provider_app_status_change();
