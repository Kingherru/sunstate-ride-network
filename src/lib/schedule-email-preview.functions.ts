import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ driverIds: z.array(z.string().uuid()), allDrivers: z.boolean(), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine((v) => v.end >= v.start, "End date must follow start date");
/** Read-only preparation: deliberately contains no mail/queue or audit writes. */
export const previewScheduleEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => input.parse(v))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: memberships, error: memberError } = await db.from("workspace_members")
      .select("workspace_id, role, workspaces!inner(account_type, status)").eq("user_id", context.userId).is('removed_at', null).eq('is_contractor', false);
    if (memberError) throw new Error("Could not verify workspace access.");
    const allowed = (memberships ?? []).filter((m: any) => ["owner", "admin"].includes(m.role) && m.workspaces.account_type === "provider" && m.workspaces.status === "active");
    if (allowed.length !== 1) throw new Error("One authorized provider workspace is required.");
    const workspace = allowed[0].workspace_id;
    let query = db.from("drivers").select("id, first_name, last_name, email, workspace_id").eq("workspace_id", workspace);
    if (!data.allDrivers) query = query.in("id", data.driverIds);
    const { data: drivers, error: driverError } = await query;
    if (driverError) throw new Error("Could not load authorized drivers.");
    if (!data.allDrivers && data.driverIds.some((id) => !drivers?.some((d) => d.id === id))) throw new Error("Driver access denied.");
    const ids = (drivers ?? []).map((d) => d.id);
    const { data: trips, error: tripError } = ids.length ? await db.from("trips")
      .select("id, driver_id, pickup_date, pickup_time, pickup_address, pickup_city, dropoff_address, dropoff_city, network_provider_workspace_id, assigned_to")
      .in("driver_id", ids).gte("pickup_date", data.start).lte("pickup_date", data.end)
      .or(`network_provider_workspace_id.eq.${workspace},assigned_to.eq.${context.userId}`).order("pickup_date").order("pickup_time") : { data: [], error: null };
    if (tripError) throw new Error("Could not load authorized schedules.");
    return { safeMode: true as const, start: data.start, end: data.end, recipients: (drivers ?? []).map((d) => ({
      id: d.id, name: `${d.first_name} ${d.last_name}`.trim(), email: d.email,
      trips: (trips ?? []).filter((t) => t.driver_id === d.id).map((t) => ({ reference: t.id.slice(0, 8).toUpperCase(), date: t.pickup_date, time: t.pickup_time, pickup: [t.pickup_address, t.pickup_city].filter(Boolean).join(", "), destination: [t.dropoff_address, t.dropoff_city].filter(Boolean).join(", ") })),
    })) };
  });

export const confirmScheduleEmailPreview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => input.parse(v)).handler(async ({ data, context }) => {
    if (data.allDrivers) throw new Error('Confirm the reviewed driver list.');
    const { data: id, error } = await context.supabase.rpc('confirm_schedule_email_preview', { _drivers: data.driverIds, _start: data.start, _end: data.end });
    if (error) throw new Error('Could not record the authorized preview.');
    // Record an idempotent prepared batch. Sending stays behind the OFF 'driver_schedule_email' launch flag;
    // no email provider is invoked from this function.
    const { data: ws } = await context.supabase.from('workspace_members').select('workspace_id, role, workspaces!inner(account_type, status)').eq('user_id', context.userId).is('removed_at', null).eq('is_contractor', false);
    const own = (ws ?? []).filter((m: any) => ['owner', 'admin'].includes(m.role) && m.workspaces.account_type === 'provider' && m.workspaces.status === 'active');
    if (own.length === 1) {
      const sorted = [...data.driverIds].sort();
      const raw = `${own[0].workspace_id}|${sorted.join(',')}|${data.start}|${data.end}`;
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))).map((b) => b.toString(16).padStart(2, '0')).join('');
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: prof } = await supabaseAdmin.from('user_profiles').select('mfn_id').eq('user_id', context.userId).maybeSingle();
      await supabaseAdmin.from('driver_schedule_email_batches').upsert({ workspace_id: own[0].workspace_id, idempotency_key: `driver-schedule:${digest}`, driver_ids: sorted, range_start: data.start, range_end: data.end, actor_user_id: context.userId, actor_mfn_id: prof?.mfn_id ?? null }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    }
    const { data: flag } = await context.supabase.from('platform_launch_flags').select('enabled').eq('key', 'driver_schedule_email').maybeSingle();
    return { id, result: 'preview_only_sent_0', sendingEnabled: !!flag?.enabled && false };
  });
/* ---------- Production send path (gated by OFF 'driver_schedule_email' launch flag) ---------- */
async function sendingEnabled(db: any) {
  const { data } = await db.from('platform_launch_flags').select('enabled').eq('key', 'driver_schedule_email').maybeSingle();
  return data?.enabled === true; // missing = off
}

export const getDriverEmailSendState = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ enabled: await sendingEnabled(context.supabase) }));

export const sendDriverScheduleBatch = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ batchId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    // Flag OFF: return before any provider call or write.
    if (!(await sendingEnabled(context.supabase))) return { status: 'disabled' as const, sent: 0, skipped: 0, failed: 0 };
    const db = context.supabase as any;
    const { data: ms } = await db.from('workspace_members').select('workspace_id, role, workspaces!inner(account_type, status)').eq('user_id', context.userId).is('removed_at', null).eq('is_contractor', false);
    const own = (ms ?? []).filter((m: any) => ['owner', 'admin'].includes(m.role) && m.workspaces.account_type === 'provider' && m.workspaces.status === 'active');
    if (own.length !== 1) throw new Error('This action is unavailable.');
    const ws = own[0].workspace_id as string;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const admin = supabaseAdmin as any;
    const { data: batch } = await admin.from('driver_schedule_email_batches').select('id, workspace_id, driver_ids, range_start, range_end, status').eq('id', data.batchId).eq('workspace_id', ws).maybeSingle();
    if (!batch || batch.status !== 'prepared') throw new Error('This action is unavailable.');
    const { data: prof } = await admin.from('user_profiles').select('mfn_id').eq('user_id', context.userId).maybeSingle();
    const actor = { actor_user_id: context.userId, actor_mfn_id: prof?.mfn_id ?? null };
    const { data: drivers } = await admin.from('drivers').select('id, first_name, last_name, email, status').eq('workspace_id', ws).in('id', batch.driver_ids);
    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email');
    let sent = 0, skipped = 0, failed = 0;
    for (const id of batch.driver_ids as string[]) {
      const d = (drivers ?? []).find((x: any) => x.id === id);
      const key = `driver-schedule:${batch.id}:${id}`;
      const { data: prior } = await admin.from('driver_schedule_email_deliveries').select('status').eq('idempotency_key', key).maybeSingle();
      if (prior?.status === 'sent') { sent++; continue; }
      const record = (status: string, safe_reason: string | null, trip_count = 0) => admin.from('driver_schedule_email_deliveries').upsert({ batch_id: batch.id, workspace_id: ws, driver_id: id, idempotency_key: key, status, safe_reason, trip_count, ...actor, updated_at: new Date().toISOString() }, { onConflict: 'idempotency_key' });
      const email = String(d?.email ?? '').trim();
      if (!d || d.status !== 'active') { await record('skipped', 'driver_unavailable'); skipped++; continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await record('skipped', 'no_usable_email'); skipped++; continue; }
      const { data: trips } = await admin.from('trips').select('id, display_id, pickup_date, pickup_time, pickup_address, pickup_city, dropoff_address, dropoff_city')
        .eq('network_provider_workspace_id', ws).eq('driver_id', id).gte('pickup_date', batch.range_start).lte('pickup_date', batch.range_end).order('pickup_date').order('pickup_time');
      const list = (trips ?? []).map((t: any) => ({ reference: String(t.display_id ?? t.id.slice(0, 8).toUpperCase()), date: t.pickup_date, time: t.pickup_time, pickup: [t.pickup_address, t.pickup_city].filter(Boolean).join(', '), destination: [t.dropoff_address, t.dropoff_city].filter(Boolean).join(', ') }));
      await record('prepared', null, list.length);
      try {
        const r = await sendTemplateEmail('driver-schedule', email, { idempotencyKey: key, templateData: { driverName: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(), periodLabel: batch.range_start === batch.range_end ? batch.range_start : `${batch.range_start} – ${batch.range_end}`, trips: list } });
        if (r.sent) { await record('sent', null, list.length); sent++; } else { await record('skipped', 'recipient_suppressed', list.length); skipped++; }
      } catch (e: any) { await record('failed', String(e?.code ?? 'send_failed').slice(0, 40), list.length); failed++; }
    }
    await admin.from('driver_schedule_email_batches').update({ status: failed && !sent ? 'failed' : 'sent', sent_count: sent }).eq('id', batch.id);
    return { status: 'done' as const, sent, skipped, failed };
  });
