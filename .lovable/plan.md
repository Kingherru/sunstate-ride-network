## #64 — FL Dispatch Zones: seed + admin importer

**Data**
- Seed one preset `dispatch_zone` per FL county (67 rows) with `is_preset=true`, `state='FL'`, `name='<County> County, FL'`.
- Populate `dispatch_zone_zips` from a bundled JSON dataset (`src/data/fl-county-zips.json`) covering all Florida ZIPs grouped by county (compiled from public USPS/ZCTA data — cannot live-scrape unitedstateszipcodes.org, they block bots).
- Add `is_preset boolean default false` to `dispatch_zones` if missing.

**Admin importer UI** (`/admin` → Zones tab)
- New "Import ZIPs" dialog: pick target zone (or create new), paste a list of ZIPs (whitespace/comma/newline separated), preview parsed/valid FL ZIPs, dedupe against existing, insert on confirm.
- Server fn `importZipsToZone({ zoneId, zips[] })` with admin/dispatcher role check + FL ZIP validation (32xxx–34xxx).

## #66 — Public Shop + Certification (full Phase 1)

**Schema (new tables)**
- `courses` — slug, title, summary, description, price_cents, price_id (Stripe lookup_key), duration_min, passing_score, cert_validity_months, cover_image, is_published.
- `course_modules` — course_id, ord, title, body_markdown, video_url.
- `course_questions` — course_id, ord, prompt, choices jsonb, correct_index, explanation.
- `course_enrollments` — user_id, course_id, purchased_at, stripe_session_id, status (active/completed/expired), progress jsonb.
- `course_attempts` — enrollment_id, started_at, submitted_at, score, passed, answers jsonb.
- `course_certificates` — enrollment_id, cert_number (unique), issued_at, expires_at, holder_name, pdf_storage_path, verify_token.
- Public verify view: `GET /verify/$token` reads cert by token (RLS allows anon SELECT by token only).

**Stripe**
- Create Stripe product `nemt_courses` and one price per course via `create_price` (lookup keys `course_hipaa`, `course_nemt_payment_test`).
- Use existing `createCheckoutSession` server fn with `managed_payments: true`, `return_url=/shop/return?session_id={CHECKOUT_SESSION_ID}&course=<slug>`.
- Webhook (`/api/public/payments/webhook`) on `checkout.session.completed` for `mode=payment` with `metadata.course_slug` → insert `course_enrollments` row.

**Frontend routes**
- `/shop` — public catalog grid (cards, price, "Enroll" button → embedded Stripe checkout).
- `/shop/$slug` — public course detail (outline, duration, cert info, buy).
- `/shop/return` — post-payment success, links to "Start course".
- `/_authenticated/learn` — my enrollments list.
- `/_authenticated/learn/$slug` — course player: module stepper → "Take exam" gate → quiz form → results.
- `/_authenticated/learn/$slug/certificate` — view/download issued PDF.
- `/verify/$token` — public certificate verification page.

**Quiz + certificate flow**
- Server fn `submitAttempt({ enrollmentId, answers })` scores server-side, marks enrollment completed on pass, generates certificate:
  - Render PDF with `pdf-lib` (Worker-compatible), upload to `certificates` storage bucket (private), store path + a random `verify_token`.
  - Return signed URL for download.
- Failed attempt: allow retake (configurable cooldown, default none for Phase 1).

**Seed courses**
1. `hipaa` — HIPAA Training for NEMT ($49, 60 min, 20 questions, 80% pass, 12-mo validity).
2. `nemt_payment_test` — "NEMT Payment Test" ($1 test transaction, 3 questions, 100% pass) — treating the user's "project nemt payment test" note as a sandbox/QA course to verify the end-to-end pay→course→cert pipeline in preview. Will remove or rename once real second course is defined.

**Nav**
- Add "Shop" link to public site header.
- Add "My Courses" link to authenticated user dropdown.

## Technical notes
- No new secrets required — Stripe is already enabled.
- Certificates bucket: private, signed URLs only; holder can read own via server fn; public `/verify/$token` re-signs by token match.
- All new public tables get narrow `TO anon` policies only where required (shop catalog, verify-by-token); enrollments/attempts/certificates are `TO authenticated` scoped to `auth.uid()`.
- Content authoring UI for courses/modules/questions is admin-only (`/admin/courses`) — simple CRUD, sufficient for launch.

## Delivery order (single pass)
1. Migration: dispatch zones preset flag + all shop tables + RLS/GRANTs + verify view.
2. Seed data insert (counties+zips, HIPAA + NEMT payment test course content).
3. Stripe products/prices.
4. Server fns (importZipsToZone, enrollment lookups, submitAttempt, issueCertificate, verifyCertificate).
5. Webhook handler update for course purchases.
6. Public routes (/shop, /shop/$slug, /shop/return, /verify/$token) + head() SEO.
7. Authenticated routes (/learn, /learn/$slug, /learn/$slug/certificate).
8. Admin: Zones importer dialog + Courses CRUD tab.
9. Nav links.

Confirm to proceed.