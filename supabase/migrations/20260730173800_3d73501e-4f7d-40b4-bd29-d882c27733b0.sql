-- 1. Admin-controlled referral payout percentage (hard cap 10%)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_fee_pct numeric(6,4) NOT NULL DEFAULT 0.1000;

CREATE OR REPLACE FUNCTION public.enforce_referral_fee_pct_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_fee_pct IS NULL THEN
    NEW.referral_fee_pct := 0;
  END IF;
  IF NEW.referral_fee_pct < 0 OR NEW.referral_fee_pct > 0.1000 THEN
    RAISE EXCEPTION 'Referral payout percentage must be between 0%% and 10%%';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_referral_cap ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_referral_cap
  BEFORE INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_referral_fee_pct_cap();

UPDATE public.platform_settings SET referral_fee_pct = 0.1000 WHERE id = true;

-- 2. Trips snapshot the referral payout from the admin setting only
CREATE OR REPLACE FUNCTION public.fin_snapshot_on_create()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_settings public.fin_settings;
  v_ref_pct numeric := 0;
BEGIN
  SELECT * INTO v_settings FROM public.fin_settings WHERE id = true;
  NEW.fin_platform_fee_bps := COALESCE(v_settings.platform_fee_bps, 200);

  -- Referral payout is system-calculated from the admin setting; providers
  -- cannot set or influence it.
  SELECT COALESCE(referral_fee_pct, 0) INTO v_ref_pct
    FROM public.platform_settings WHERE id = true;
  v_ref_pct := LEAST(GREATEST(COALESCE(v_ref_pct, 0), 0), 0.1000);
  NEW.fin_referral_fee_bps := ROUND(v_ref_pct * 10000)::int;

  NEW.fin_payment_state := COALESCE(NEW.fin_payment_state, 'none');
  NEW.fin_payout_state  := COALESCE(NEW.fin_payout_state, 'none');
  RETURN NEW;
END;
$$;

-- 3. Providers may not edit their own referral fee fields
CREATE OR REPLACE FUNCTION public.prevent_member_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
                        OR current_user = 'service_role'
                        OR auth.uid() IS NULL;
  is_staff boolean := false;
BEGIN
  IF is_service THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_staff := public.has_role(auth.uid(), 'admin'::public.app_role)
             OR public.is_ops_staff(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  NEW.membership_status                := OLD.membership_status;
  NEW.membership_tier                  := OLD.membership_tier;
  NEW.medicaid_verified                := OLD.medicaid_verified;
  NEW.medicaid_verified_at             := OLD.medicaid_verified_at;
  NEW.allow_live_medicaid_verification := OLD.allow_live_medicaid_verification;
  NEW.stripe_customer_id               := OLD.stripe_customer_id;
  NEW.stripe_subscription_id           := OLD.stripe_subscription_id;
  -- Referral payout is admin-controlled only.
  NEW.referral_fee_type                := OLD.referral_fee_type;
  NEW.referral_fee_amount              := OLD.referral_fee_amount;

  RETURN NEW;
END;
$$;

-- 4. Read helper for the app (safe for any signed-in user to read the rate)
CREATE OR REPLACE FUNCTION public.get_referral_fee_pct()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(GREATEST(COALESCE(referral_fee_pct, 0), 0), 0.1000)
  FROM public.platform_settings WHERE id = true
$$;

REVOKE ALL ON FUNCTION public.get_referral_fee_pct() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_fee_pct() TO authenticated, service_role;