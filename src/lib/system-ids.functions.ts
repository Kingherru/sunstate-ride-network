import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Assign or fetch the caller's permanent display ID (PAT/FAC/STF/FLNP). */
export const ensureMyDisplayId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ensure_member_display_id");
    if (error) throw error;
    return { display_id: data as string | null };
  });

/** Global search by any system ID (TRP/PAT/FAC/STF/FLNP). Admin-only. */
export const globalSearchById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const q = data.id.trim().toUpperCase();
    if (!q) return { kind: null, record: null };

    if (q.startsWith("TRP-")) {
      const { data: t } = await context.supabase
        .from("trips").select("*").ilike("display_id", q).maybeSingle();
      return { kind: t ? "trip" : null, record: t };
    }
    if (q.startsWith("FLNP-")) {
      const { data: p } = await context.supabase
        .from("provider_applications").select("*").ilike("display_id", q).maybeSingle();
      if (p) return { kind: "provider", record: p };
      const { data: m } = await context.supabase
        .from("member_profiles").select("*").ilike("display_id", q).maybeSingle();
      return { kind: m ? "member" : null, record: m };
    }
    if (q.startsWith("PAT-") || q.startsWith("FAC-") || q.startsWith("STF-")) {
      const { data: m } = await context.supabase
        .from("member_profiles").select("*").ilike("display_id", q).maybeSingle();
      return { kind: m ? "member" : null, record: m };
    }
    return { kind: null, record: null };
  });

/** Admin: reassign a trip to any provider user_id. */
export const adminAssignTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; assigned_to: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const patch: any = { assigned_to: data.assigned_to };
    patch.status = data.assigned_to ? "assigned" : "open";
    const { error } = await context.supabase
      .from("trips").update(patch).eq("id", data.trip_id);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: cancel a trip. */
export const adminCancelTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("trips")
      .update({ status: "canceled", cancel_reason: data.reason ?? null })
      .eq("id", data.trip_id);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: list approved providers in a zone (via their preferred ZIPs or region). */
export const listProvidersForZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { zone_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    // ZIPs in this zone
    const { data: zips } = await context.supabase
      .from("dispatch_zone_zips").select("zip").eq("zone_id", data.zone_id);
    const zipList = (zips ?? []).map((z: any) => z.zip);

    // All approved providers; filter client-side by preferred_zip_codes overlap
    const { data: providers, error } = await context.supabase
      .from("member_profiles")
      .select("user_id, company_name, first_name, last_name, phone, preferred_zip_codes, region, display_id")
      .eq("membership_status", "active");
    if (error) throw error;

    const zset = new Set(zipList);
    const inZone = (providers ?? []).filter((p: any) =>
      (p.preferred_zip_codes ?? []).some((z: string) => zset.has(z))
    );
    return inZone.length > 0 ? inZone : (providers ?? []);
  });
