
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS priority_offer_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.respond_priority_offer(_trip_id uuid, _accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.priority_offer_provider_id IS NULL OR t.priority_offer_provider_id <> auth.uid() THEN
    RAISE EXCEPTION 'This offer is not addressed to you';
  END IF;
  IF t.priority_offer_expires_at IS NULL OR t.priority_offer_expires_at < now() THEN
    RAISE EXCEPTION 'This priority offer has expired';
  END IF;

  IF _accept THEN
    UPDATE public.trips
       SET assigned_to = auth.uid(),
           status = 'assigned',
           priority_offer_accepted_at = now(),
           priority_offer_provider_id = NULL,
           priority_offer_expires_at = NULL
     WHERE id = _trip_id;
  ELSE
    UPDATE public.trips
       SET priority_offer_refused_at = now(),
           priority_offer_provider_id = NULL,
           priority_offer_expires_at = NULL
     WHERE id = _trip_id;
  END IF;
END $function$;
