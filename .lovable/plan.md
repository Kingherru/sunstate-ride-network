
## Goal

Redesign the entire trip/delivery payment + payout system so **My Florida NEMT (MFN) collects and holds all money**, validates every trip, and releases provider earnings into a **Provider Balance** the provider can cash out on demand. Same workflow for every trip; only the hold timing changes for Medicaid.

## Money-flow (one record per trip)

```text
Payer (patient/facility/broker/self-pay/Medicaid)
        │  charge
        ▼
   MFN platform account  ── platform fee + referral fee retained
        │  after: trip completed + validated + hold expired
        ▼
   Provider Balance (on-platform ledger, per provider)
        │  provider clicks "Cash out"
        ▼
   Provider bank via Stripe Connect transfer
```

- **Standard trips & medical deliveries:** funds move into Provider Balance **3 calendar days** after validation.
- **Medicaid trips:** funds move into Provider Balance **Net 15 business days** (excludes weekends + US federal banking holidays) after `medicaid_funds_received_at` is stamped by admin.
- Providers **never** trigger transfers to themselves outside "Cash Out from balance". Cash-out is the ONLY provider-facing money button.

## Statuses (single lifecycle)

- `payment_state`: `none → invoiced → paid → validated → refunded`
- `payout_state`: `none → holding → released_to_balance → cashed_out → cancelled`
- Provider Balance entries: `pending` (holding) → `available` (released_to_balance) → `paid_out` (cashed_out).

## Deliverables

### 1. Database migration (single migration)

Additive on top of the existing `fin_*` schema built last turn:

- `fin_settings`: add `standard_hold_days int default 3`, `medicaid_net_business_days int default 15`.
- `trips`: add `fin_medicaid_funds_received_at timestamptz`, keep `fin_payout_hold_until`.
- New `provider_balances` (one row per provider): `available_cents`, `pending_cents`, `lifetime_paid_out_cents`, `updated_at`.
- New `provider_balance_entries` (ledger): `provider_user_id`, `trip_id nullable`, `cashout_id nullable`, `kind` (`hold`,`release`,`cashout`,`reversal`,`adjustment`), `amount_cents` (signed), `state` (`pending`/`available`/`paid_out`/`reversed`), `available_at`, `note`, timestamps.
- New `provider_cashouts`: `provider_user_id`, `amount_cents`, `stripe_transfer_id`, `status` (`requested`/`processing`/`paid`/`failed`), `failure_reason`, `requested_at`, `completed_at`.
- New SQL helpers (SECURITY DEFINER, service/admin only):
  - `fin_business_days_from(_start timestamptz, _days int) returns timestamptz` — skips Sat/Sun + `fin_bank_holidays` table (seed with 2026-2028 US federal holidays).
  - `fin_validate_payment(_trip_id)` — sets `payment_state='validated'`, computes `fin_payout_hold_until` using either standard days or Net-15 business days depending on `fin_is_medicaid`, inserts a `pending` ledger entry, bumps `pending_cents`.
  - `fin_mark_medicaid_received(_trip_id, _received_at)` — admin only, recomputes hold for Medicaid trip.
  - `fin_release_to_balance(_trip_id)` — moves ledger entry `pending→available`, decrements `pending_cents`, increments `available_cents`, sets `payout_state='released_to_balance'`. Called by cron.
  - `fin_request_cashout(_amount_cents)` — provider RPC, atomic: checks `available_cents >= amount`, inserts `provider_cashouts` row, ledger `cashout` entry (`paid_out`, negative), decrements `available_cents`.
  - `fin_complete_cashout(_cashout_id, _transfer_id)` / `fin_fail_cashout(_id,_reason)` — service only, called after Stripe transfer resolves.
  - `fin_refund(_trip_id, _reason)` — reverses any ledger entry for that trip; if already `paid_out`, marks debt against provider balance.
- RLS + GRANTs:
  - `provider_balances`, `provider_balance_entries`, `provider_cashouts`: SELECT for `authenticated` where `provider_user_id = auth.uid()`; full access to `service_role`; admin SELECT via `has_role`. No direct INSERT/UPDATE from `authenticated` — all mutations through RPCs.
  - Revoke `EXECUTE` on all `fin_*` RPCs from `anon`/`public`; grant only what providers need (`fin_request_cashout`).
- Trigger: hard-lock `provider_cashouts` from client UPDATE; only service_role writes status.

### 2. Cron

Replace `fin-release-tick` cron logic to call `fin_release_to_balance` for every trip where `fin_payment_state='validated'` and `fin_payout_hold_until <= now()` and `payout_state='holding'`. Keep the same `/api/public/hooks/fin-release-tick` route + token.

Add a new cron (every 5 min) hitting `/api/public/hooks/fin-cashout-tick` that iterates `provider_cashouts` in `requested` status, creates the Stripe transfer via `createStripeClient`, then calls `fin_complete_cashout`/`fin_fail_cashout`.

### 3. Server functions (`src/lib/finance/finance.functions.ts` — extend)

- `getMyProviderBalance()` — auth'd read of the caller's `provider_balances` row + last 20 ledger entries + last 20 cashouts + expected payout dates (derived from `pending` ledger entries).
- `requestCashout({ amount_cents })` — wraps `fin_request_cashout` RPC.
- `adminMarkMedicaidFundsReceived({ trip_id, received_at })` — admin only.
- `adminAdjustBalance({ provider_user_id, amount_cents, note })` — admin only, ledger `adjustment`.
- Existing `setTripAmounts`, `validateTripPayment`, `refundTrip` stay; `releaseTripPayout` is removed (release is now automatic via cron; admin can call a new `adminForceRelease` for edge cases).

### 4. Stripe webhook

`/api/public/payments/webhook` `checkout.session.completed` / `payment_intent.succeeded` for a trip charge → call `fin_mark_paid` (existing). Admin still triggers `fin_validate_payment` after review; auto-validate for card-paid non-Medicaid trips can be added later.

### 5. UI

- **Provider Portal** → new **Balance** tab (`src/components/dashboard/ProviderBalancePanel.tsx`):
  - Available / Pending / Lifetime paid-out cards.
  - "Cash out" button → modal (amount, defaults to available), disabled when < $1.
  - Expected payout dates table (from pending ledger).
  - Cashout history + ledger.
- **Admin Portal** → replace `AdminFinanceConsole.tsx`:
  - Per-trip view with statuses, validate/refund actions.
  - Per-provider balances view with adjust + force-release.
  - Medicaid trips view with "Mark Medicaid funds received" action.
- Delete `PaymentStatusControl`, `PayTripButton` self-serve payout paths, `AdminPayoutQueue`, `PayoutsPanel` (replaced by ProviderBalancePanel).
- Update banner copy in dashboard: providers see "Earnings go to your Provider Balance after a 3-day hold (Net 15 business days for Medicaid). Cash out anytime."

### 6. Housekeeping

- Legacy `payouts.*` files: mark as deprecated, remove imports from active surfaces (they already read dormant columns).
- Update `.lovable/plan.md` and `mem://` core rule to reference the Provider Balance model.

## Out of scope

- Membership subscriptions (untouched).
- Stripe Connect onboarding UI (untouched — cash-out uses existing connected accounts).
- Historic trip financial columns (`cost_total`, `provider_payout_cents`) stay as read-only history.

## Order of execution

1. Migration (schema + RPCs + RLS + seed holidays).
2. Cron routes (`fin-release-tick` rewrite + new `fin-cashout-tick`) + pg_cron schedule.
3. Server functions extension.
4. `ProviderBalancePanel` + Admin console rewrite + dashboard wiring.
5. Remove legacy payout UI surfaces.

Approve and I'll execute in that order.
