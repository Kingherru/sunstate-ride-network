/**
 * Server-only helper — sends trip lifecycle emails through the internal
 * transactional endpoint. Callable from server functions / webhooks / cron
 * that run with SUPABASE_SERVICE_ROLE_KEY in the environment.
 *
 * Three-email trip workflow:
 *   1. trip-confirmation       — on trip creation
 *   2. trip-accepted-invoice   — when a trip is accepted / awaiting payment
 *   3. trip-final-details      — after payment is confirmed
 */
export type TripEmailTemplate =
  | 'trip-confirmation'
  | 'trip-accepted-invoice'
  | 'trip-final-details'

export async function sendTripEmail(opts: {
  templateName: TripEmailTemplate
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
  origin?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!opts.recipientEmail || !/.+@.+\..+/.test(opts.recipientEmail)) {
    return { ok: false, error: 'invalid recipient' }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return { ok: false, error: 'missing service key' }
  const base =
    opts.origin ??
    process.env.SITE_URL ??
    process.env.VITE_SITE_URL ??
    'https://myfloridanemt.com'
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/lovable/email/transactional/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': serviceKey },
      body: JSON.stringify({
        templateName: opts.templateName,
        recipientEmail: opts.recipientEmail,
        idempotencyKey: opts.idempotencyKey,
        templateData: opts.templateData ?? {},
      }),
    })
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text().catch(() => '')}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' }
  }
}
