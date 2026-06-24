# Phase 4 + Security + Membership Tiers + HIPAA

This batch is split into 4 tracks. I'll ship them in this order.

## Track A — Critical Security Fixes (do first)

**1. Lock down `member_profiles`**
- Drop the "Active members can see peers in their region" policy that exposes Stripe IDs, phone, dispatch_email. Replace with a sanitized **view** `public.member_directory` exposing only: `user_id`, `display_name`, `region`, `service_zip_codes`, `accepts_dispatch`. Peers query the view, not the table.
- Drop the broad self-UPDATE policy. Replace with a trigger `prevent_billing_self_edit` that raises if a non-service-role session tries to change `membership_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `membership_tier`. Users may still update name/phone/preferences.
- Same trigger blocks INSERT with anything other than `membership_status='inactive'` and `membership_tier='none'`.

**2. Storage `provider-docs`**
- Set bucket file size limit 25MB and allowed MIME types to PDF/JPEG/PNG.
- Add UPDATE/DELETE policies: only admins.

**3. Bulk trip upload validation**
- Replace `any[]` validator in `createTripsBulk` with a Zod schema (length caps, date/time regex, transport_type enum, cap of 500 rows).

**4. SECURITY DEFINER exec grants**
- `REVOKE EXECUTE ... FROM authenticated` on internal helpers; keep `has_role` callable.

## Track B — Membership Tiers + Payment Gating

- Add `membership_tier` enum: `none | free | paid`.
- After provider application approval → admin action sets `tier='free'`, `status='active'`. Free tier can: view directory, manage contacts, fleet, pricing, **receive** trips. Cannot: **send/dispatch** trips, bulk upload, use API push.
- Paid tier ($5/mo via existing Stripe flow) unlocks send/dispatch/bulk/API.
- New `can_send_trips(user_id)` SQL function → `tier='paid' AND status='active'`. Used in `trips` INSERT policy WITH CHECK and in dashboard UI gating.
- `/membership` page shows current tier + upgrade CTA.

## Track C — HIPAA Acknowledgment + PHI Minimization

- New `hipaa_acknowledgments` table: `user_id, acknowledged_at, version`. Required before first send AND on every bulk upload / API push (per-batch checkbox stored as `hipaa_ack_id` on each trip).
- Add `hipaa_acknowledged BOOLEAN` to trip create/upload forms — server fn rejects if false.
- **PHI minimization**: encrypt patient PII columns (`patient_first_name`, `patient_last_name`, `patient_phone`, `patient_dob`, `medical_notes`) at the application layer using a per-provider symmetric key stored in `provider_phi_keys` (key wrapped by a server-only master key). Admin/peer queries return redacted values (`***`). Only the originating provider and the assigned receiving provider can decrypt.
- Add admin-side RLS: admin role can read trip metadata (status, region, times) but **NOT** PHI columns. Enforced by splitting `trips` into `trips` (metadata) and `trip_phi` (encrypted) with stricter RLS on `trip_phi` scoped to sender_id / recipient_id only.

## Track D — Phase 4 Framework (scaffolding only)

**Public booking**
- `/book` public form → inserts into `ride_requests` (existing).
- Extend `ride_requests` with `recurrence_rule TEXT` (RRULE string), `requester_email`, `requester_phone`, `hipaa_ack_id`.
- Daily server fn `expandRecurringRequests` stub (cron-ready, not wired yet).

**Requester accounts**
- New role `requester` in `app_role` enum.
- `requester_saved_locations` table.
- `/requests` portal scaffold (list own requests, cancel).

**External API integrations (stubs)**
- New `provider_integrations` table: `provider_id, vendor (hibambi|routegenie), api_key_encrypted, webhook_secret, enabled, last_sync_at`.
- `/api/public/integrations/hibambi/webhook` and `/api/public/integrations/routegenie/webhook` routes with HMAC verification stubs (return 501 until real specs available).
- Outbound adapter interface `src/lib/integrations/adapter.ts` with `pushTrip`, `pullTrips` methods, `hibambi.ts` + `routegenie.ts` stub implementations.
- Dashboard "Integrations" tab: connect/disconnect, paste API key (paid tier only).

## Out of scope this batch
- Real hiBambi/RouteGenie endpoint wiring (need vendor docs/sandbox creds — will ask after).
- Email delivery of trip PDFs (still pending email domain setup).
- Dependency CVE bumps (`@cloudflare/vite-plugin`, `@tanstack/react-start`) — Lovable-managed templates; flagged but not user-fixable here.

## Technical notes
- All new tables: RLS enabled, GRANT to authenticated + service_role, scoped to `auth.uid()`.
- PHI encryption via `pgcrypto` `pgp_sym_encrypt/decrypt` with per-provider key; decrypt happens only in `requireSupabaseAuth` server fns after caller authorization check.
- Migration order: security fixes → tier column → HIPAA tables → trip_phi split (data migration of existing PHI) → integrations table.

Confirm and I'll start with Track A migration.
