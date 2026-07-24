/**
 * Server-only helper — sends trip lifecycle & workflow emails through the
 * internal transactional endpoint. Callable from server functions / webhooks
 * that run with SUPABASE_SERVICE_ROLE_KEY in the environment.
 *
 * Customer emails (existing):
 *   1. trip-confirmation       — on trip creation
 *   2. trip-accepted-invoice   — when accepted / awaiting payment
 *   3. trip-final-details      — after payment confirmed
 *
 * Role-aware workflow emails (new):
 *   - provider-quote-request    — MFN → providers, needs a quote
 *   - provider-approval-request — provider → MFN or peer provider, needs approve/decline
 *   - staff-new-trip-review     — patient/facility → assigned provider or MFN staff
 */
export type TripEmailTemplate =
  | 'trip-confirmation'
  | 'trip-accepted-invoice'
  | 'trip-final-details'
  | 'provider-quote-request'
  | 'provider-approval-request'
  | 'staff-new-trip-review'

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

export function siteBase(): string {
  return (
    process.env.SITE_URL ??
    process.env.VITE_SITE_URL ??
    'https://myfloridanemt.com'
  ).replace(/\/$/, '')
}

/**
 * Resolve unique email addresses for MFN staff (admin / app_manager /
 * dispatcher / zone_manager / staff). Uses the admin auth API to pull the
 * mailbox for each staff user_id. Deduped, capped, safe on failure.
 */
export async function getStaffRecipients(limit = 8): Promise<Array<{ userId: string; email: string }>> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'app_manager', 'dispatcher', 'zone_manager', 'staff'])
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean))).slice(0, limit)
    const out: Array<{ userId: string; email: string }> = []
    for (const uid of ids) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid)
      const email = data?.user?.email
      if (email) out.push({ userId: uid, email })
    }
    return out
  } catch (e) {
    console.error('getStaffRecipients failed', e)
    return []
  }
}

/**
 * Providers in a region who could quote/accept an unassigned trip.
 * Approved status only. Prefers dispatch_email, falls back to primary email.
 */
export async function getProvidersInRegion(region: string | null | undefined, limit = 25): Promise<Array<{ userId: string | null; email: string; name: string | null }>> {
  if (!region) return []
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('provider_applications')
      .select('id, company_name, email, dispatch_email, region, status')
      .eq('status', 'approved')
      .eq('region', region)
      .limit(limit)
    return (data ?? [])
      .map((r: any) => ({
        userId: null,
        email: (r.dispatch_email || r.email || '').trim(),
        name: r.company_name ?? null,
      }))
      .filter((r) => /.+@.+\..+/.test(r.email))
  } catch (e) {
    console.error('getProvidersInRegion failed', e)
    return []
  }
}

/** Look up the recipient email + display name for a target user (provider or facility). */
export async function getUserMailbox(userId: string | null | undefined): Promise<{ email: string | null; name: string | null }> {
  if (!userId) return { email: null, name: null }
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = data?.user?.email ?? null
    const { data: prof } = await supabaseAdmin
      .from('member_profiles')
      .select('company_name, first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()
    const name = prof?.company_name
      ?? [prof?.first_name, prof?.last_name].filter(Boolean).join(' ')
      ?? null
    return { email, name: name || null }
  } catch {
    return { email: null, name: null }
  }
}

/** Classify the caller for routing logic. */
export async function getCallerRole(userId: string): Promise<'staff' | 'provider' | 'facility' | 'patient'> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    const list = (roles ?? []).map((r: any) => r.role)
    if (list.some((r: string) => ['admin', 'app_manager', 'dispatcher', 'zone_manager', 'staff'].includes(r))) return 'staff'
    if (list.includes('provider')) return 'provider'
    if (list.includes('facility')) return 'facility'
    return 'patient'
  } catch {
    return 'patient'
  }
}

/** Format a trip-ish object for template data. Works for `trips` and `ride_requests`. */
export function summarizeTrip(t: any): Record<string, unknown> {
  const short =
    t?.trip_number ??
    (t?.id ? String(t.id).slice(0, 8) : '')
  return {
    tripShortId: short,
    pickupAddress: [t?.pickup_address, t?.pickup_city].filter(Boolean).join(', '),
    dropoffAddress: [t?.dropoff_address, t?.dropoff_city].filter(Boolean).join(', '),
    pickupDate: t?.pickup_date ?? '',
    pickupTime: t?.pickup_time ?? '',
    tripType: t?.round_trip ? 'Round Trip' : (t?.trip_type ?? 'One-way'),
    transportType: t?.transport_type ?? '',
  }
}

/** Fan out a workflow email to a list of recipients, one per mailbox, with per-recipient idempotency. */
export async function fanOut(opts: {
  templateName: TripEmailTemplate
  recipients: Array<{ email: string; name?: string | null; userId?: string | null }>
  baseIdempotencyKey: string
  templateData: Record<string, unknown>
  recipientNameKey?: string
}): Promise<void> {
  const seen = new Set<string>()
  for (const r of opts.recipients) {
    const email = r.email?.toLowerCase().trim()
    if (!email || seen.has(email)) continue
    seen.add(email)
    const key = `${opts.baseIdempotencyKey}:${r.userId ?? email}`
    await sendTripEmail({
      templateName: opts.templateName,
      recipientEmail: email,
      idempotencyKey: key,
      templateData: {
        ...opts.templateData,
        [opts.recipientNameKey ?? 'recipientName']: r.name ?? 'there',
      },
    })
  }
}
