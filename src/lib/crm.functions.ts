import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contactInput } from './contact-rules';
export { CONTACT_TYPES, type ContactType } from './contact-types';

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

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => contactInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.payer_id) {
      const { data: p } = await supabase.from("payers").select("id").eq("id", data.payer_id).eq('active',true).maybeSingle();
      if (!p) throw new Error("Linked payer not found");
    }
    const {id,...values}=data;
    const row = { ...values, ...(id ? {} : {owner_id:userId}) };
    if (!id) {
      const {data:existing}=await supabase.from('provider_contacts').select('id').eq('created_by',userId).eq('contact_type',data.contact_type).eq('first_name',data.first_name).eq('last_name',data.last_name).eq('company_name',data.company_name).eq('phone',data.phone).eq('email',data.email).eq('active',true).limit(1).maybeSingle();
      if(existing)return existing;
    }
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
      .from("provider_contacts").update({active:false}).eq("id", data.id).select('id').single();
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
