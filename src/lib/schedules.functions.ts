import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  dropoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  pickup_address: z.string().trim().min(1).max(255),
  dropoff_address: z.string().trim().min(1).max(255),
  round_trip: z.boolean().default(false),
  passenger_first_name: z.string().trim().min(1).max(80),
  passenger_last_name: z.string().trim().min(1).max(80),
  passenger_phone: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const listMySchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { week_start?: string }) => input)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("provider_schedule_entries")
      .select("*")
      .eq("owner_id", context.userId)
      .order("pickup_date")
      .order("pickup_time");
    if (data.week_start) q = q.eq("week_start", data.week_start);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId };
    const q = data.id
      ? context.supabase.from("provider_schedule_entries").update(row).eq("id", data.id).eq("owner_id", context.userId).select().single()
      : context.supabase.from("provider_schedule_entries").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("provider_schedule_entries")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* Admin: all schedules */
export const listAllSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { week_start?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    let q = context.supabase
      .from("provider_schedule_entries")
      .select("*")
      .order("pickup_date")
      .order("pickup_time");
    if (data.week_start) q = q.eq("week_start", data.week_start);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
