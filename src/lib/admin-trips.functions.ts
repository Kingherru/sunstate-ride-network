import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireOps(context: any) {
  const roles = ["admin", "app_manager", "zone_manager", "dispatcher", "staff"];
  for (const r of roles) {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden");
}

export const listAllTripsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await requireOps(context);
    let q = context.supabase
      .from("trips")
      .select("id, display_id, status, pickup_date, pickup_time, pickup_city, pickup_zip, dropoff_city, dropoff_zip, patient_first_name, patient_last_name, transport_type, cost_total, created_by, assigned_to, created_at")
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const listAllReservationsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await requireOps(context);
    let q = context.supabase
      .from("ride_requests")
      .select("id, status, pickup_date, pickup_time, pickup_city, pickup_zip, dropoff_city, dropoff_zip, patient_first_name, patient_last_name, transport_type, requester_user_id, created_at")
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
