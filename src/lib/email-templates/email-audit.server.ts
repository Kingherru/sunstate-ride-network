import type { EmailWebhookEvent } from '@lovable.dev/email-js'

/** Kept legacy history is notification-only; it never decides whether mail is sent. */
export async function recordSendOutcome(templateName: string, recipient: string, status: 'sent' | 'suppressed' | 'failed', errorMessage?: string) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipient,
      status,
      error_message: errorMessage?.slice(0, 1000) ?? null,
    })
    if (error) console.error('Email history write failed', { code: error.code, message: error.message })
  } catch {
    console.error('Email history write failed')
  }
}

const OUTCOMES = {
  'email.bounced': { reason: 'bounce', status: 'bounced', message: 'Permanent bounce — email address is invalid or rejected' },
  'email.complaint': { reason: 'complaint', status: 'complained', message: 'Spam complaint — recipient marked email as spam' },
  'email.unsubscribed': { reason: 'unsubscribe', status: 'suppressed', message: 'Recipient unsubscribed' },
} as const

export async function recordEmailOutcome(event: EmailWebhookEvent<'email.bounced' | 'email.complaint' | 'email.unsubscribed'>) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  // Reuse the existing primary key for durable delivery deduplication; no new table needed.
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`email-event:${event.event_id}`)))
  const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('')
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  const { data: previous, error: readError } = await supabaseAdmin.from('email_send_log').select('id').eq('id', id).maybeSingle()
  if (readError) throw new Error(`Email event history read failed: ${readError.code}`)
  if (previous) return

  const outcome = OUTCOMES[event.type]
  const recipient = event.data.recipient.toLowerCase()
  const { error: suppressionError } = await supabaseAdmin.from('suppressed_emails').upsert({
    email: recipient, reason: outcome.reason, metadata: null,
  }, { onConflict: 'email' })
  if (suppressionError) throw new Error(`Email outcome write failed: ${suppressionError.code}`)

  const { error: logError } = await supabaseAdmin.from('email_send_log').upsert({
    id, message_id: event.data.message_id ?? null, template_name: 'system',
    recipient_email: recipient, status: outcome.status, error_message: outcome.message, metadata: null,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (logError) throw new Error(`Email event history write failed: ${logError.code}`)
}