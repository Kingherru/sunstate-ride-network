import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const patientSchema = z.object({
  kind: z.enum(["patient", "contact"]).optional().default("patient"),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  email: z.string().trim().max(255).email().optional().nullable().or(z.literal("")),
  medicaid_id: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  mobility: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  default_pickup_address: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  default_pickup_city: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  default_dropoff_address: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  default_dropoff_city: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  // CMS / Medicaid billing fields
  payer: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  medicaid_number: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  medicaid_plan: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  diagnosis_code: z.string().trim().max(60).optional().nullable().or(z.literal("")),
  authorization_number: z.string().trim().max(80).optional().nullable().or(z.literal("")),
  // Demographics
  gender: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  address_line1: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  address_line2: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  city: z.string().trim().max(120).optional().nullable().or(z.literal("")),
  state: z.string().trim().max(2).optional().nullable().or(z.literal("")),
  zip: z.string().trim().max(10).optional().nullable().or(z.literal("")),
  // Protected accessibility/operational profile fields (never logged or put in URLs).
  weight_lbs: z.number().int().min(1).max(1500).optional().nullable(),
  mobility_device: z.string().trim().max(80).optional().nullable().or(z.literal("")),
  wheelchair_type: z.string().trim().max(80).optional().nullable().or(z.literal("")),
  assistance_needs: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  oxygen_required: z.boolean().optional(),
  communication_needs: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  service_requirements: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  default_payer_id: z.string().uuid().optional().nullable(),
  workspace_id: z.string().uuid().optional().nullable(),
});

function clean(input: z.infer<typeof patientSchema>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) if (out[k] === "") out[k] = null;
  return out;
}

/** Workspaces where the caller may manage patient profiles (owner/admin, never contractors). */
async function managedWorkspaces(supabase: any, userId: string) {
  const { data } = await supabase.from("workspace_members").select("workspace_id,role,is_contractor,workspaces!inner(account_type,status)").eq("user_id", userId).is("removed_at", null);
  const rows = (data ?? []).filter((m: any) => !m.is_contractor && (m.role === "owner" || m.role === "admin") && m.workspaces.status === "active");
  return {
    ids: rows.filter((m: any) => m.workspaces.account_type !== "private_pay").map((m: any) => m.workspace_id as string),
    privateOnly: rows.length > 0 && rows.every((m: any) => m.workspaces.account_type === "private_pay"),
  };
}

async function checkPayer(supabase: any, userId: string, payerId: string | null | undefined) {
  if (!payerId) return;
  const { data } = await supabase.from("payers").select("id").eq("id", payerId).eq("owner_user_id", userId).maybeSingle();
  if (!data) throw new Error("Choose one of your payers.");
}

export const listSavedPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await managedWorkspaces(context.supabase, context.userId);
    let q = context.supabase.from("saved_patients").select("*");
    q = ws.ids.length ? q.or(`owner_id.eq.${context.userId},workspace_id.in.(${ws.ids.join(",")})`) : q.eq("owner_id", context.userId);
    const { data, error } = await q.order("last_name", { ascending: true }).order("first_name", { ascending: true });
    if (error) throw new Error("Could not load patient profiles.");
    return data ?? [];
  });

export const getPatientScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => managedWorkspaces(context.supabase, context.userId));

export const createSavedPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => patientSchema.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await managedWorkspaces(context.supabase, context.userId);
    if (data.workspace_id && !ws.ids.includes(data.workspace_id)) throw new Error("You can't add patients to that account.");
    if (ws.privateOnly && (data.kind ?? "patient") === "patient") {
      const { count } = await context.supabase.from("saved_patients").select("id", { count: "exact", head: true }).eq("owner_id", context.userId).eq("kind", "patient").eq("active", true);
      if ((count ?? 0) > 0) throw new Error("Private patient accounts keep one patient profile. Edit your existing profile instead.");
    }
    await checkPayer(context.supabase, context.userId, data.default_payer_id);
    const workspace_id = data.workspace_id ?? (ws.ids.length === 1 ? ws.ids[0] : null);
    const { data: out, error } = await context.supabase
      .from("saved_patients")
      .insert({ ...(clean(data) as any), workspace_id, owner_id: context.userId })
      .select().single();
    if (error) throw new Error("Could not save the patient profile.");
    return out;
  });

export const updateSavedPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).and(patientSchema).parse(i))
  .handler(async ({ data, context }) => {
    const { id, workspace_id: _ignored, ...rest } = data;
    await checkPayer(context.supabase, context.userId, rest.default_payer_id);
    const { data: out, error } = await context.supabase
      .from("saved_patients")
      .update(clean(rest as any) as any)
      .eq("id", id)
      .select().single();
    if (error) throw new Error("Could not update the patient profile.");
    return out;
  });

/** Soft deactivate/restore with required reason; history is appended by the database. */
export const setSavedPatientActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean(), reason: z.string().trim().min(3).max(300) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("saved_patients")
      .update({ active: data.active, deactivation_reason: data.reason }).eq("id", data.id).select("id").single();
    if (error) throw new Error("Could not change this patient profile.");
    return { ok: true };
  });

/** Kept for existing callers: now a soft deactivation, never a hard delete. */
export const deleteSavedPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("saved_patients")
      .update({ active: false, deactivation_reason: "Removed from saved list" }).eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("Could not remove this patient profile.");
    return { ok: true };
  });

export const listSavedPatientHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("saved_patient_events")
      .select("id,action,actor_mfn_id,reason,created_at").eq("patient_id", data.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("History unavailable.");
    return rows ?? [];
  });
