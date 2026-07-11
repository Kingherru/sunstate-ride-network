# Admin Portal Sync — End-to-end test

Verifies every module tracked by the `AdminSyncStatusWidget` (Trips,
Reservations, Dispatchers, Patients, Referrals, Messages, Payments,
Memberships, Documents, Notifications) reaches the Admin Portal within the
"Fresh" freshness window.

**Strategy: data-layer (Option 2).** Seeds one row per module directly via
`psql`, then signs in as an admin in a headless browser, opens `/admin`,
and asserts each widget card reports `Fresh …` with count > 0.

## Run

1. Sign in as an admin user in the Lovable preview.
2. From the sandbox shell:

   ```bash
   python3 tests/e2e/admin-sync/run.py
   ```

The script exits non-zero if any module fails to appear or shows a sync
error. Screenshots are written to `tests/e2e/admin-sync/screenshots/`.

## Files

- `seed.sql` — deterministic seed, transactional, marks all rows with a
  timestamp so re-runs are unique.
- `run.py` — Playwright driver; scrapes the widget cards and asserts.
