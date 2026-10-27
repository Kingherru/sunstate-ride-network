import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("provider_contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const CONTACT_TYPES = ["personal", "facility", "business", "payer"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    contact_type: ContactType;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    phone?: string;
    email?: string;
    payer?: string;
    payer_id?: string | null;
    mobility_notes?: string;
    notes?: string;
    default_pickup_location_id?: string | null;
    default_dropoff_location_id?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.payer_id) {
      const { data: p } = await supabase.from("payers").select("id").eq("id", data.payer_id).eq("owner_user_id", userId).maybeSingle();
      if (!p) throw new Error("Linked payer not found");
    }
    const row = { ...data, owner_id: userId };
    const q = data.id
      ? supabase.from("provider_contacts").update(row).eq("id", data.id).select().single()
      : supabase.from("provider_contacts").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("provider_contacts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_locations").select("*").order("label");
    if (error) throw error;
    return data ?? [];
  });

export const upsertLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    contact_id?: string | null;
    label: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, owner_id: userId };
    const q = data.id
      ? supabase.from("saved_locations").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : supabase.from("saved_locations").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_locations").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
