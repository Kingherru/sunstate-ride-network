# Reservation Lifecycle Refactor

Introduce a single source of truth (`reservation_state`) on `trips` and rebuild the Reservations UI in every portal around the three sections: Unconfirmed, Booked, Past. Trip History remains a separate, permanent record of completed trips. Referrals keep their own tab and only merge into Booked on acceptance.

## Data model

Add to `public.trips`:

- `reservation_state text` — one of `unconfirmed | booked | past | history`
- Trigger `trips_sync_reservation_state` (BEFORE INSERT/UPDATE) computes the value from existing fields:

```text
status in (canceled, no_show)                  -> past
status = completed  AND completed_at < now-30d -> history
status = completed                             -> past
status in (accepted, scheduled, en_route,
           in_progress, arrived, picked_up)    -> booked
assigned_provider_id IS NOT NULL
  AND payment_status in (paid, authorized, invoiced)
  AND dispatch_approved                        -> booked
everything else (open, pending, awaiting_*)    -> unconfirmed
```

- One-time backfill for existing rows.
- Index on `(reservation_state, requester_user_id)` and `(reservation_state, assigned_provider_id)` for fast portal queries.
- Nightly `pg_cron` job promotes `past` -> `history` after 30 days.

Referrals are unaffected by the trigger — a referred trip stays `unconfirmed` for the sender until the recipient accepts, at which point normal assignment logic flips it to `booked`.

## Server functions

In `src/lib/trips.functions.ts` add:

- `listReservations({ bucket: 'unconfirmed'|'booked'|'past', scope })` — returns rows filtered by `reservation_state` + role scope (requester, assigned provider, dispatch zone, admin all-access).
- `listTripHistory({ scope })` — `reservation_state = 'history'` OR completed trips regardless of age for admin.

All existing create/update paths keep working — the trigger derives state, no caller changes required.

## UI changes

Shared component: `src/components/reservations/ReservationsPanel.tsx` with three tabs (Unconfirmed / Booked / Past) driven by `listReservations`. Accepts a `scope` prop so each portal reuses it.

Portal wiring:

- Patient Portal (`_authenticated/dashboard.tsx`, patient branch) — replace current Reservations sub-tab with `ReservationsPanel scope="requester"`.
- Facility Portal (same file, facility branch) — same panel, `scope="facility"`.
- Provider Portal (same file, provider branch) — same panel, `scope="provider"`. Referrals tab stays as-is.
- Dispatch (`components/dashboard/RequestsPanel.tsx` + dispatch tab) — swap the current list for the three-section panel, `scope="dispatch"`.
- Dispatch Zone Manager — same panel, `scope="zone_manager"` filtered by assigned zone.
- Admin Portal (`components/admin/AdminTripsPanels.tsx`) — replace current tabs with the three sections plus a separate Trip History tab reading `listTripHistory`.

Trip History tab lives only in Admin and Provider portals (permanent record surface). Patient/Facility keep Past as their long-tail view.

## Referrals

No workflow change. Existing referral panels remain. Add a small badge on the Referrals tab showing pending count. When a referral is accepted, the trip gains an `assigned_provider_id` and the trigger moves it to `booked` for the accepting provider automatically.

## Migration + code order

1. Migration: add column, trigger, backfill, indexes, cron.
2. After approval + type regen: add `listReservations` / `listTripHistory` server fns.
3. Build `ReservationsPanel` and wire into all 6 portals.
4. Remove now-dead reservation code paths.

## Out of scope

- No changes to trip creation forms (creation already produces an unconfirmed trip; trigger labels it).
- No changes to referral acceptance UI.
- No new notification channels (existing status-change notifications continue to fire).

Proceed?