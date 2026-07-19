
CREATE OR REPLACE FUNCTION public.block_ride_request_price_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_staff := public.has_role(auth.uid(), 'admin')
             OR public.has_role(auth.uid(), 'staff')
             OR public.has_role(auth.uid(), 'dispatcher')
             OR public.has_role(auth.uid(), 'app_manager');
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_amount_cents IS DISTINCT FROM OLD.payment_amount_cents
     OR NEW.estimated_cost_cents IS DISTINCT FROM OLD.estimated_cost_cents
     OR NEW.black_tie_quote_cents IS DISTINCT FROM OLD.black_tie_quote_cents
     OR NEW.black_tie_quote_status IS DISTINCT FROM OLD.black_tie_quote_status
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
  THEN
    RAISE EXCEPTION 'Not allowed to modify pricing or payment fields on ride_requests'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_ride_request_price_tampering() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_block_ride_request_price_tampering ON public.ride_requests;
CREATE TRIGGER trg_block_ride_request_price_tampering
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.block_ride_request_price_tampering();


CREATE OR REPLACE FUNCTION public.block_member_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_staff := public.has_role(auth.uid(), 'admin')
             OR public.has_role(auth.uid(), 'staff')
             OR public.has_role(auth.uid(), 'app_manager');
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier
     OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
     OR NEW.medicaid_verified IS DISTINCT FROM OLD.medicaid_verified
     OR NEW.medicaid_verified_at IS DISTINCT FROM OLD.medicaid_verified_at
     OR NEW.referral_fee_amount IS DISTINCT FROM OLD.referral_fee_amount
     OR NEW.referral_fee_type IS DISTINCT FROM OLD.referral_fee_type
  THEN
    RAISE EXCEPTION 'Not allowed to modify membership, verification, or referral fee fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_member_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_block_member_profile_privilege_escalation ON public.member_profiles;
CREATE TRIGGER trg_block_member_profile_privilege_escalation
BEFORE UPDATE ON public.member_profiles
FOR EACH ROW EXECUTE FUNCTION public.block_member_profile_privilege_escalation();


DROP POLICY IF EXISTS "fin_settings readable" ON public.fin_settings;
DROP POLICY IF EXISTS "fin_settings admin readable" ON public.fin_settings;

CREATE POLICY "fin_settings admin readable"
ON public.fin_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'app_manager'));
