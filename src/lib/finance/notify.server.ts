/**
 * Server-only helper — sends a provider-facing finance email through the
 * managed template helper. Callable only from authorized server routes.
 */
import { sendTemplateEmail } from '@/lib/email-templates/send-email'
import { EmailAPIError } from '@lovable.dev/email-js'
export async function sendFinanceEmail(opts: {
  templateName: 'provider-funds-available' | 'provider-cashout-completed' | 'provider-cashout-failed'
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
  origin?: string
}): Promise<{ ok: boolean; error?: string; reason?: 'recipient_suppressed' }> {
  try {
    const result = await sendTemplateEmail(opts.templateName, opts.recipientEmail, {
      idempotencyKey: opts.idempotencyKey,
      templateData: opts.templateData ?? {},
    })
    return result.sent ? { ok: true } : { ok: false, reason: result.reason }
  } catch (e) {
    if (e instanceof EmailAPIError && e.status === 429) {
      await new Promise(resolve => setTimeout(resolve, (e.retryAfterSeconds ?? 60) * 1000))
    }
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' }
  }
}

export function formatUsd(cents: number | null | undefined): string {
  const n = Number(cents ?? 0) / 100
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
