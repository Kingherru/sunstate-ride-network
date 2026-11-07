-- Keep the existing authoritative live paid-base evidence checks and all badge rules.
-- A succeeded payment is server-reconciled against the qualifying base subscription
-- and exact recurring amount, excluding one-time course charges. The recorded
-- invoice total can include courses, so it must not be restricted to exact totals.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.provider_verification_evidence_internal(uuid)'::regprocedure);
BEGIN
  IF strpos(definition, 's.membership_paid_cents IN (1500,2500)') = 0 THEN
    RAISE EXCEPTION 'Expected prior membership amount guard not found; no change applied';
  END IF;
  definition := replace(definition, 's.membership_paid_cents IN (1500,2500)', 's.membership_paid_cents >= 1500');
  definition := replace(definition, 'Current $15 paid Base Provider Membership', 'Current paid Base Provider Membership');
  EXECUTE definition;
END
$migration$;