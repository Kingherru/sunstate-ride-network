# Notification preference coverage — Pass 4A

## Central decision

`notification_preference_allows` is a server-side, service-only database helper shared by the existing `network_notify` producer. It reads the recipient's existing `user_profiles.notification_preferences`. Required and unmapped events proceed without consulting optional settings. Only literal JSON `false` disables an optional mapped channel; missing preferences preserve prior behavior. No browser-supplied category or preference decision is accepted.

## Connected optional producer

- Initial `New offer received` in-app notices use `in_app`, only for a pending offer addressed to the receiving workspace, before any provider is selected, and only when the existing important flag is explicitly false.
- The existing offer/distribution identity is verified in the database. This affects only notification creation, not offer creation, visibility, permissions, negotiation or acceptance.
- Network member selection, notification type/title/body/link, existing audit events and unread/read behavior remain unchanged. Suppressed opportunities do not create notification rows; no historical rows are hidden or deleted.

## Required notices retained

`network_update` is NOT an optional category by itself: it also carries Provider selected, Counteroffer accepted and Network completion recorded. All acceptance, negotiation/decline/closure, completion, payment/dispute/deadline and attention notices remain unchanged. Security/Auth, verified email changes, password reset, critical account actions, verification requirements, billing, finance/payouts, patient/facility request updates, assignment, rescheduling, cancellation, dispatch and driver schedules bypass this optional gate.

## Genuine exceptions

- All registered managed email templates are operational, financial, or explicitly requested reports; none is a clearly optional email producer. The saved `email` preference has no connected optional email producer. No template, send helper, signing, retry, suppression or history behavior was changed.
- Legacy `notification_email_queue` entries lack a reliable optional category and recipient-profile mapping; Maps/driver/dispatch/request mail paths remain unchanged rather than suppressing necessary operations.
- Legacy `referral_received`, `trip_offer`, `reservation_expiring` and noninitial Network negotiation/closure events remain deliverable: their meaning is operational or ambiguous. No optionality is inferred from a title, `network_update`, or a false importance flag alone.
- No existing training-reminder, provider-summary, platform-announcement or marketing producer was identified. No new categories, templates, channels or toggles were added. Marketing must not use managed app-email sending.

## Verification and safety

The compatibility migration replaces only the notification producer and adds an internal read-only decision function. It does not alter existing rows, RLS, membership, assignment, authorization or jobs. Seven read-only null-recipient regression assertions passed through the service-only endpoint; the read-query runner was correctly denied execution. Applied function definitions were verified read-only. Disabled-preference/live delivery and interactive checks remain unrun without permitted fixtures. Preview still uses synthetic data and blocks preference saves. Automatic compilation reported build OK.