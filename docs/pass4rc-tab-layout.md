# Pass 4R-C — shared primary rails

Primary sections now use `PortalTabbedLayout`, backed by the existing controlled `SegTabs`. Desktop uses a 16rem left rail and a shrinking right content track; narrow screens and constrained nested shells place the same icon rows above content with local horizontal scrolling. Settings uses that same shell, including Provider Settings. Existing URL/query ownership, callbacks, permissions, mounted/hidden sections and data functions are unchanged.

## Migrated
- Provider Trips: New trips, Reservations, Drafts, History.
- Provider Network: all existing views, including contractor connections; relationship subviews use the same constrained shell.
- Shared People: Patients, Contacts, Payers, New Connections (Provider/Facility).
- Fleet & Drivers, Earnings & Payments and Training & Resources.
- Portal Messaging and Notifications (shared Provider/Patient/Facility routes).
- Shared Trip History/Drafts and Patient trip views, including invoices/payments.
- Patient/Facility Providers: Find/Saved.
- Admin Requests, Messaging, People & Accounts, Payouts/Refunds/Reconciliation.
- Provider, Patient/Facility and Admin Settings; shared Profile & Security section navigation.

## Intentional horizontal exceptions
- Notification All/Unread/Read: secondary read-state filter, including single-section Admin Notifications.
- Reservation Unconfirmed/Booked/Past/Canceled: secondary status filter.
- Scheduler Day/Week/Month: specialized time-scale selector.
- Notes Saved/Archived: secondary archive filter inside the Notes tool.
- Contractor intake: guided progress rather than operational page navigation.
- Public product demo and internal design-system examples: outside authenticated primary page scope.

No genuine primary popup tab caller was found; no tabs were added to detail windows. No primary caller was deferred.

## Focused verification
Automatic typecheck and production build: OK. Provider Trips and Patient Trips previews plus the owner's signed-in Admin People page passed desktop 1280 and phone 390 checks: two-column desktop layout, above-content phone rows, dark-blue/white selected style, icons, Admin count badges, query updates, Home/End/back navigation, switched content and no document overflow or page errors. Provider/Patient checks used existing synthetic previews; no live record mutation was exercised. No database, server function, payment, delivery or permission changes; nothing published.