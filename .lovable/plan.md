## Scope

Build two features across Patient, Facility, and Provider portals:

1. **Editable Business Information** everywhere (currently only Provider has it).
2. **Duplicate Trip** action that opens a prefilled trip form with editable date/time and saves as a brand-new trip.

## 1. Business Information

### Data model
`member_profiles` already stores provider business fields (`company_name`, `address`, `city`, `state`, `zip_code`, `phone`, `contact_email`, etc.). Reuse the same columns for **all portals** — no new table needed. Add one migration only if a column is missing (audit first).

Default `state` to `FL` on create if empty; user can override.

### UI
- **Facility portal** (`dashboard.tsx` ~line 2826): replace view-only `BusinessInfoPanel` with an editable card modeled on `ProviderBusinessInfoCard` — same fields, same save handler pattern, labeled "Facility Information".
- **Patient portal**: add a new "Contact & Address" card in the profile/settings tab using the same shared component, labeled "Your Information" (business_name optional / hidden for patients — show Name, Address, City, State, ZIP, Phone, Email).
- Extract a shared `<BusinessInfoForm />` component so all three portals use one implementation.

### Contact visibility
When a provider is connected to a facility/patient via an active/assigned/completed trip, expose the counterparty's business phone + email on the trip detail view (already partially wired for provider→patient; mirror it for provider→facility and patient→provider).

## 2. Duplicate Trip

### Behavior
- Add a **"Duplicate"** button on each trip row/card in trip lists across all three portals (Patient My Trips, Facility Trips, Provider Trips).
- Clicking opens the existing new-trip form prefilled with everything **except** `id`, `display_id`, `status` (→ `open`/`draft`), `assigned_to` (cleared), `created_at`, payment fields, and any provider-signature/completion fields.
- Date and time fields are highlighted / focused for the user to update before saving.
- On save → `INSERT` a new `trips` row (never `UPDATE` the source). No schema change required — `trips` already supports insert.

### Implementation
- Add a `duplicateTrip(sourceTripId)` helper that fetches the row, strips non-copy fields, and routes to `/trips/new?from=<id>` (or the portal-specific new-trip route) with prefill state.
- Reuse each portal's existing trip form component; add a `initialValues` prop path so the prefill flows in.

## Technical notes

- No new database tables; possible single migration to add any missing address column on `member_profiles` (verify first with `read_query`).
- All writes go through existing RLS policies scoped to `auth.uid()`.
- Shared component: `src/components/business/BusinessInfoForm.tsx`.
- Duplicate helper: `src/lib/trips/duplicate.ts`.

## Out of scope

- No changes to trip pricing, dispatch logic, or notifications.
- No new roles or permissions.
