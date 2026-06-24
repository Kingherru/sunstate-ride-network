import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---- Drivers ---- */
export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drivers").select("*").order("last_name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    license_number?: string;
    license_expiry?: string | null;
    status?: "active" | "inactive" | "on_leave";
    notes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, owner_id: userId, status: data.status ?? "active" };
    const q = data.id
      ? supabase.from("drivers").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : supabase.from("drivers").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("drivers").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---- Vehicles ---- */
export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    plate?: string;
    vehicle_type?: "sedan" | "suv" | "van" | "wheelchair_van" | "stretcher_van" | "ambulance";
    capacity?: number;
    status?: "active" | "inactive" | "maintenance";
    notes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, owner_id: userId, vehicle_type: data.vehicle_type ?? "sedan", status: data.status ?? "active" };
    const q = data.id
      ? supabase.from("vehicles").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : supabase.from("vehicles").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vehicles").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---- Trip assignment ---- */
export const assignDriverVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; driver_id?: string | null; vehicle_id?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trips")
      .update({ driver_id: data.driver_id ?? null, vehicle_id: data.vehicle_id ?? null })
      .eq("id", data.trip_id);
    if (error) throw error;
    return { ok: true };
  });
