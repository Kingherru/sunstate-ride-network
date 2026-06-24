# FloridaNEMT Expansion Plan

This is a large scope. To keep it shippable and reviewable, I'll deliver it in 5 phases. You can approve all of it, or tell me to start with a specific phase.

## Phase 1 — Provider CRM (Contacts & Trip History)
Let providers save the people/places they work with so repeat trips are 2 clicks.

**New tables**
- `provider_contacts` — type (patient | caregiver | facility | broker | organization), name, phone, email, notes, default pickup/dropoff, mobility needs, payer
- `saved_locations` — label, address, city, zip, lat/lng, notes (linked to a contact or standalone)
- Link `trips.contact_id` and `trips.payer_contact_id` (nullable) to reuse contact data

**UI in `/dashboard`**
- Contacts tab: list / search / add / edit, with "New trip for this contact" shortcut that prefills the trip form
- Trip-create form: contact picker (autofills patient + locations) + "save as contact" toggle
- Contact detail drawer: full trip history for that contact

## Phase 2 — Dispatch & Fleet
Real ops view, not just a trip list.

**New tables**
- `drivers` — provider_id, first/last, phone, license #, license_expiry, status (active/inactive)
- `vehicles` — provider_id, name, plate, type (sedan/wav/stretcher), capacity, status
- Add to `trips`: `driver_id`, `vehicle_id`, `estimated_pickup_at`, `estimated_dropoff_at`, `actual_pickup_at`, `actual_dropoff_at`, `actual_miles`, `cancel_reason`, `no_show_reason`

**UI**
- Dispatch board: columns Pending / Assigned / In Progress / Completed / Canceled (drag to reassign)
- Driver & vehicle management pages
- Per-trip status timeline + assign driver/vehicle modal
- Reports page: trips per day/week, revenue, completion rate, top contacts, CSV export

## Phase 3 — Provider Pricing Engine
Each provider sets their own price book; trips auto-cost.

**New table `provider_pricing`** (one row per provider, all numeric, default 0):
base_pickup, per_mile, wait_per_min, no_show, cancellation, wheelchair_addon, stretcher_addon, after_hours_addon, holiday_surcharge, additional_passenger, after_hours_start (time), after_hours_end (time), holidays (date[])

**Logic**
- `calculateTripCost(trip, pricing)` server fn → returns line items + total
- Stored on trip: `cost_breakdown` jsonb, `cost_total` numeric
- Recalculates on status change to completed/no_show/canceled
- Settings → Pricing page with live preview

## Phase 4 — Public Booking & Recurring Trips
Make `/book` the front door for patients, caregivers, facilities.

**New tables**
- `ride_requests` (already exists) — extend with `recurrence_rule` (RRULE-like text), `recurrence_end`, `requester_email`, `requester_phone`, `requester_type` (patient/caregiver/facility), saved_pickup_id, saved_dropoff_id
- `requester_accounts` — light account for patients/facilities (uses existing Supabase auth, separate role `requester`)
- `requester_saved_locations` — frequent addresses tied to a requester

**Flow**
- Public `/book` — single-step form, no login needed for one-off, optional account creation
- Requester portal `/requests` — see status (pending/matched/scheduled/completed), recurring rides, save addresses
- Provider dashboard inbox: incoming requests in their region → Accept (creates trip) / Decline / Forward

## Phase 5 — External API Integrations (hiBambi, RouteGenie)
Two-way trip sync.

**Architecture**
- New table `provider_integrations` — provider_id, vendor (hibambi/routegenie), api_key (encrypted), webhook_secret, enabled, last_sync_at
- Outbound: when a trip is created/updated, push to enabled vendors via server fn
- Inbound: `/api/public/integrations/hibambi/webhook` and `/api/public/integrations/routegenie/webhook` — HMAC-verify, map payload to `trips`, mark `source = 'hibambi' | 'routegenie'`
- Settings → Integrations page: paste API key, test connection, toggle on/off, view sync log

**Note:** I'll build with a generic adapter pattern. Real endpoint URLs/auth specifics for hiBambi & RouteGenie aren't public — first run will use documented patterns and you'll paste real API docs / a sandbox key when ready.

## Provider Onboarding & Compliance (incremental, not its own phase)
The existing provider application already covers docs. I'll add:
- `provider_certifications` table — name, issued_at, expires_at, document_url, status
- Expiry reminders in admin dashboard (red badge when <30 days)
- Optional "training modules" later (video + quiz) — flagged as Phase 6 if you want it

## Technical notes
- All new tables get RLS scoped to `provider_id = auth.uid()`'s provider, plus admin override via `has_role(_, 'admin')`, plus required GRANTs.
- All write paths go through `createServerFn` with `requireSupabaseAuth`.
- Recurring rides expanded into individual `trips` rows by a daily server fn (manual trigger button now; pg_cron later).
- Reports use TanStack Query + Supabase aggregates.

## What I need from you
1. **Approve the phase order** (or reorder).
2. **Start where?** Recommend Phase 1 → 2 → 3 in that order; Phase 4 & 5 after the core ops loop works.
3. **API keys for Phase 5** — do you have hiBambi / RouteGenie sandbox credentials or documentation links? If not, I'll stub it and you can wire real creds later.
