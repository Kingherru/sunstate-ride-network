# Portal Updates — Items 49–57

This is a large batch touching sidebar nav, portals, account structure, and one new feature (embed code). Below is a scoped plan grouped by area so you can approve or trim before I start.

## 1. Sidebar & Page Consolidation (items 49, 54, 55)

- **49. Remove Weekly Schedule tab.** Delete the sidebar entry. On the Schedule/Reservation page, render a driver list showing today's/this week's assignments. Clicking a driver's name opens a small dialog: "Send weekly schedule to {driver}?" → triggers a server function that renders the driver's next-7-days assignments and emails them via Lovable Emails (new template `driver-weekly-schedule.tsx`).
- **54. Merge New Trip + Reservations into one page.** New route `/dashboard?tab=trips-and-reservations` (replacing the two existing tabs). Two-column layout: left = New Trip form (existing component), right = Reservations list (existing component). Old tabs redirect to the merged tab.
- **55. Merge Saved Contacts + Saved Patients.** One combined "Saved People" section with a type toggle (Patient / Contact) and unified table. Existing `saved_patients` table stays; add a `kind` column (`patient` | `contact`) via migration, plus optional contact-only fields. Migrate existing rows to `kind='patient'`.

## 2. Account Page Restructure (items 56, 57)

- Convert Account page into tabs: **Profile · Business Information · Membership · Security**.
- **56.** Move Membership block into the Membership tab; on desktop it sits on the right side of the Account layout.
- **57.** Move Business Information into its own tab (currently a separate page). Delete the standalone Business Information sidebar link.

## 3. Rules Page (item 51)

- Two-column desktop layout: **Rules of the Road** (left) · **Provider Trip Assignment Transparency Rules** (right). Stack on mobile.
- Remove **Rule T7** from the Transparency list.

## 4. Facility Auto-Upgrade (item 52)

- DB trigger on `saved_patients` (or wherever patients are counted): when a `patient` portal account exceeds 3 patients, update `member_profiles.portal = 'facility'`.
- Show a one-time in-app banner: "Your account was upgraded to a Facility Portal because you manage 3+ patients. Pricing is unchanged — it's based on provider availability in your area."

## 5. Manual Trip Completion (item 53)

- On the Trip Details page (provider view), add **Mark Completed** / **Mark Uncompleted** buttons.
- Marking completed opens a required **Trip Summary Log** form (pickup arrival time, dropoff arrival time, mileage, notes, any incidents). Saves to a new `trip_summary_logs` table linked to `trips`.
- Extend `updateTripDetails` server fn to accept the status change + summary log payload atomically.

## 6. Provider Embed Code (item 50) — new feature

- Add `provider_embed_tokens` table: `id, provider_user_id, token (unique), created_at, revoked_at`.
- New public route `/embed/request-a-ride/$token` — renders the Request-a-Ride form in an iframe-friendly layout (no header/footer), and pre-assigns submissions to that provider.
- Provider Portal → new **Embed Code** section under Business Information tab: shows a snippet like:
  ```html
  <iframe src="https://…/embed/request-a-ride/{token}" width="100%" height="800" frameborder="0"></iframe>
  ```
  With Copy and Regenerate buttons. Regenerate revokes the old token.
- Token validated server-side on submit; invalid/revoked tokens return 404.

## Technical Notes

- Migrations: `saved_patients.kind`, `trip_summary_logs`, `provider_embed_tokens`, facility-upgrade trigger.
- New route files: `/embed/request-a-ride/$token.tsx`.
- Email template: `driver-weekly-schedule.tsx` + trigger from schedule page.
- Account page becomes tab-based (`shadcn/ui Tabs`).
- Rules page becomes 2-col grid (`md:grid-cols-2`).
- All work stays inside the portal shell (no website header/footer on embed route either).

## Suggested Order

1. Schema migrations (saved_patients.kind, trip_summary_logs, provider_embed_tokens, facility-upgrade trigger)
2. Sidebar cleanup + merged Trips/Reservations + merged Saved People (49 partial, 54, 55)
3. Account tabs + move Membership + Business Info (56, 57)
4. Rules page layout + T7 removal (51)
5. Manual trip completion + summary log (53)
6. Weekly driver schedule email flow (49 completion)
7. Facility auto-upgrade banner (52)
8. Provider embed code end-to-end (50)

Approve as-is, or tell me which items to drop/reorder and I'll start.
