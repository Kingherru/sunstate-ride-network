
## Group 1 — Payments & saved cards (patient + facility)

**DB (migration)**
- `stripe_customers (user_id PK → auth.users, stripe_customer_id, environment)` — RLS: owner-only.
- `saved_payment_methods (id, user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, environment, created_at)` — RLS: owner-only read/insert/update/delete. No anon, no admin grant.
- `trip_payments (id, trip_id, ride_request_id, payer_user_id, stripe_payment_intent_id, amount_cents, platform_fee_cents, status, environment, created_at)` — RLS: payer can read own; provider on the trip can read own; admin read.
- Add `payment_status` ('unpaid' | 'authorized' | 'paid' | 'refunded') to `ride_requests` + `trips`.

**Server fns (`src/lib/payments.functions.ts`)**
- `ensureStripeCustomer()` — get-or-create per user.
- `createSetupIntent()` — returns client_secret for saving a card.
- `listSavedPaymentMethods()` — owner only.
- `deletePaymentMethod({id})` — detaches from Stripe + deletes row.
- `setDefaultPaymentMethod({id})`.
- `payForConfirmedTrip({ride_request_id, payment_method_id?})` — creates PaymentIntent, charges, marks trip `paid`. Triggered when status flips to `confirmed`.

All Stripe calls go through `createStripeClient(env)` from `@/lib/stripe.server` per shared utility.

**UI**
- `src/components/payments/SavedCards.tsx` — list + add (Stripe Elements `<PaymentElement>` against SetupIntent) + delete + set default.
- New "Payments" tab in patient + facility Account panels.
- `PayTripButton` shown on confirmed trips in the Patient "My Rides" and Facility "Trip History" panels.

---

## Group 2 — Staff + Dispatcher roles, staff login

**DB**
- Extend `app_role` enum: add `'staff'` and `'dispatcher'` (keep `'admin'`, `'user'`).
- Permissions enforced **server-side** via `has_role()` checks inside server fns + RLS policies. No client-side gating only.
  - `staff`: read access to providers/facilities/trips, write access ONLY to: notes, contact messages, mark-read notifications, edit provider contacts. CANNOT: change roles, change pricing, change platform_theme, approve providers, delete anything, view payment methods.
  - `dispatcher`: everything staff can do, plus: approve/deny provider applications, assign trips to providers, change trip status, send referrals, edit reservations. Still cannot: change roles, theme, billing/payouts settings.
- New RLS policies on relevant tables keyed off `has_role(auth.uid(),'staff'|'dispatcher')`.
- Audit trail: `staff_audit_log (id, actor_user_id, role_at_time, action, target_table, target_id, before jsonb, after jsonb, created_at)` — admin-read only. Every staff/dispatcher write server fn inserts a row.

**UI**
- `/staff/login` route (PortalAuth variant) — link in footer ("Staff sign-in").
- Reuse `/dashboard` layout; sidebar tabs gated by role.
- Admin tab "Team" — invite staff/dispatcher by email, set/change role.

---

## Group 3 — Changelog chip

- `changelog (id, version, title, body markdown, released_at)` table — public SELECT (read-only), admin write.
- `APP_VERSION` constant + `LATEST_CHANGELOG_RELEASED_AT` derived from latest row.
- New `<ChangelogChip />` next to "Sign out" in sidebar footer.
  - Default: light blue dot + "Changelog".
  - If `now - released_at < 7 days` AND user hasn't dismissed: light green dot + "New".
  - Click → side sheet listing entries newest first.
- `user_changelog_seen (user_id, last_seen_version)` so dismiss is per-user.

---

## Group 4 — Trip UX batch

- **Trip type selector** on all reservation/new-trip forms: One-way / Round trip / Multi-leg (dynamic leg rows). Stored as `trip_kind` + `legs jsonb` on `ride_requests`.
- **Recurring trips**: pattern picker (daily/weekly/Mon-Fri/custom days + end date). Expands into individual `ride_requests` rows tagged with `recurrence_group_id`. Cancel "next only" / "all future" already exists in the requests portal — wire to new groups.
- **Copy trip** button on Patient / Facility / Provider trip rows → pre-fills New Trip form with everything except date/time.
- **Saved patients** (Patient portal): `saved_patients (id, owner_user_id, full_name, dob, phone, medicaid_id, npi, default_pickup, default_dropoff, notes)` — owner-only RLS. Quick-select on the reservation form. Facilities already have `provider_contacts`; mirror UX.
- **Clickable name → modal**: row click opens reservation detail modal with full info + Edit mode for fields the actor is allowed to change (RLS-enforced). Available across Patient/Provider/Facility.
- **Accept / Decline restyle**: smaller, consistent throughout — Accept `bg-green-200 text-green-900 hover:bg-green-300`, Decline `bg-pink-200 text-pink-900 hover:bg-pink-300`, `px-3 py-1 text-sm font-bold rounded-sm`.
- **Integration label**: change "duetride" display to "DueRide" everywhere (label only; vendor id stays).
- **Provider business-info tab**: new "Business Info" tab in Provider account showing read-only view of original `provider_applications` row (company, EIN, NPI, W9 path, insurance, driver license, etc.) + uploaded docs links + an "Update" button that opens an editable form (writes to `provider_applications` with `status='resubmitted'` requiring admin re-approval for sensitive fields).
- **Driver email + in-app notifications**:
  - Add `auth_user_id` (nullable) FK to `drivers` so drivers can have logins. Provider can invite driver → magic-link signup → linked.
  - On trip assigned: enqueue email (notification_email_queue) to driver + insert `notifications` row scoped to driver user.
  - "Send week" button on Vehicles & Drivers / driver row: PDF + email of all trips assigned to that driver for next 7 days.
  - Driver portal (minimal): sees only own assigned trips, can mark on-scene / completed.

---

## Order of execution (one chat turn per group so each is reviewable)

1. **This turn:** Group 1 — Payments & saved cards (migration + Stripe wiring + SavedCards UI + PayTripButton).
2. Next turn: Group 2 — Staff/Dispatcher + audit log + staff login.
3. Next turn: Group 3 — Changelog chip.
4. Next turn: Group 4 — Trip UX batch (largest; may split into 4a forms/recurring/copy and 4b saved patients/edit modal/driver notifications).

Approve and I'll start with Group 1.
