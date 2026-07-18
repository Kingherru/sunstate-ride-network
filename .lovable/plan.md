
# Payment & Payout System — Audit and Simplification Plan

## 1. Audit findings (how money moves today)

**Trip financial columns (already exist on `trips`)**
- `cost_total`, `cost_breakdown`, `estimated_cost_cents`
- `payment_status` (`unpaid | authorized | paid | refunded | failed`)
- `provider_payout_cents`, `platform_fee_cents`, `referral_fee_cents`, `referral_fee_source_user_id`
- `payout_status` (`pending | held | released | failed`), `payout_eligible_at`, `payout_hold_reasons[]`, `payout_is_medicaid`, `payout_validated_at/by`, `payout_released_at/by`, `payout_transfer_id`

**Supporting tables**
- `trip_payments` — inbound charges (Stripe payment intents from patient/facility/broker)
- `provider_payout_transfers` — outbound Stripe transfers to providers
- `trip_quotes` — provider-submitted price quotes requiring approval
- `platform_settings.platform_fee_pct` — global platform fee %
- `member_profiles.referral_fee_type/amount` — referral defaults per sender

**Existing protections (good, keep)**
- `prevent_trip_financial_self_edit` trigger — only service_role/admin can write financial columns
- `prevent_trip_self_assignment` trigger + CHECK — creator ≠ assignee
- `enforce_assigned_provider_is_approved` — no assignment to soft-access providers
- `enforce_provider_credentials_on_assign` — expired credentials block
- `prevent_payout_transfer_client_write` — only service can write transfers
- `payouts.server.ts::attemptTripPayoutRelease` — idempotent, recomputes fees, honors hold window, double-payment guard
- cron endpoint `/api/public/hooks/release-eligible-payouts` — auto-releases eligible non-Medicaid + Medicaid past Net-15

**Problems observed**
1. Payment scenarios (patient / facility / broker / Medicaid / referral) share `payment_status` values with no explicit *payer type* → admin can't see "who paid" at a glance.
2. Medicaid vs standard trips share the same status field; Net-15 gating is implicit via `payout_eligible_at`.
3. `payment_status = 'paid'` in DB vs `'confirmed'` used in `payouts.server.ts` gate — mismatch means Medicaid trips can never satisfy `payment_status !== 'confirmed'` check (bug: server checks `confirmed`, DB constraint only allows `paid`).
4. No canonical `payer_kind` column; `payer` is free text.
5. Admin financial view is scattered across `AdminPayoutQueue`, `AdminTripsPanels`, `MonthlyPayoutReport` — no single "one trip = one record" view.
6. Referral fee is snapshotted only on INSERT — post-creation edits to sender's default don't reflect (correct, but not documented in UI).
7. `PaymentStatusControl` allows manual toggling by non-admins in some contexts — needs role gate audit.

---

## 2. Target model — One Trip = One Financial Record

Canonical lifecycle (single `payment_status` + `payout_status` pair per trip):

```text
payment_status:  pending_invoice → invoiced → paid → validated → refunded/failed
payout_status:   pending → held → approved → released → failed
```

Unified flow:

```text
Trip created
   ↓ (payer_kind determines path)
Payment Required  →  Payment Received  →  Trip Completed
   ↓                                          ↓
Payment Validated (admin/auto)  →  Platform Fees Applied
   ↓
Provider Payout Approved  →  Provider Paid (Stripe transfer)
```

Medicaid track diverges only at "Payment Received":
```text
Medicaid: Trip Completed → Awaiting Medicaid Remit → Funds Received → Net-15 Hold → Approved → Paid
```

---

## 3. Database changes (single migration)

Add to `trips`:
- `payer_kind text` — enum-like: `patient | facility | broker | workers_comp | medicaid | provider_referral | provider_self`
- `payer_user_id uuid` — who owes / paid (nullable for Medicaid)
- `payment_source text` — `stripe_card | stripe_ach | medicaid_claim | broker_invoice | manual`
- `financial_locked_at timestamptz` — set when payout released; blocks further edits even by admin without override flag

Fix bug:
- Update `attemptTripPayoutRelease` to check `payment_status IN ('paid','validated')` instead of `'confirmed'`.

Add derived view `trip_financial_ledger` (SECURITY INVOKER) with columns:
`trip_id, display_id, payer_kind, payer_name, payment_source, gross_cents, platform_fee_cents, referral_fee_cents, provider_payout_cents, payment_status, payout_status, provider_name, referral_source_name, completed_at, paid_at, released_at, hold_reasons`

Trigger `lock_trip_financials_after_release` — once `payout_status='released'`, block updates to any financial column (service_role bypass with explicit `financial_override=true` GUC).

Simplify `payment_status` constraint to include: `pending_invoice, invoiced, paid, validated, refunded, failed` (migrate existing `unpaid→pending_invoice`, `authorized→invoiced`).

## 4. Server function changes

- `src/lib/payouts.functions.ts` — add `validateTripPayment(tripId)` (admin) that moves `paid → validated` and sets `payout_status='approved'` for non-Medicaid, or schedules Net-15 for Medicaid.
- `payouts.server.ts` — gate release on `payment_status='validated'` (not `confirmed`). Medicaid path requires `medicaid_remit_received_at` (new column) before Net-15 starts.
- Remove any code path that lets a provider mutate `cost_total` outside `trip_quotes` approval flow (audit `pricing.functions.ts::recalcTripCost` — already safe, returns `quote_required:true`).

## 5. Admin Financial View (new)

New component `src/components/admin/AdminFinancialLedger.tsx` mounted under Admin → Finance tab:
- Table over `trip_financial_ledger` view
- Filters: payer_kind, payment_status, payout_status, date range, provider, Medicaid-only
- Columns exactly matching user's request: Trip #, Amount, Who Paid, Source, Provider, Platform Fee, Referral Fee, Payout, Payment Status, Payout Status
- Row actions (admin only): Validate Payment, Approve Payout, Release Now (override), Mark Medicaid Remit Received, View history
- CSV export

Consolidate `AdminPayoutQueue` into the same view as a filter preset ("Ready to release").

## 6. Referral flow reinforcement

- Provider A creates trip → single financial record with `payer_kind='provider_referral'`, `referral_fee_source_user_id=A`
- Provider B reviews via `ReferralReviewModal` — must accept financial terms before `assigned_to` is set (already implemented; verify trigger prevents bypass)
- Payment collected once from originating payer (or Provider A if they front it), platform + referral fee deducted, net to Provider B
- No provider-to-provider Stripe transfers — platform is always the counterparty

## 7. Permissions audit / hardening

- Re-verify all financial columns are in the `prevent_trip_financial_self_edit` blocklist (add `payer_kind`, `payer_user_id`, `payment_source`, `financial_locked_at`)
- Confirm `PaymentStatusControl` UI is admin-only (add `is_ops_staff` gate)
- Confirm no server function accepts client-supplied payout amounts
- Add DB unit check: `provider_payout_cents = gross - platform_fee - referral_fee` enforced by trigger

## 8. UI copy / policy updates

- Medicaid section: "Medicaid trips pay Net-15 after we receive remittance."
- Payouts panel: show explicit stage (Pending → Held → Approved → Released) with hold reasons.
- Referral review: show full 4-line breakdown (already done, verify).

---

## Technical notes

- Single migration: schema + view + trigger + data backfill for `payment_status` rename.
- Update `types.ts` regenerates after migration approval.
- Files touched: `payouts.server.ts`, `payouts.functions.ts`, `admin-trips.functions.ts`, new `AdminFinancialLedger.tsx`, wire into `admin.tsx`, minor edits to `PaymentStatusControl.tsx` and `AdminPayoutQueue.tsx` (deprecate in favor of ledger view).
- No changes to Stripe webhook contract — only status-name mapping updated.
- Backfill safe: no existing `payment_status='confirmed'` rows exist (verified against constraint).

Once approved I'll open the migration first (needs your approval), then wire the server functions and admin view in a follow-up.
