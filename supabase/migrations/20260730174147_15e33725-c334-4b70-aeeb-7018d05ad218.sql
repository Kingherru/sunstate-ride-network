CREATE OR REPLACE FUNCTION public.apply_referral_payout_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bps int;
  v_gross_cents int;
  v_cents int;
  v_referred boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- A referral payout only applies when the trip was created by one account and
  -- performed by a different provider.
  v_referred := NEW.created_by IS NOT NULL
                AND NEW.assigned_to IS NOT NULL
                AND NEW.assigned_to <> NEW.created_by;

  IF NOT v_referred THEN
    NEW.referral_fee_cents := 0;
    NEW.referral_fee_source_user_id := NULL;
    RETURN NEW;
  END IF;

  v_bps := COALESCE(NEW.fin_referral_fee_bps, 0);
  IF v_bps <= 0 THEN
    SELECT ROUND(LEAST(GREATEST(COALESCE(referral_fee_pct, 0), 0), 0.1000) * 10000)::int
      INTO v_bps FROM public.platform_settings WHERE id = true;
  END IF;
  v_bps := LEAST(GREATEST(COALESCE(v_bps, 0), 0), 1000);

  v_gross_cents := GREATEST(0, ROUND(COALESCE(NEW.fin_gross_cents, ROUND(COALESCE(NEW.cost_total, 0) * 100))))::int;
  v_cents := (v_gross_cents * v_bps) / 10000;

  NEW.referral_fee_cents := v_cents;
  NEW.referral_fee_source_user_id := NEW.created_by;
  NEW.fin_referral_fee_bps := v_bps;
  NEW.fin_referral_fee_cents := v_cents;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_referral_payout_on_complete ON public.trips;
CREATE TRIGGER trg_zz_referral_payout_on_complete
  BEFORE UPDATE OF status ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.apply_referral_payout_on_complete();