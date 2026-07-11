-- Add estimated price anchor to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS estimated_cost_cents INTEGER;

-- Backfill from cost_total when we have one and no estimate
UPDATE public.trips
   SET estimated_cost_cents = ROUND(cost_total * 100)::int
 WHERE estimated_cost_cents IS NULL
   AND cost_total IS NOT NULL;

-- Recreate submit_trip_quote with 50-mile / 50%-over-estimate cap
CREATE OR REPLACE FUNCTION public.submit_trip_quote(
  _trip_id uuid,
  _amount_cents integer,
  _note text DEFAULT NULL,
  _allow_over_cap boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  r record;
  t record;
  v_miles numeric;
  v_estimate integer;
  v_cap integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_approved_provider(auth.uid()) THEN
    RAISE EXCEPTION 'Only approved providers can submit trip quotes' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.provider_has_valid_credentials(auth.uid()) THEN
    RAISE EXCEPTION 'Provider credentials are missing or expired' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  v_miles := COALESCE(t.actual_miles, t.estimated_miles, 0);
  v_estimate := COALESCE(t.estimated_cost_cents, ROUND(COALESCE(t.cost_total,0) * 100)::int);

  -- Short-trip guardrail: quote cannot exceed 150% of the estimate unless staff overrides
  IF v_miles > 0 AND v_miles < 50 AND v_estimate > 0 AND NOT _allow_over_cap THEN
    v_cap := ROUND(v_estimate * 1.5)::int;
    IF _amount_cents > v_cap THEN
      RAISE EXCEPTION 'Quote exceeds the 50%% cap for trips under 50 miles (cap: $%). Contact dispatch for an override.',
        to_char((v_cap::numeric/100), 'FM999,999,999.00')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.trip_quotes (trip_id, provider_user_id, amount_cents, note)
    VALUES (_trip_id, auth.uid(), _amount_cents, _note)
    RETURNING id INTO v_id;

  -- Notify ops
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','dispatcher') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_quote_submitted', 'New provider quote',
            'A provider submitted a quote of $' || to_char((_amount_cents::numeric/100), 'FM999,999,999.00') ||
              ' for trip ' || COALESCE(t.display_id, t.id::text) || '.',
            '/admin?tab=dispatch');
  END LOOP;

  -- Notify the requester (patient / facility) so they can review the new quote
  IF t.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (t.created_by, 'trip_quote_submitted', 'A provider submitted a quote',
            'A provider quoted $' || to_char((_amount_cents::numeric/100), 'FM999,999,999.00') ||
              ' for trip ' || COALESCE(t.display_id, t.id::text) || '. It will be sent to you after review.',
            '/dashboard');
  END IF;

  RETURN v_id;
END $function$;

REVOKE EXECUTE ON FUNCTION public.submit_trip_quote(uuid, integer, text, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_trip_quote(uuid, integer, text, boolean) TO authenticated;

-- On quote approval, mirror the amount onto trips.cost_total so every portal reads the same value
CREATE OR REPLACE FUNCTION public.apply_approved_quote_to_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.trips
       SET cost_total = (NEW.amount_cents::numeric / 100)
     WHERE id = NEW.trip_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_approved_quote_to_trip ON public.trip_quotes;
CREATE TRIGGER trg_apply_approved_quote_to_trip
  AFTER UPDATE ON public.trip_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_approved_quote_to_trip();