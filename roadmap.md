# Pass 3K — account settings and patient routing
- [x] Target-only patient selection with saved/find/inspect/change/remove UI; server trigger validates eligible recipient and stamps MFN IDs; safe Network patient inbox and accepted-follow-up details, never booking/charges/broadcast
- [x] Shared first/last name, phone and saved notification preferences; password reauthentication; sign out other devices preserves current session; personal/verified-email audit storage
- [x] Reused eleven provider settings tabs, contact/services/hours/service-area editor; public-center proximity separate from private verified offer bases
- [x] Reused owner-scoped dispatch integration tools, masked projections, replacement/revocation; added authorized CSV/XLSX/PDF trip/date-range schedule export; kept Pricing/Payouts/Membership/team tools
- [x] Permanent minimal schedule preview confirmation audit with MFN identities, driver IDs/date range and preview-only sent-zero result; no delivery path
- [x] 36 narrow tests, signed-in settings read and denied empty/missing RPC checks, demo provider select/remove/settings tabs pass; harness typecheck/build OK; existing record fingerprints unchanged (7 requests, 5 trips, 28 profiles, 14 memberships), audit has zero rows
- [ ] Email-change initiation blocked: hosted Secure email change setting cannot be verified with available tools; user must confirm it under More → Users → Auth settings → Email before enabling send action. Actual verification/expiration readback intentionally untested; no emails sent
- [ ] Automatic verification blocked: legacy payment/document records are person-owned, not approved workspace-level entitlement evidence; no approved Super Verified successful-paid-network-trip numerical threshold. Existing directory verification remains unchanged, no invented grants
- [ ] Preference delivery enforcement deferred: settings save preferences, but legacy queue/mail producers need category mapping before optional notices can be safely suppressed without blocking required/security notices
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
- [ ] Later build: Admin and shared Profile & Security redesign

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
