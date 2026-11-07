-- Read-only assertions of the deployed evaluator's amount guard. No account writes.
-- The server first validates the exact recurring amount, excludes course charges,
-- and stamps succeeded; SQL preserves that proof rather than re-pricing totals.
WITH definition AS (
  SELECT pg_get_functiondef('public.provider_verification_evidence_internal(uuid)'::regprocedure) AS body
), guard AS (
  SELECT substring(body FROM 's[.]membership_paid_cents >= ([0-9]+)')::integer AS minimum,
         strpos(body, 's.membership_payment_state=''succeeded''') > 0
         AND strpos(body, 's.price_id=''nemt_provider_base_monthly''') > 0
         AND strpos(body, 's.environment=''live''') > 0
         AND strpos(body, 's.status=''active''') > 0
         AND strpos(body, 's.current_period_end>now()') > 0
         AND strpos(body, 's.membership_currency=''usd''') > 0
         AND strpos(body, 's.membership_invoice_id IS NOT NULL') > 0
         AND strpos(body, 's.membership_paid_at IS NOT NULL') > 0 AS proof_preserved
  FROM definition
), cases(label, cents, expected) AS (
  VALUES ('approved_base_20', 2000, true),
         ('approved_base_and_network_30', 3000, true),
         ('base_and_one_course_70', 7000, true),
         ('combined_and_two_courses_130', 13000, true),
         ('legacy_base_15', 1500, true),
         ('legacy_combined_25', 2500, true),
         ('addon_only_10', 1000, false),
         ('unpaid', 0, false)
)
SELECT label, 1 / CASE WHEN proof_preserved AND minimum = 1500
  AND (cents >= minimum) = expected THEN 1 ELSE 0 END AS passed
FROM guard CROSS JOIN cases;