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

// ─────────────────────── Packet audit history ───────────────────────

export const listPacketEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { packet_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("medicaid_packet_events").select("*")
      .eq("packet_id", data.packet_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

// ─────────────────────── Provider Medicaid Profile ───────────────────────

export const getMyMedicaidProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("member_profiles")
      .select("medicaid_number, npi, medicaid_cert_expires_at, medicaid_cert_doc_path, medicaid_verified, medicaid_verified_at, allow_live_medicaid_verification, medicaid_plan")
      .eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    return data;
  });

export const saveMyMedicaidProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    medicaid_number?: string | null;
    npi?: string | null;
    allow_live_medicaid_verification?: boolean;
    medicaid_plan?: string | null;
  }) => {
    if (input.medicaid_number && !/^[A-Za-z0-9-]{4,32}$/.test(input.medicaid_number)) {
      throw new Error("Medicaid Provider Number must be 4–32 letters, numbers, or dashes.");
    }
    if (input.npi && !/^\d{10}$/.test(input.npi)) {
      throw new Error("NPI must be exactly 10 digits.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const patch: any = {};
    if (data.medicaid_number !== undefined) patch.medicaid_number = data.medicaid_number || null;
    if (data.npi !== undefined) patch.npi = data.npi || null;
    if (data.allow_live_medicaid_verification !== undefined) patch.allow_live_medicaid_verification = !!data.allow_live_medicaid_verification;
    if (data.medicaid_plan !== undefined) patch.medicaid_plan = data.medicaid_plan || null;

    // Medicaid does not issue a tracked certification document. Verified
    // simply means the provider has supplied a Medicaid Provider Number
    // and NPI so we can match them to state records.
    const nowIso = new Date().toISOString();
    const hasNum = (patch.medicaid_number ?? undefined) || undefined;
    const hasNpi = (patch.npi ?? undefined) || undefined;
    if (hasNum && hasNpi) {
      patch.medicaid_verified = true;
      patch.medicaid_verified_at = nowIso;
    } else {
      patch.medicaid_verified = false;
      patch.medicaid_verified_at = null;
    }
    // Clear any legacy cert fields so old uploads/expirations don't linger.
    patch.medicaid_cert_doc_path = null;
    patch.medicaid_cert_expires_at = null;

    const { error } = await context.supabase
      .from("member_profiles").update(patch).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true, verified: !!patch.medicaid_verified };
  });

// ─────────────────────── Eligibility lookup ───────────────────────

export const checkMedicaidEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    medicaid_number: string;
    patient_last_name?: string;
    patient_dob?: string;
  }) => {
    if (!input.medicaid_number || !/^[A-Za-z0-9-]{4,32}$/.test(input.medicaid_number)) {
      throw new Error("Enter a valid Medicaid number (4–32 letters, numbers, or dashes).");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    // Check provider has opted in and is verified
    const { data: prof } = await context.supabase
      .from("member_profiles")
      .select("allow_live_medicaid_verification, medicaid_verified")
      .eq("user_id", context.userId).maybeSingle();

    let result_status = "pending_activation";
    let result_plan: string | null = null;
    let details: Record<string, any> = {
      note: "Live AHCA / Sunshine Health eligibility integration pending activation for this account.",
    };

    if (prof?.allow_live_medicaid_verification && prof?.medicaid_verified) {
      // Placeholder for the real integration (AHCA / Sunshine Health / Availity, etc.)
      result_status = "unknown";
      details.note = "Live eligibility endpoint is enabled but no external integration is wired yet — record logged for audit.";
    }

    const { data: row, error } = await context.supabase
      .from("medicaid_eligibility_checks")
      .insert({
        provider_user_id: context.userId,
        medicaid_number: data.medicaid_number,
        patient_last_name: data.patient_last_name ?? null,
        patient_dob: data.patient_dob ?? null,
        result_status,
        result_plan,
        result_details: details,
      })
      .select("id, result_status, result_plan, result_details, created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const listMyEligibilityChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("medicaid_eligibility_checks").select("*")
      .eq("provider_user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  });
