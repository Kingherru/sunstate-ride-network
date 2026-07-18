
DO $$
DECLARE
  cols text[] := ARRAY[
    'cost_total','cost_breakdown','estimated_cost_cents',
    'provider_payout_cents','platform_fee_cents','referral_fee_cents','referral_fee_source_user_id',
    'payment_status','payout_status','payout_eligible_at','payout_released_at','payout_released_by',
    'payout_hold_reasons','payout_is_medicaid','payout_validated_at','payout_validated_by',
    'payout_transfer_id','payer_kind','payer_user_id','payment_source',
    'financial_locked_at','medicaid_remit_received_at'
  ];
  c text;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trips' AND column_name='_legacy_'||c) THEN
      EXECUTE format('ALTER TABLE public.trips RENAME COLUMN %I TO %I', '_legacy_'||c, c);
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public._legacy_trip_payments RENAME TO trip_payments;
ALTER TABLE IF EXISTS public._legacy_trip_quotes RENAME TO trip_quotes;
ALTER TABLE IF EXISTS public._legacy_provider_payout_transfers RENAME TO provider_payout_transfers;

-- Re-grant read access so existing screens can still show historical records
GRANT SELECT ON public.trip_payments TO authenticated;
GRANT SELECT ON public.trip_quotes TO authenticated;
GRANT SELECT ON public.provider_payout_transfers TO authenticated;
GRANT ALL ON public.trip_payments TO service_role;
GRANT ALL ON public.trip_quotes TO service_role;
GRANT ALL ON public.provider_payout_transfers TO service_role;
