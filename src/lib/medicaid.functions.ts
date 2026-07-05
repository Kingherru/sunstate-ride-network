import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────── Medicaid Contacts ───────────────────────

export const listMedicaidContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope?: "mine" | "directory" } = {}) => input)
  .handler(async ({ data, context }) => {
    const scope = data.scope ?? "mine";
    let q = context.supabase.from("medicaid_contacts").select("*").order("contact_name");
    if (scope === "mine") q = q.eq("provider_user_id", context.userId);
    else q = q.eq("is_public", true);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const saveMedicaidContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    contact_name: string;
    organization?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    is_public?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    if (!data.contact_name?.trim()) throw new Error("Contact name is required");
    const payload = {
      provider_user_id: context.userId,
      contact_name: data.contact_name.trim(),
      organization: data.organization ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      is_public: !!data.is_public,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("medicaid_contacts").update(payload).eq("id", data.id).eq("provider_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("medicaid_contacts").insert(payload).select("id").single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const deleteMedicaidContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medicaid_contacts").delete().eq("id", data.id).eq("provider_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ─────────────────────── Provider Credentials ───────────────────────

export const listMyCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("provider_credentials").select("*")
      .eq("provider_user_id", context.userId)
      .order("expires_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  });

export const saveCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    kind: string;
    label: string;
    expires_at?: string | null;
    doc_path?: string | null;
    required?: boolean;
    notes?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    if (!data.kind?.trim() || !data.label?.trim()) throw new Error("Kind and label are required");
    const payload = {
      provider_user_id: context.userId,
      kind: data.kind.trim(),
      label: data.label.trim(),
      expires_at: data.expires_at || null,
      doc_path: data.doc_path ?? null,
      required: data.required ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("provider_credentials").update(payload).eq("id", data.id).eq("provider_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("provider_credentials").insert(payload).select("id").single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const deleteCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("provider_credentials").delete().eq("id", data.id).eq("provider_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Dispatch view of expiring/expired provider credentials (all providers). */
export const listExpiringCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_expiring_provider_credentials");
    if (error) throw error;
    return (data ?? []) as Array<{
      provider_user_id: string;
      provider_display_id: string | null;
      company_name: string | null;
      kind: string;
      label: string;
      expires_at: string | null;
      days_until_expiry: number | null;
    }>;
  });

/** Check my own credential status. */
export const myCredentialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("provider_has_valid_credentials", {
      _user_id: context.userId,
    });
    if (error) throw error;
    return { valid: !!data };
  });

// ─────────────────────── Medicaid Packets ───────────────────────

export const listPackets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medicaid_packets").select("*, medicaid_contacts(contact_name, organization)")
      .eq("provider_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getPacket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: pkt, error } = await context.supabase
      .from("medicaid_packets").select("*, medicaid_contacts(*)")
      .eq("id", data.id).eq("provider_user_id", context.userId).maybeSingle();
    if (error) throw error;
    if (!pkt) return null;
    const { data: items } = await context.supabase
      .from("medicaid_packet_items").select("*, trips(display_id, pickup_date, pickup_time, patient_first_name, patient_last_name, pickup_city, dropoff_city, status)")
      .eq("packet_id", data.id)
      .order("created_at", { ascending: true });
    return { ...pkt, items: items ?? [] };
  });

export const savePacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    title: string;
    status?: string;
    medicaid_contact_id?: string | null;
    submission_reference?: string | null;
    notes?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    if (!data.title?.trim()) throw new Error("Title is required");
    const patch: any = {
      title: data.title.trim(),
      status: data.status ?? "draft",
      medicaid_contact_id: data.medicaid_contact_id ?? null,
      submission_reference: data.submission_reference ?? null,
      notes: data.notes ?? null,
    };
    if (data.status === "submitted") patch.submitted_at = new Date().toISOString();
    if (data.status === "accepted" || data.status === "rejected") patch.decided_at = new Date().toISOString();

    if (data.id) {
      const { error } = await context.supabase
        .from("medicaid_packets").update(patch).eq("id", data.id).eq("provider_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("medicaid_packets").insert({ ...patch, provider_user_id: context.userId })
      .select("id").single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const deletePacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medicaid_packets").delete().eq("id", data.id).eq("provider_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const addPacketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    packet_id: string;
    kind: "trip" | "trip_log" | "document" | "note";
    trip_id?: string | null;
    doc_path?: string | null;
    label?: string | null;
    meta?: Record<string, any>;
  }) => input)
  .handler(async ({ data, context }) => {
    // ensure packet belongs to caller
    const { data: pkt } = await context.supabase
      .from("medicaid_packets").select("id")
      .eq("id", data.packet_id).eq("provider_user_id", context.userId).maybeSingle();
    if (!pkt) throw new Error("Packet not found");
    const { data: row, error } = await context.supabase
      .from("medicaid_packet_items").insert({
        packet_id: data.packet_id,
        kind: data.kind,
        trip_id: data.trip_id ?? null,
        doc_path: data.doc_path ?? null,
        label: data.label ?? null,
        meta: data.meta ?? {},
      }).select("id").single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const removePacketItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("medicaid_packet_items").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Pull provider's completed trips as candidates for a packet. */
export const listMyCompletedTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from?: string; to?: string } = {}) => input)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("trips")
      .select("id, display_id, pickup_date, pickup_time, patient_first_name, patient_last_name, pickup_city, dropoff_city, status, medicaid_number")
      .eq("assigned_to", context.userId)
      .in("status", ["completed", "accepted"])
      .order("pickup_date", { ascending: false })
      .limit(200);
    if (data.from) q = q.gte("pickup_date", data.from);
    if (data.to) q = q.lte("pickup_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
