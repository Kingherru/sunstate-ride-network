
# Medical Pickups & Deliveries

Treat "medical delivery" as a first-class trip category alongside patient transportation, wired end-to-end: schema → create forms (patient/facility/provider) → dispatch/admin/zone-manager → provider pricing → payouts → a new SEO landing page.

## 1. Data model

Add `trip_kind` to trips so delivery and passenger trips share one pipeline (status, assignment, quotes, payouts, RLS, referrals) but branch on kind where it matters.

- `public.trip_kind` enum: `passenger` (default), `medical_delivery`.
- `trips.trip_kind trip_kind not null default 'passenger'`.
- Delivery-specific columns on `trips` (nullable, only used when `trip_kind='medical_delivery'`):
  - `delivery_item_type` (`prescription | lab_sample | medical_supplies | equipment | dme | other`)
  - `delivery_item_description text`
  - `delivery_weight_lbs numeric`
  - `delivery_temperature_sensitive boolean default false` (refrigerated/cold-chain)
  - `delivery_hazmat boolean default false`
  - `delivery_signature_required boolean default false`
  - `delivery_recipient_name text`, `delivery_recipient_phone text`
  - `delivery_proof_url text` (photo/signature uploaded on completion)
- Mirror the same columns on `ride_requests` so public request forms and the promote-to-trip flow (`promote_ride_request_to_trip`) work without loss.
- Extend `provider_pricing` with delivery rates:
  - `delivery_enabled boolean default false`
  - `delivery_base_cents integer`
  - `delivery_per_mile_cents integer`
  - `delivery_wait_cents integer`, `delivery_wait_unit` (reuse existing `wait_unit`)
  - `delivery_min_fee_cents integer`
  - `delivery_cold_chain_surcharge_cents integer`
  - `delivery_signature_surcharge_cents integer`
  - `delivery_rush_surcharge_cents integer`
- Reuse existing status/quote/payout/RLS. Update `promote_ride_request_to_trip` and any triggers that copy fields between the two tables to carry the new columns and `trip_kind`.

## 2. Pricing engine

Extend `src/lib/pricing.ts`:

- `DeliveryPricingRates` and `DEFAULT_DELIVERY_RATES` mirroring `PricingRates`.
- `calculateDeliveryCost(trip, rates)`: base + mileage + wait + cold-chain + signature + rush, clamp to min fee.
- `calculateTripCost` dispatches on `trip_kind`. Route the trip-review breakdown (`TripFinancialBreakdown`) through the same helper so client charge / referral fee / platform fee / net payout stay accurate for deliveries.
- Server: `estimateTripPrice` and `submit_trip_quote` accept the new fields; server-side clamp (SoftAccess/security trigger from the earlier fix) keeps working.

## 3. Portal create flows

Add a "What are you sending?" toggle at the top of the create form (Passenger / Medical Delivery). Selecting delivery swaps the passenger block for a delivery block; everything else (addresses, date/time, payer, HIPAA ack, referral fee breakdown) is shared.

- Patient portal (`request-a-ride` and dashboard "Request a ride"): expose delivery for prescriptions / DME the patient is arranging themselves.
- Facility portal (`new` and CSV upload): full delivery fields, plus recipient contact.
- Provider portal (dashboard "New trip"): delivery + the sender referral-fee/network breakdown already added.
- Reuse existing components: `NewTripForm`, `PriceEstimate`, `TripFinancialBreakdown`, HIPAA ack, saved locations. Extend the Zod schema (`tripBaseSchema` in `src/lib/trips.functions.ts`) with the delivery fields and require them only when `trip_kind='medical_delivery'`.

## 4. Admin / Dispatch / Zone Manager

Same tables, one filter. No parallel workflow.

- Trip lists (`AdminDispatchPanel`, dispatch queue, zone-manager assign screen) gain a "Kind" column with `Passenger` / `Delivery` badge and a filter.
- Detail views render a delivery card (item type, weight, temperature, recipient) instead of the passenger card when `trip_kind='medical_delivery'`.
- Referral-review modal, financial breakdown, payment collection, payouts, and monthly report already flow off `trips`; they only need the kind badge and the pricing branch.
- Provider matching (`suggest_providers_for_trip`, ZIP coverage) works unchanged; add a soft preference: prefer providers with `delivery_enabled=true` when kind is delivery.

## 5. Provider settings

Under Account → Pricing, add a "Medical Deliveries" section: toggle `delivery_enabled`, set the delivery rate fields, plus a short explainer. Under Account → Business Information add a "Services offered" checkbox for Medical Deliveries so the provider-network directory can filter on it.

## 6. Public SEO landing page

New route `src/routes/services.medical-deliveries.tsx` linked from the services index and main nav.

- H1: "Start Sending Medical Deliveries in Florida".
- Sections: what qualifies (prescriptions, lab & specimen samples, medical supplies, DME, equipment, other healthcare items), who it's for (pharmacies, labs, clinics, hospitals, DME suppliers, home-health), how it works (request → matched provider → tracked → proof of delivery), coverage map, pricing model, compliance (HIPAA-aware handoff), FAQ, dual CTAs ("Start sending deliveries" → facility signup, "Become a delivery provider" → provider signup).
- SEO head: unique title (~55 chars), meta description (~150 chars), canonical + og:url self-referencing `https://myfloridanemt.com/services/medical-deliveries`, og:title/description, og:type `website`, og:image (hero). JSON-LD: `Service` schema with `provider` = Organization + `areaServed` = Florida, plus `FAQPage`.
- Add to `services.index.tsx`, header nav, footer, and sitemap; add an internal link from the facility signup and provider onboarding pages.

## 7. Rollout order

1. Migration (enum, columns on `trips` / `ride_requests` / `provider_pricing`, updated `promote_ride_request_to_trip`).
2. Pricing helpers + Zod schema + server fns.
3. Create-flow UI on the three portals (shared component).
4. Admin / Dispatch / Zone Manager list + detail branches.
5. Provider pricing panel + services-offered toggle.
6. Public SEO page + nav/sitemap.

## Technical notes

- Existing `is_approved_provider` + assignment trigger (soft-access) automatically apply to delivery trips.
- Existing referral-fee snapshot columns and financial-breakdown lockdown apply unchanged.
- Storage: reuse `provider-docs` bucket with `deliveries/{trip_id}/proof.jpg` for proof-of-delivery uploads; add narrow RLS matching trip participants.
- No new pricing table — extending `provider_pricing` keeps one book per provider and one owner-manage policy.
- All new public reads stay behind existing policies; no new anon grants.
