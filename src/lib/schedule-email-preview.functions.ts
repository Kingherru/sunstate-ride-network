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