import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
      .select("id, status, pickup_date, pickup_time, pickup_city, pickup_zip, dropoff_city, dropoff_zip, patient_first_name, patient_last_name, transport_type, requester_user_id, created_at, assigned_provider_id")
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getAdminReservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOps(context);
    const { data: row, error } = await context.supabase
      .from("ride_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Reservation not found");
    return row;
  });

export const suggestProvidersForReservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOps(context);
    const { data: r, error: rErr } = await context.supabase
      .from("ride_requests")
      .select("pickup_zip, pickup_city, transport_type")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!r) throw new Error("Reservation not found");

    // Match providers whose service ZIPs contain pickup_zip, or same city as fallback
    const { data: providers, error: pErr } = await context.supabase
      .from("member_profiles")
      .select("user_id, display_id, company_name, city, region, phone, preferred_zip_codes, membership_status")

      .eq("membership_status", "active")
      .limit(200);
    if (pErr) throw pErr;

    const zip = (r.pickup_zip ?? "").trim();
    const city = (r.pickup_city ?? "").trim().toLowerCase();
    const scored = (providers ?? []).map((p: any) => {
      const zips: string[] = Array.isArray(p.preferred_zip_codes) ? p.preferred_zip_codes : [];
      const zipMatch = zip && zips.includes(zip);
      const cityMatch = city && (p.city ?? "").toLowerCase() === city;
      const score = (zipMatch ? 2 : 0) + (cityMatch ? 1 : 0);
      return { ...p, score, reason: zipMatch ? "ZIP match" : cityMatch ? "City match" : "Active provider" };
    })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 25);

    return scored;
  });

export const pushReservationToProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reservation_id: z.string().uuid(), provider_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOps(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: r, error: rErr } = await (supabaseAdmin as any)
      .from("ride_requests")
      .select("id, pickup_date, pickup_time, pickup_city, patient_first_name, patient_last_name")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!r) throw new Error("Reservation not found");

    const { error: updErr } = await (supabaseAdmin as any)
      .from("ride_requests")
      .update({
        assigned_provider_id: data.provider_user_id,
        status: "assigned",
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", data.reservation_id);
    if (updErr) throw updErr;

    const title = "New trip offered to you";
    const body = `${r.patient_first_name ?? ""} ${r.patient_last_name ?? ""} — ${r.pickup_city ?? ""} on ${r.pickup_date} ${String(r.pickup_time ?? "").slice(0,5)}`.trim();
    await (supabaseAdmin as any).from("notifications").insert({
      user_id: data.provider_user_id,
      type: "trip_offer",
      title,
      body,
      link: `/requests/${data.reservation_id}`,
      ride_request_id: data.reservation_id,
    });

    return { ok: true };
  });
