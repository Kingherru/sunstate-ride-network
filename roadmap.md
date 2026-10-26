# Pass 3F completion and Build 1
# UI improvements — grouped continuation
- [ ] Pass 1: diagnose Vehicles/Drivers/Messaging/Training blank pages; restore provider header controls and identity; compact full-width note editor; public Sign In icon/order; safe removable message examples
- [ ] Pass 2: restrained Pricing/Drivers/content polish, interface sizing settings, consistent activity indicators, Network banner/capability labels and proximity search (requires verified location source)
- [ ] Pass 3: reuse schedule email/export and Provider API integration; no test sends
- [ ] Training rebuild — waiting for the user to supply @basic test; cart only if the imported tests require it
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
