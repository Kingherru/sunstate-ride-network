# Florida MVP launch sequence
1. [x] Onboarding foundation — Pass 4B; three signup choices, verified-email continuation, optional saved setup steps, authoritative personal/workspace/patient fields, existing private credential and Network forms, synthetic Master Admin preview. New account setup creates active basic workspaces; no existing workspace statuses/classifications changed.
   - Existing owners may resume/review from Settings without portal lockout; training-only and role routing retained. No real account creation/save/upload/email/payment was exercised.
   - Remaining focused follow-up: consolidate legacy business application and verification legal/address fields after confirming authoritative ownership; credential policy/carrier fields stay limited to the existing model; multiple-owned-account setup selection and legacy missing-organization recovery are not completed here. Single patient mobility default only, no new relationship authority.
2. [x] Provider Settings rebuild and provider-owned pricing — Pass 4C: six sections, private effective-dated Customer Pricing with confirmation and locked owner/admin writes (contractors excluded), integer cents, four services, append-only version/person/workspace attribution, future quote calculation with snapshot; no existing rates or trips rewritten.
   - Existing pricing/team/profile/payout extras moved into sections; legacy application history and attested legal identity intentionally retained because they are different authoritative records, not duplicate copies. Onboarding and Settings share Network services/Medical Delivery and private credential carrier/policy/coverage/effective/expiry fields. Legacy section/tab query aliases retained.
   - Limitations: workspace contact editing still uses the existing single-owner onboarding path; admins cannot read another person's legacy pricing under its existing RLS, so missing values are clearly unsaved placeholders. No historical rate versions can be reconstructed before the first save. New customer pricing is prepared for the later live-invoice/New Trip build, not wired to reprice existing estimates/trips. Weekend surcharge is not an existing supported component. No real pricing save/upload/financial action or browser flow was exercised.
   - Verification: six targeted pricing-rule tests passed; automatic compilation reported build OK. No manual build/typecheck commands, broad tests, scans or real data writes.
   - Business & Operations; Pricing; Credentials & Verification; Team & Integrations; Billing & Payouts; Account & Security.
   - Provider Pricing controls provider customer rates only. Admin Pricing controls platform membership, Referral Network add-on, platform fees and system guardrails.
   - Rate changes apply to new quotes/drafts only, never booked, paid, completed or historical trips.
   - Consolidate duplicate Provider Settings panels only after confirming shared authoritative data/actions.
3. [ ] Account linking, Who Referred You, and invitations — next Florida MVP build.
   - Pass 4D in progress: separate source attribution, private preferred provider, and explicitly accepted business connections; secure workspace-scoped invitations, no membership/trip/payment access.
4. [ ] Patient trip visibility, status timeline, and history.
5. [ ] Provider/Facility New Trip with live invoice or referral funding.
6. [ ] Linked-patient invoicing and secure payments.
7. [ ] Patient trip reminders and status communications.
8. [ ] Public five-minute-trip conversion/explainer page.
9. [ ] Provider Network proximity search using safe public locations.
10. [ ] Stripe/lifecycle/domain/legal/phone/launch configuration.
11. [ ] Final focused validation and publishing.
   - [ ] Final polish (low priority): On tablet and mobile, add a compact secondary public-site header row outside the hamburger menu with SIGN IN and CALL US, including clear icons, so those actions remain obvious to visitors who do not recognize a hamburger menu. Preserve the hamburger menu and avoid duplicating the actions on desktop.

Regional mynnemt.com branding is planned after the Florida MVP and is not a Florida launch blocker.
Historical evidence and blockers remain below; unfinished shared commerce is retained rather than assumed complete.

# Shared commerce checkout
- [ ] Finish existing shared cart selection, secure embedded checkout, pay-now/trial selection and truthful purchase confirmation.
- [ ] Preserve authoritative paid-base verification, course ownership, preview blocking and webhook retry behavior; run focused rules and automatic compilation checks without real payments or activation.

# Membership verification pricing finding
- [x] Confirmed the deployed evaluator still restricted invoice totals to former prices; replaced only its amount guard and outdated requirement label, preserving authoritative live paid-base evidence and all other badge requirements. Course-inclusive totals rely on the existing server-validated succeeded state; no account recalculation or record edits.
- [x] Eight invoice tests (17 assertions) and eight read-only deployed SQL price/proof assertions passed; automatic compilation reported build OK. No publishing, charges, sends or activation. Paid-provider end-to-end recalculation was not exercised because it would change real records.

# Pass 4A — saved notification preferences
- [x] Existing initial pending/unaccepted Network offer notices mapped to in_app; all accepted-trip/security/account/finance/deadline operations preserved, ambiguous legacy categories unchanged.
- [x] One internal server-side decision reads saved preferences before existing Network inserts; required/default/unknown events proceed. Settings distinguishes optional opportunity notices and always-enabled required notices; email choice honestly marked not connected to an optional producer. Queue/templates/history/unread and preview guards unchanged.
- [x] Automatic build OK at 03:49:02 UTC; seven targeted read-only null-recipient helper assertions passed using the service-only endpoint after the read-query runner correctly denied helper execution. Applied function definitions verified read-only. No delivery, data rows, access permissions, publishing, money movement or activation.
- Exception: legacy queue email entries lack reliable optional category/profile mapping; no existing optional training/summary/announcement email producer identified. These remain unchanged, documented in docs/notification-preference-coverage.md. Disabled-preference/live delivery readback intentionally unrun without permitted fixtures.

# Pass 3Z — Administrators and shared Profile & Security
- [x] Compact selectable administrator list and structured existing permission editor, clear preset/read-only/selected/status states, covered accounts and separated red removal confirmation; all authorization retained.
- [x] Shared solid Profile, Contact information, Account status/type, Password & sign-in, Sessions & devices and Security activity groups through Admin settings, Provider/Contractor Account & Security, Patient/Facility Security and synthetic previews; existing actions and guards retained. Customer account details use matching solid groups and above-field labels.
- [x] Automatic compilation reported build OK at 03:44:06 UTC; no manual checks, browser/tests, records, sends, publishing or activation. Interactive verification deliberately unrun under this pass's restrictions.

# Pass 3Y — compact expandable portal details
- [x] Shared compact desktop/tablet detail sizing, viewport Expand/Restore with reset on close and unchanged phone touch sizing.
- [x] Logical worksheet groups and minimal hooks for legacy driver, referral, reservation, settlement, contractor editor and earnings PDF windows; compact confirmations/vehicle forms unchanged.
- [x] Automatic compilation reports build OK; no manual builds, browser/tests, records or activation. Interaction/viewport checks deliberately unrun under pass restrictions.

# Pass 3X — portal visual completion
- [x] Full-height shared sidebar edge strengthens on main-workspace hover/focus; inward glow does not cross header. Drawer edge stays subtle and disappears when unmounted.
- [x] Completed custom Fleet/driver/admin/reservation/settlement dialog borders and dividers; monetary values emphasized across billing, earnings, pricing, payouts, cart and offer histories. Secondary/notification controls brightened; semantic/disabled meanings preserved.
- [x] Automatic compilation log reports build OK; no explicit prohibited commands, browser/audit/test sweeps or activation. Interactive viewport checks intentionally not run.

# Pass 3W — public visual modernization
- [x] Refined shared public header/footer, homepage photo framing and white/blue/pale-blue section rhythm.
- [x] Strengthened path/step cards, product previews, map surround, services and membership emphasis; shared inner-page presentation only. Existing text/photos/links and interactions retained.
- [x] Automatic compilation checks report build OK; no manual builds, browser/test sweeps, backend changes or activation. Visual viewport verification intentionally not run under this pass's check restriction.

# Pass 3L completion — automatic evidence and lifecycle
- [x] One database evaluator reads existing live membership invoices, approved services/business evidence, protected owner-attested documents, explicit Connect linkage, Network settlement/disputes and suspension; event triggers recalculate without browser writes. Future membership/Connect onboarding stamps server-validated company linkage; no existing accounts changed.
- [x] Protected business requirement entry and credential effective-date/name/attestation fields; shared provider/admin safe checklist. Signed-in administrator opened real provider summary: missing requirements shown honestly, no private files/amounts exposed.
- [x] Prepared locked idempotent SQL lifecycle for document expiration/30-day warnings, overdue audit/in-app notices and affected badge recalculation; pg_cron already available. No job activated because shared production records must remain unchanged. Exact hourly activation in docs/verification-lifecycle-activation.md.
- [x] Five new narrow tests/22 assertions passed; latest automatic typecheck/production build OK. Counts unchanged: 7 requests, 5 trips, 28 profiles, 14 memberships, zero audit rows and seven suspended test profiles. Test webhook added only account.updated and three intent events; prior events retained.
- [ ] Owner configuration: authorize hourly SQL lifecycle activation (24 runs/day, up to one-hour notification delay); publishing/live events remain explicitly outside this pass.
- [ ] Genuine blocker: hosted Auth TTL/expiration callback with supported pending-change invalidation remains unavailable; no guessed expiration or managed Auth token edits. New lifecycle does not claim unattended email expiration.
- [ ] Financial evidence: legacy Connect environment/company and existing membership entitlement remain unlinked; new Network intent reconciliation requires an explicit server-created obligation/recipient link from an authorized payment flow. No charge flow invented and no ordinary trip payout treated as Network payment. Full evidence writes/scheduled transitions untested under real-write prohibition.

# Pass 3L — connected payments, verification and email audit
- [x] Owner-confirmed secure setting enables server recent-AMR/password reauthentication and standard Auth update; requested/confirmed/canceled triggers and sanitized failed/expired code outcomes audit permanently. Signed-in personal settings panel verified without submission.
- [x] Extended subscriptions/workspaces rather than duplicate products/tables; existing nemt_membership_monthly_v2 price and current Stripe invoice/charge evidence drive audited Semi only for explicitly linked business entitlement. NULL retains legacy directory status; no existing membership linked or modified.
- [x] Extended trip_distributions with scoped locked completion-information/dispute/resolution actions, New York three-weekday deadline, pause duration, safe timestamps/audit and completion/dispute in-app notices. Payments tab displays safe states; no charging path or real actions exercised.
- [x] Shared badge labels/explanations on directory list/profile, account identity, admin provider rows and detail overlay; scoped billing admin reason/confirmation pause, Master protection, no normal manual approval.
- [x] 42 focused tests/123 assertions pass, anonymous financial RPCs denied and direct badge recalculation denied to authenticated users; harness type/production build OK. Signed-in settings and admin badges read-only checked. Counts unchanged: 7 requests, 5 trips, 28 profiles, 14 memberships, zero audit entries.
- [x] Superseded by completion: automatic evidence calculations/entry/event connections now built; legacy unlinked records still do not qualify.
- [x] Superseded by completion: explicit Network Stripe reconciliation and prepared SQL lifecycle built; activation and authorized payment obligation linkage remain separately listed above.
- [ ] Blocked: live refund/dispute webhook subscriptions deliberately not enabled under no-real-account-change rule; test webhook expanded only. Live setup needs explicit authorization, no publishing performed.
- [ ] Blocked: explicit cancellation and unattended expiration of pending Auth changes need authoritative hosted lifecycle support; current code audits actual pending removal and provider-reported expired code, never treats dismissal/time alone as cancellation/expiration. Full email/payment end-to-end untested under no-real-action restriction.

# Pass 3K completion — email security and automatic verification
- [x] Historical Pass 3K: secure setting unreadable and feature disabled then; superseded by owner-confirmed ON and Pass 3L initiation/lifecycle above.
- [x] Saved approved $10 membership/30-day trial, five-trip Gold, three-business-day sender initiation and 24-hour dispute rules; added pure fail-closed eligibility checks and replaced outdated verification copy with approved checklist and explicit inactive status. Existing membership product/directory badges/records/guidance unchanged.
- [ ] Automatic audited levels blocked: authoritative business billing/invoice entitlement, full applicable business/document checklist with business-name match/Stripe linkage, and Network obligation/payment-initiation/settlement/dispute/deadline evidence are absent; must connect these before enabling real badge writes. No invented evidence, no manual approval requirement.
- [x] 16 narrow tests/64 assertions pass; deployed audit/credential/membership/profile access policies inspected read-only; automatic type/production build OK. No broad roles/browser checks, sends, purchases, migrations, real-record changes or publishing.

# Team menu access finding
- [x] CSV uses server-derived single eligible active customer membership capability; sidebar and page guards share checks, Messaging hidden without capability; existing server authorization unchanged. Eight tests/51 assertions pass; signed-in Master Admin CSV/template-upload opens without runtime errors, automatic build OK. Actual member-account browser check unavailable without authorized member identity; no real writes or publishing.

# Pass 3K — account settings and patient routing
- [x] Target-only patient selection with saved/find/inspect/change/remove UI; server trigger validates eligible recipient and stamps MFN IDs; safe Network patient inbox and accepted-follow-up details, never booking/charges/broadcast
- [x] Shared first/last name, phone and saved notification preferences; password reauthentication; sign out other devices preserves current session; personal/verified-email audit storage
- [x] Reused eleven provider settings tabs, contact/services/hours/service-area editor; public-center proximity separate from private verified offer bases
- [x] Reused owner-scoped dispatch integration tools, masked projections, replacement/revocation; added authorized CSV/XLSX/PDF trip/date-range schedule export; kept Pricing/Payouts/Membership/team tools
- [x] Permanent minimal schedule preview confirmation audit with MFN identities, driver IDs/date range and preview-only sent-zero result; no delivery path
- [x] 36 narrow tests, signed-in settings read and denied empty/missing RPC checks, demo provider select/remove/settings tabs pass; harness typecheck/build OK; existing record fingerprints unchanged (7 requests, 5 trips, 28 profiles, 14 memberships), audit has zero rows
- [x] Email-change initiation superseded by Pass 3L after owner confirmed secure setting ON; delivery/confirmation readback remains intentionally untested, no emails sent.
- [ ] Automatic verification blocked: legacy payment/documents remain person-owned with no authoritative business entitlement/Network settlement-dispute-deadline linkage. Five-trip threshold and detailed requirements now approved and covered by pure policy checks above; live directory verification unchanged.
- [x] Preference delivery enforcement: Pass 4A connects unambiguous initial Network opportunities; required and unmapped legacy producers remain unchanged. Missing optional email mappings are explicitly documented in Pass 4A.
- [ ] Authenticated create/save/accept/audit/export/proximity readback blocked: no permitted synthetic writes or populated public-center fixtures; tested UI choices in isolated demo only and safe live reads/denials, not a complete end-to-end workflow

# Routing and security clarifications
- [x] Owned trips remain Trips/Reservations/Schedule/History; provider offer/proposed-amount/sent activity moved to shared Network page in live and demo, accepted referral confirmation stays under Trips
- [x] Request creation has no distribution creation; separate sharing/payment acknowledgement and wave confirmation retained. Card persistence projects only Stripe IDs/brand/last4/expiry; personal settings expose no role/account_type change. Demo reads remain isolated; 30 focused tests and preview navigation pass, automatic build OK, no writes/publish
- [x] Patient provider selection connected in Pass 3K; targeted request create/accept readback remains untested under real-write prohibition
- Deferred: email changes remain unavailable/read-only; hosted secure-email-change setting not verified and no auth settings or email sends changed

# Pass 3J — training integration and shared details
- [x] Reused six source readings, 25 questions, sequential answer feedback, 80% pass and retake; existing ownership/certificates remain authoritative, no source accounts/secrets/storage
- [x] Training views, materials, result history, safe isolated preview and authenticated multi-course cart; both existing $50 price mappings retained, missing mappings blocked
- [x] Shared colored detail sections/frame for requests/trips/offers/drafts; schedule click wired, original RLS preserved, notes included and dates readable
- [x] Narrow rule tests, signed-in safe preview/materials/cart/admin and authorized detail opening passed; automatic typecheck/build OK; record fingerprints unchanged (0 enrollments/certificates/attempts, 5 trips, 7 requests)
- [ ] Blocker: purchase-to-completion/certificate readback intentionally untested because purchases/attempt writes are forbidden and no existing enrollments are available
- Deferred: source has no question/material/visibility/attempt-rule editors or durable progress; adapted Master-only completion search, not a new management system. Checkout Stripe call was not exercised to avoid creating customer/session records. Source historical certificates require an export if requested.

# Pass 3F completion and Build 1
# Pass 3I — implementation
- [x] Shared New Trip access and provider-created request history separate from incoming offers
- [x] MD notes restore delivery-only secure drafts, original text retained; existing validation unchanged
- [x] Messaging account/sender/subject/preview search, matching borders, combined unread indicator
- [x] Fleet & Drivers reuses existing actions/capacity; legacy links redirect to correct tab
- [x] Earnings & Payments reuses financial tools; single provider-owner access only, no fake preview finances
- [x] Schedule one/multiple/all-driver date/range preparation, confirmation, session-only safe audit; no sends
- [x] Shared header controls and bottom identity, no top identity repeat
- [x] Network reminder and normalized capability labels
- [x] 16 focused tests and six preview-page opening checks pass; automatic typecheck/production build clean; no publish or real writes
- [x] Durable preview-only audit added in Pass 3K; real sending remains disabled and requires an approved delivery workflow
- [ ] Blocker: workspace-wide financial team access needs an approved financial permission model; legacy owner-only tools remain restricted
- [ ] Blocker: saved MD draft authenticated readback not exercised because real-record writes are prohibited; parser/restoration and form opening checked
- Deferred: distance search, dispatch/API/exports Settings, major Admin/security redesign, unrelated public polish, sizing controls
# UI improvements — grouped continuation
- [x] Pass 1: repaired Vehicles missing-type crash and fleet error states; explicit Training empty/error state (no training rebuild); restored live provider notification control; identity above Change Log; full-width compact notes and draft-only instructions; public Sign In icon/order; isolated opt-in removable conversation examples in both portals/previews. Two navigation tests and harness build pass; signed-in Master Admin live pages and preview note/example read-remove flows checked without saving/sending.
- [x] Smart Notes copy addendum: removed "Operational business notes"/"Private to you"/team-sharing wording, instruction now "Write quick notes or create trips with note shortcodes", placeholder "Type your note here...", compact one-line workflow reference; typing/save/archive/restore/Back to notes/Create trip from note and private permissions unchanged, no stored-note or parser changes. This earlier copy-only stage was superseded by the approved shortcode parser below.
- [x] Smart Notes shortcode parser (src/lib/note-shortcodes.ts): full owner-supplied dictionary, case-insensitive, colon or space, bare codes only when uppercase/line-start so prose like "confirm the lift" is not read as a code; maps only onto fields the New Trip form actually restores, everything else kept in Additional Information; compact common-code reference, collapsible full guide, live "what this note will fill" check. 10 bun tests pass, type check and build OK; form verified to open filled from a parsed draft (temporary draft deleted afterwards).


- Deferred: Pricing/content polish, sizing settings and proximity search; Network reminder/capability labels completed in Pass 3I. Proximity needs authorized verified-location data.
- Deferred: dispatch exports/API Settings and live schedule send/audit; safe schedule preparation completed in Pass 3I.
- [x] Training rebuild — source supplied and integrated in Pass 3J; checkout and completion verification limits listed above
- [x] Later build: Admin and shared Profile & Security presentation completed in Pass 3Z; existing permission and authentication systems retained.

- [x] Email update: replaced Lovable queue sends, preserved templates/history, signed outcome receiver, removed five replaced repo files; 25 tests pass and harness build OK; sign-in renders and unsigned callbacks return 401. No real sends or publish. Independent Maps confirmation and driver assignment/schedule notification queue paths unchanged.
- [x] Latest brief: payment responsibility acknowledgement, active wave recipients, shared conditional field layout, exact selected service/trip types, offer amounts/history, People account-status/type/email filters
- [x] Ten focused tests pass; harness build OK; acceptance lock/rollback predicates confirmed; counts unchanged at 28/13/7/5, zero messages/offers, seven disabled tests
- [x] Controlled-offer actions wired; failed association rolls back, source/test-state checks and execution grants hardened
- [x] Shared permission-filtered request/trip overlay, safe offer frame, related record entry points
- [x] Admin dashboard groups and Administrators layout
- [x] People search/activity/status/details, in-app messaging, protected removal controls (no real removal/message performed)
- [x] Small shared Contacts width adjustment
- [x] Current harness build OK; 15 focused tests pass; record totals unchanged at 28/13/7/5 and zero messages/offers
- [x] Business workspace RLS and explicit team Read/Manage permissions; creator identity preserved
- [x] Draft load/save/resume wiring, wheelchair capacity, schedule vehicle filter and conflict indications
- [x] Reviewed distribution, manual distance waves and verified service-base eligibility controls
- [x] Addressed offers, negotiation history, locked acceptance, reservation/schedule association and in-app event functions
- [x] Provider/scoped admin controls, future timing settings (automation off), internal feature entries (partial; public approval false)
- [x] Narrow rule tests, signed-in admin read check, current build result and unchanged record counts
- [ ] Two-provider concurrent acceptance and authenticated overlay readback — blocked: sandbox cannot assume authenticated role or execute protected network RPCs; no real trips or disabled accounts may be used
- [ ] Saved-draft/accepted-provider UI readback — blocked: no approved synthetic authenticated fixture; broad browser review explicitly excluded
- [ ] Contractor assignment-specific controls — deferred outside Build 1; requires approved assignment-sharing design
- [ ] Direct authenticated cross-workspace check — blocked: read-only sandbox is denied execution of protected network access functions; no approved synthetic identity

# Pass 3G — Provider Network, messaging, notes, shared portal UI
- [x] Shared toolbar-control style (.portal-toolbar/.portal-control/.portal-search); Schedule toolbar on one aligned row, visible Vehicle label removed (aria-label kept), equal heights
- [x] Provider Network two-panel layout (list left, profile right; mobile Back to Providers); profile shows safe public business fields only; verified badge from existing RPC, no new statuses
- [x] Message Provider reuses find_or_create_workspace_conversation (no duplicates), permission-checked, safety notice in dialog
- [x] Email-style messaging: sidebar + conversation with mobile list-first and Back to Conversations in WorkspaceMessaging and MessagesPanel; green static unread dot on Messaging nav; read-on-open kept; read-only admins no longer see send/compose/delete controls
- [x] Platform Requests: platform_requests + platform_request_events (MFN-Q- IDs, RLS, grants) via migration 0019; provider tab in Account settings; Admin Messaging REQUESTS tab with reply + status changes + history; no external email
- [x] Notifications: request links open the shared detail overlay; category/unread layout retained; search icon spacing via shared style
- [x] Smart Notes sticky redesign: lighter pale yellow, click-to-type single field, Save/Archive/Restore, list sidebar, mobile list-first, private-to-creator kept
- [x] Notes-to-trip: CREATE TRIP FROM NOTE saves a server-side draft carrying only the note text into Special instructions and opens the draft form; no auto-submit, no browser storage
- [x] Compact identity block under logo (name, role with icon, MFN ID; no email; MFN removed from footer)
- [x] Sidebar hover effect preserved (existing .portal-sidebar::after rule untouched)
- [x] Contacts pages widened modestly (max-w-7xl) with balanced columns
- [x] Checks: tsgo clean, harness build OK 00:19Z, record counts unchanged at 28/13/7/5 with zero messages/offers/platform requests; cross-workspace messaging guard unchanged (can_access_workspace_messages re-verified on every write; direct authenticated execution remains sandbox-blocked as before)

# Pass 3M completion (Option 1)
- [x] Shared overlay: blue top border, context titles, visible MFN ID, gray canvas/white cards, readable dates, ZIPs, deactivated warning; admin status/history and actions inside
- [x] Admin actions: Edit/Save, Deny (reason, In Review only), Deactivate (soft, reason) via audited server function; Resend and Forward/Redistribute disabled with explanation
- [x] People & Accounts: single email, ZIP/city/address, edit details, deactivate/restore with reason (Master Admin and disabled test accounts protected), Open in Messaging selects the conversation
- [x] Provider Viewed recorded once on explicit live-portal open; database limits it to the selected provider while Distributed
- [x] Messaging sidebar red dot includes unread website contacts; removable in-memory DEMO samples when lists are empty
- [ ] Owner decision: Resend needs a chosen request-notification email (none exists to resend)
- [ ] Owner decision: approve the provider-offer distribution build before Forward/Redistribute is enabled
