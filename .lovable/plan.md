
# Florida NEMT Platform — Build Plan

Statewide Non-Emergency Medical Transportation gateway: provider network, patient ride requests, broker dispatch, and a paid training academy. Built as a modern React web app on Lovable Cloud (auth, database, file storage, payments) — not WordPress/Flatsome, but delivers the same end-user outcomes with better scalability.

## Phase 1 — Public marketing site + ride request (this iteration)

The foundation everything else hangs off. Ships a credible, SEO-ready public site you can launch and start collecting leads/rides with immediately.

**Pages**
- Home — hero, services, coverage map, training academy teaser, provider CTA, trust signals
- Services — Ambulatory, Wheelchair, Gurney/Stretcher (one detailed section each)
- Service Areas — landing pages for Jacksonville, Orlando, Tampa, Miami, Tallahassee, Fort Lauderdale (each with unique SEO `head()` meta + city-specific copy)
- For Providers — pitch page explaining the network, with "Join the Network" CTA
- Training Academy — course catalog (Florida NEMT Basics, HIPAA Training), $100 each
- About, Contact
- Request a Ride — public multi-step form (pickup, drop-off, date/time, transport type, patient details, mobility needs)

**Backend (Lovable Cloud)**
- `ride_requests` table + RLS — anyone can insert, only admins/dispatchers can read
- `contact_messages` table + RLS
- `providers` table (stub for Phase 2)
- Form validation with zod, server functions for inserts

## Phase 2 — Provider network + onboarding

- Provider signup (email/password + Google)
- Provider dashboard
- Vehicle management (add/edit/upload registration & insurance docs)
- Driver management (add/edit/upload license, background check, training certs)
- Document storage via Lovable Cloud Storage
- Provider directory (admin-approved providers shown publicly)

## Phase 3 — Training academy with payments

- Course catalog + course detail pages
- Lovable Cloud Payments (Stripe-powered, $100/course)
- Enrolled-user course player (lessons, video/text content)
- Quiz at end of each course
- Auto-generated PDF certificate on pass, stored per user
- "My Courses" dashboard

## Phase 4 — Broker / dispatch

- Admin/broker dashboard: incoming ride requests queue
- Assign rides to providers in the network (manual first, smart-match later)
- Provider receives ride in their dashboard, accepts/declines
- Status tracking: requested → assigned → in-progress → completed
- Basic reporting

## Design direction

Before Phase 1 I'll generate 3 design directions (clinical-trust / warm-care / bold-modern) so you can pick the visual language. Inspiration pulled from jaxnemt.com, jaxcare.com, stellertransport.com — professional medical/transport, not corporate-cold.

## Technical notes

- TanStack Start (React 19, SSR-friendly, great SEO)
- Each city = own route file = own indexable page with unique title/description
- Lovable Cloud for auth (email+Google), Postgres with RLS, storage, payments
- Mobile-first, accessible (NEMT users include elderly + disabled)
- JSON-LD LocalBusiness + MedicalBusiness schema for SEO

## What I need from you before building

1. **Confirm Phase 1 scope** above is the right starting point (vs. trying to ship everything at once — that always produces worse results)
2. **Business name + tagline** (e.g. "Florida NEMT Network")
3. **Contact info** for the site (phone, email, HQ city) — placeholders OK if not ready
4. **Design direction** — I'll generate 3 options after you confirm

Reply "go" and I'll generate the design directions, then build Phase 1.
