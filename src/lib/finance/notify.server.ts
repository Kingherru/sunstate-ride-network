/**
 * Server-only helper — sends a provider-facing finance email through the
 * internal transactional endpoint. Callable from server routes / cron routes
 * that already run with SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
export async function sendFinanceEmail(opts: {
  templateName: 'provider-funds-available' | 'provider-cashout-completed' | 'provider-cashout-failed'
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
  origin?: string
}): Promise<{ ok: boolean; error?: string }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return { ok: false, error: 'missing service key' }
  const base = opts.origin
    ?? process.env.SITE_URL
    ?? process.env.VITE_SITE_URL
    ?? 'https://myfloridanemt.com'
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

export function formatUsd(cents: number | null | undefined): string {
  const n = Number(cents ?? 0) / 100
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
