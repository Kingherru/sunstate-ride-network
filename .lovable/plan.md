
## Goal

Delete the existing payment/payout code and rebuild it as one clean, secure, easy-to-follow system. The trip stays the single source of truth for money — but every rule, fee calculation, status, and workflow is replaced, not patched.

## Step 1 — Audit what exists today (so we know what to remove)

Current payment/payout surface (from prior work in this project):

**Database (trips table & related):**
- Financial columns on `trips`: `cost_total`, `cost_breakdown`, `estimated_cost_cents`, `provider_payout_cents`, `platform_fee_cents`, `referral_fee_cents`, `referral_fee_source_user_id`, `payment_status`, `payout_status`, `payout_eligible_at`, `payout_released_at`, `payout_hold_reasons`, `payout_is_medicaid`, `payout_validated_at/by`, `payout_released_by`, `payer_kind`, `payer_user_id`, `payment_source`, `financial_locked_at`, `medicaid_remit_received_at`.
- Related tables: `trip_payments`, `trip_quotes`, `provider_payout_accounts`, `provider_payout_transfers`, `provider_pricing`, `platform_settings` (platform_fee_pct), `subscriptions`, `stripe_customers`, `payer_stripe_customers`, `payer_payment_methods`, `saved_payment_methods`.
- Triggers: `snapshot_trip_referral_fee`, `prevent_trip_financial_self_edit`, `lock_trip_financials_after_release`, `prevent_payout_transfer_client_write`, `prevent_trip_self_assignment`.
- Views/RPCs: `trip_financial_ledger`, `set_trip_payment_status`, `attemptTripPayoutRelease`, cron job auto-releasing payouts every 15 min.

**Server functions & routes:**
- `src/lib/payouts.ts`, `payouts.functions.ts`, `payouts.server.ts` — platform fee %, payout math, release logic, validation.
- `src/lib/platform-fee.functions.ts` — reads settings.
- `src/utils/payments.functions.ts` — Stripe checkout session for memberships.
- `src/lib/saved-payments.functions.ts` — `payForConfirmedTrip` (per-trip charge).
- `src/routes/api/public/hooks/release-eligible-payouts.ts` — cron endpoint.
- `src/routes/api/public/payments/webhook.ts` — Stripe webhook.
- Referral fee snapshot + `TripFinancialBreakdown.tsx`, `ReferralReviewModal.tsx`.

**UI:**
- `PaymentStatusControl`, `PayTripButton`, `AdminPayoutQueue`, `AdminFinancialLedger`, `PayoutsPanel`, `TripFinancialBreakdown`, `ReferralFeeCard`, membership pricing UI.
- Membership subscriptions (Stripe) are separate and stay — this rebuild is trip-money only.

All of the above is being torn down (except memberships/Stripe Connect client scaffolding).

## Step 2 — New architecture (clean rewrite)

**Principle:** One trip = one money record. Money flows: **Payer → MFN → Provider**. Providers never pay each other directly.

### Statuses (single lifecycle per trip)

```text
payment_state:  none → invoiced → paid → validated → refunded
payout_state:   none → holding → releasable → paid_out → cancelled
```

- `payment_state` is set by MFN when funds are received/verified.
- `payout_state` moves independently once payment is `validated` AND hold window passes.

### Fees (recomputed on the server, never trusted from the client)

- `platform_fee_bps` (basis points) stored per trip, snapshotted from `platform_settings.platform_fee_bps` at trip creation.
- `referral_fee_bps` snapshotted from sending provider's saved default at creation.
- Both stored as `int` bps (not floats). Provider net = `gross - platform_fee - referral_fee`.

### Hold windows

- Standard trips: `payout_hold_hours = 48` after trip `completed_at`.
- Medicaid trips: `payout_hold_days = 15` after `medicaid_funds_received_at` (Net 15).
- Provider payout is only `releasable` once BOTH hold + `payment_state = validated` are satisfied.

### Security (non-negotiable, enforced in DB)

- All financial columns: `REVOKE UPDATE ... FROM authenticated, anon`. Only `service_role` writes them.
- Trigger blocks self-assignment (creator = provider).
- Trigger locks all fields once `payout_state = paid_out`.
- No client-side function can mutate fees, payouts, or trigger transfers.

## Step 3 — Implementation order

1. **Migration A — Teardown**: drop old triggers, RPCs, columns, and the `trip_financial_ledger` view. Drop `trip_payments`, `trip_quotes`, `provider_payout_transfers` (data preserved via `_legacy` schema rename for audit).
2. **Migration B — New schema**:
   - `trip_finance` columns on `trips`: `gross_cents`, `platform_fee_bps`, `platform_fee_cents`, `referral_fee_bps`, `referral_fee_cents`, `provider_net_cents`, `payer_kind`, `payer_user_id`, `payment_source`, `payment_state`, `payout_state`, `payout_hold_until`, `is_medicaid`, `medicaid_funds_received_at`, `completed_at`, `finalized_at`.
   - New tables: `trip_charges` (each inbound payment attempt), `provider_payouts` (each outbound transfer). Both audit-only from client.
   - New RPCs (SECURITY DEFINER, admin/service only): `finance_snapshot_on_create`, `finance_mark_paid`, `finance_validate`, `finance_release_payout`, `finance_refund`.
   - New view `admin_trip_finance` gated to admin.
   - Full GRANT + RLS block.
3. **Server code**:
   - Delete `payouts.ts`, `payouts.functions.ts`, `payouts.server.ts`, `platform-fee.functions.ts`, `saved-payments.functions.ts` (payForConfirmedTrip only), old release-eligible-payouts cron.
   - Add `src/lib/finance/` module: `constants.ts`, `math.ts`, `finance.functions.ts` (thin client-callable readers), `finance.server.ts` (privileged writers).
   - New cron `api/public/hooks/finance-release-tick.ts` runs every 15 min, calls `finance_release_payout` for all eligible trips.
   - Stripe webhook rewired to call `finance_mark_paid` only.
4. **UI**:
   - Delete `AdminPayoutQueue`, `AdminFinancialLedger`, `PaymentStatusControl`, `PayTripButton`, `TripFinancialBreakdown`, `ReferralReviewModal`, `PayoutsPanel`, `ReferralFeeCard`.
   - Build fresh: `TripMoneyCard` (provider view — read-only breakdown + statuses), `AdminFinanceConsole` (single admin page: search, filter, one row per trip with all money data + admin actions), `ProviderPayoutsPanel` (list of `provider_payouts` with status).
   - Update `NewTripForm` to show the new server-computed breakdown (call a `previewTripFinance` server fn instead of client math).
5. **Docs**: Update `.lovable/plan.md` with the new money-flow diagram; update security memory to reflect the new locked-down surface.

## Technical details

- All money stored as `int cents`, all rates as `int bps`.
- Every finance mutation goes through a SECURITY DEFINER RPC that logs to `staff_audit_log`.
- Legacy data preserved in `_legacy_finance` schema for 90 days (read-only, admin-only).
- Membership Stripe flow untouched.

## Out of scope for this rebuild

- Membership subscriptions & pricing.
- Stripe Connect onboarding UI (kept as-is; only the payout call surface changes).
- Driver earnings reports.

Approve this and I'll execute Steps 1–5 in order.
