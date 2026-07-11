#!/usr/bin/env python3
"""
Admin Portal Sync E2E — Option 2 (data-layer).

Seeds one row per synced module directly in the database, then signs in as
admin, opens /admin, and asserts the AdminSyncStatusWidget shows every module
as Fresh (<15 min) with count > 0.

Prerequisites
-------------
- `psql` reachable via the standard PG* env vars (Lovable sandbox provides them).
- A Supabase admin session pre-injected via LOVABLE_BROWSER_SUPABASE_* env vars
  (user must be signed in as an admin in the Lovable preview before running).
- Dev server at http://localhost:8080.

Usage
-----
    python3 tests/e2e/admin-sync/run.py
"""
import asyncio, json, os, subprocess, sys
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).parent
SEED_SQL = HERE / "seed.sql"
SCREENSHOTS = HERE / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)

MODULES = [
    "Trips", "Reservations", "Dispatchers", "Patients", "Referrals",
    "Messages", "Payments", "Memberships", "Documents", "Notifications",
]

def seed_via_psql():
    if not os.environ.get("PGHOST"):
        sys.exit("PGHOST not set — this script must run inside the Lovable sandbox.")
    result = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-f", str(SEED_SQL)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        sys.exit(f"seed failed:\n{result.stderr}")
    print("Seed applied.")

async def main():
    seed_via_psql()

    auth_status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
    if auth_status != "injected":
        sys.exit(
            f"LOVABLE_BROWSER_AUTH_STATUS={auth_status!r} — sign in as an admin "
            "in the Lovable preview, then rerun."
        )
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    session_json = os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies: c["url"] = "http://localhost:8080"
            await ctx.add_cookies(cookies)
        page = await ctx.new_page()
        await page.goto("http://localhost:8080", wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
        await page.goto("http://localhost:8080/admin", wait_until="domcontentloaded")

        # Wait for the widget heading, then for at least one card to render.
        await page.get_by_text("Admin Portal data freshness").wait_for(timeout=15_000)
        await page.wait_for_timeout(2_000)  # let the 10 parallel queries settle

        # Scrape each module card's status text.
        results = await page.evaluate(
            """() => {
                const cards = Array.from(document.querySelectorAll('div.border.rounded-sm.p-3'));
                return cards.map(c => ({
                    label: c.querySelector('.font-bold')?.textContent?.trim(),
                    status: c.querySelectorAll('p')[2]?.textContent?.trim(),
                    count: c.querySelectorAll('p')[3]?.textContent?.trim(),
                    err: c.querySelector('.text-destructive')?.textContent?.trim() || null,
                }));
            }"""
        )
        await page.screenshot(path=str(SCREENSHOTS / "widget.png"))

        by_label = {r["label"]: r for r in results if r.get("label")}
        failed = []
        for m in MODULES:
            row = by_label.get(m)
            if not row:
                failed.append(f"{m}: card not found"); continue
            if row.get("err"):
                failed.append(f"{m}: sync error → {row['err']}"); continue
            status = row.get("status") or ""
            count = row.get("count") or ""
            if not status.startswith("Fresh"):
                failed.append(f"{m}: expected Fresh, got {status!r}"); continue
            if count.startswith("0 "):
                failed.append(f"{m}: count is 0 despite seed")

        print("\n=== Admin sync E2E results ===")
        for m in MODULES:
            row = by_label.get(m, {})
            print(f"  {m:14s} status={row.get('status'):22s} count={row.get('count')}")

        await browser.close()

        if failed:
            print("\nFAIL:")
            for f in failed: print(f"  - {f}")
            sys.exit(1)
        print("\nPASS — all 10 modules synced to Admin Portal within the fresh window.")

if __name__ == "__main__":
    asyncio.run(main())
