# Automatic verification lifecycle activation

Prepared SQL-only function: `public.provider_verification_lifecycle()`.

The existing database has pg_cron enabled and serves both preview and production. No new job was activated: the brief forbids changing real records. After owner authorization, run this through the database write tool (not a migration):

```sql
SELECT cron.schedule('provider-verification-lifecycle', '0 * * * *',
  'SELECT public.provider_verification_lifecycle();');
```

Hourly means 24 runs/day and up to one hour before persisted expiration/overdue notifications. Badge reads immediately re-evaluate timestamps without writes. The job is transactional, locked and transition-idempotent; it sends only in-app notifications and never emails or moves money. Dates use America/New_York. No HTTP endpoint or browser-visible credential authorizes this work.

## Unfinished email changes

Hosted Auth owns confirmation token expiry. Its configured TTL has not been verified and managed Auth token fields must not be altered by this application. No guessed expiry, canceled status, or removal of a pending email is performed. The existing failure handler audits provider-reported expired codes; an authoritative hosted expiration callback/configured TTL with supported pending-request invalidation is still required for unattended expiry. This is not enabled by the SQL job above.

## Financial evidence

Only server-created explicit Network obligation linkage may set `network_stripe_payment_intent_id`, environment and recipient account on an existing distribution. There is no new charging flow. Ordinary trip payments/transfers never establish Network settlement. Existing unlinked Connect accounts remain nonqualifying until their environment and company linkage are established by authoritative onboarding evidence. Test webhooks are configured; live events and publishing remain untouched.