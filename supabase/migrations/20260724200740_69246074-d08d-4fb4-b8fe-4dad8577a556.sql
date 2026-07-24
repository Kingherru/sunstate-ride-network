-- ride_requests
REVOKE UPDATE (
  payment_amount_cents,
  estimated_cost_cents,
  black_tie_quote_cents
) ON public.ride_requests FROM authenticated, anon;

-- trips
REVOKE UPDATE (
  cost_total,
  cost_breakdown,
  estimated_cost_cents,
  provider_payout_cents,
  payout_status,
  payout_released_at,
  payout_transfer_id,
  payout_eligible_at,
  payout_hold_reasons,
  payout_is_medicaid,
  payout_validated_at,
  payout_validated_by,
  payout_released_by,
  payment_status,
  payment_source,
  referral_fee_cents,
  referral_fee_source_user_id,
  fin_gross_cents,
  fin_platform_fee_bps,
  fin_platform_fee_cents,
  fin_referral_fee_bps,
  fin_referral_fee_cents,
  fin_provider_net_cents,
  fin_payer_kind,
  fin_payer_user_id,
  fin_payment_source,
  fin_payment_state,
  fin_payout_state,
  fin_is_medicaid,
  fin_medicaid_funds_received_at,
  fin_payout_hold_until,
  fin_completed_at,
  fin_locked_at
) ON public.trips FROM authenticated, anon;

GRANT UPDATE ON public.trips TO service_role;
GRANT UPDATE ON public.ride_requests TO service_role;