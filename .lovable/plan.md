## Goal
Standardize the pricing/quote flow so patients and facilities only ever see an auto-generated estimate, providers own the actual quote (with guardrails on short trips), and every portal reads the same synchronized state.

## Changes

### 1. Requester side — patient & facility (read-only pricing)
- Trip request forms: remove any manual price/cost input. Replace with an auto-computed "Estimated average" (uses existing `estimateZonePrice` via zip + miles + transport type).
- Trip Details:
  - Show `Estimated price` (from `estimated_cost_cents` written at request time) and, once a quote is approved, `Provider quote`.
  - Hide the `cost_total` input for `sender_kind = patient/facility`; render as read-only.
  - New "Quote review" card when `quote_status = quote_sent`: Accept / Decline buttons calling existing accept/decline paths.

### 2. Provider side — quote entry with guardrails
- Provider trip detail keeps the quote input, but:
  - Show the average estimate side-by-side and a computed cap.
  - Under 50 miles: hard-cap at `avg * 1.5`. Server rejects above cap unless staff-approved.
  - Over 50 miles: no hard cap; show a soft warning if quote is >150% of estimate ("may not be accepted").
  - Any quote >120% of estimate: inline warning "This quote is significantly above the average and may be declined."
- `submitTripQuote` server fn: fetch estimate, apply the same cap server-side. Return `{ ok:false, error, requires_override:true }` when a short-trip quote exceeds the cap so the client can route it to staff review.

### 3. Data & schema
- Migration: add `trips.estimated_cost_cents INTEGER` (if not already present — verify) and backfill from existing `cost_total` where missing.
- Migration: update `submit_trip_quote` RPC (or wrap in server fn logic) to enforce the 50-mile / 150% rule; long-distance quotes bypass the cap.
- Trigger: on `trip_quotes` insert with `status = pending`, set `trips.quote_status = 'quote_sent'` and clear any prior `quote_accepted` for the same trip.
- Trigger: on `trip_quotes` update to `approved`, set `trips.quote_status = 'quote_accepted'` and copy `amount_cents / 100` into `trips.cost_total` so all portals read the same number.

### 4. Notifications
- Notify requester (patient/facility) when a quote is submitted or approved (existing `notifications` table).
- Notify provider inline when their quote exceeds the soft threshold (client-side toast; no server notification needed).
- Notify ops when a short-trip provider submits an over-cap quote requiring override.

### 5. Cross-portal sync
- Every portal already reads `trips.cost_total` and `trip_quotes` via the same server fns; after the triggers above, admin/dispatch/patient/facility/provider all see the same `estimated_cost_cents`, latest `pending` quote, and `approved` quote consistently.

## Technical notes
- Files touched: `src/lib/workflow.functions.ts`, `src/lib/forms.functions.ts`, `src/lib/pricing.ts`, `src/routes/_authenticated/dashboard.tsx`, new SQL migration.
- Estimate is computed at request time and stored on `trips.estimated_cost_cents`; not recomputed on every view so requesters and providers see the same anchor number.
- The 50% short-trip cap runs both client-side (UX warning + disabled submit) and server-side (authoritative check in `submitTripQuote`).

## Out of scope
- Payment capture / Stripe flow changes.
- Zone/base pricing configuration UI changes.
- Historical trips (only affects newly created requests going forward).