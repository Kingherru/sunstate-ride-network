import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

/**
 * Only facilities and providers can manage payers; patients pay for themselves.
 * Authorization is resolved server-side via the `is_facility_or_provider` SECURITY DEFINER
 * function (backed by provider_applications, member_profiles.auto_upgraded_to_facility_at,
 * and user_roles). Never trust `user_metadata.portal` — signed-in users can edit it via the
 * Supabase client and self-escalate their portal role.
 */
async function requireFacilityOrProvider(context: any) {
  const { data, error } = await context.supabase.rpc("is_facility_or_provider", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("Only facilities and providers can manage payers.");
  }
}

async function ensurePayerCustomer(env: StripeEnv, payerId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await (supabaseAdmin as any)
    .from("payer_stripe_customers")
    .select("stripe_customer_id")
    .eq("payer_id", payerId)
    .eq("environment", env)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const { data: payer } = await (supabaseAdmin as any)
    .from("payers")
    .select("name, email, owner_user_id")
    .eq("id", payerId)
    .maybeSingle();
  if (!payer) throw new Error("Payer not found");

  const stripe = createStripeClient(env);
  const created = await stripe.customers.create({
    ...(payer.email && { email: payer.email }),
    name: payer.name ?? undefined,
    metadata: { payerId, ownerUserId: payer.owner_user_id },
  });
  await (supabaseAdmin as any).from("payer_stripe_customers").insert({
    payer_id: payerId,
    environment: env,
    stripe_customer_id: created.id,
  });
  return created.id;
}

/* ---------- CRUD ---------- */

const PAYER_TYPES = ["broker", "private_patient", "insurance"] as const;
const VEHICLE_PREFS = ["car", "suv", "van", "wheelchair_van", "stretcher_van", "provider_choice"] as const;

const payerFields = {
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  billing_address: z.string().trim().max(400).optional().or(z.literal("")),
  ein: z.string().trim().max(20).optional().or(z.literal("")),
  payer_type: z.enum(PAYER_TYPES).nullish(),
  active: z.boolean().optional(),
  linked_contact_id: z.string().uuid().nullish(),
  multi_load_ok: z.boolean().optional(),
  preferred_driver: z.string().trim().max(120).optional().or(z.literal("")),
  vehicle_preference: z.enum(VEHICLE_PREFS).nullish(),
  pickup_signature_required: z.boolean().optional(),
  dropoff_signature_required: z.boolean().optional(),
  early_late_preference: z.enum(["early", "late"]).nullish(),
  early_late_minutes: z.number().int().min(0).max(240).nullish(),
};

function payerRow(data: z.infer<z.ZodObject<typeof payerFields>>, ownerUserId?: string) {
  const row = {
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    notes: data.notes || null,
    billing_address: data.billing_address || null,
    ein: data.ein || null,
    payer_type: data.payer_type ?? null,
    active: data.active ?? true,
    linked_contact_id: data.linked_contact_id ?? null,
    multi_load_ok: data.multi_load_ok ?? false,
    preferred_driver: data.preferred_driver || null,
    vehicle_preference: data.vehicle_preference ?? null,
    pickup_signature_required: data.pickup_signature_required ?? false,
    dropoff_signature_required: data.dropoff_signature_required ?? false,
    early_late_preference: data.early_late_preference ?? null,
    early_late_minutes: data.early_late_minutes ?? null,
  };
  return ownerUserId ? { ...row, owner_user_id: ownerUserId } : row;
}

export const listMyPayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payers")
      .select("id, name, email, phone, notes, billing_address, ein, payer_type, active, linked_contact_id, multi_load_ok, preferred_driver, vehicle_preference, pickup_signature_required, dropoff_signature_required, early_late_preference, early_late_minutes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object(payerFields).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; id: string } | { error: string }> => {
    try {
      await requireFacilityOrProvider(context);
    } catch (e: any) {
      return { error: e.message };
    }
    if (data.linked_contact_id) {
      const { data: c } = await context.supabase.from("provider_contacts").select("id").eq("id", data.linked_contact_id).maybeSingle();
      if (!c) return { error: "Linked contact not found" };
    }
    const { data: row, error } = await context.supabase
      .from("payers")
      .insert(payerRow(data, context.userId))
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { ok: true, id: row.id as string };
  });

export const updatePayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), ...payerFields }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (data.linked_contact_id) {
      const { data: c } = await context.supabase.from("provider_contacts").select("id").eq("id", data.linked_contact_id).maybeSingle();
      if (!c) return { error: "Linked contact not found" };
    }
    const { error } = await context.supabase
      .from("payers")
      .update(payerRow(data, context.userId))
      .eq("id", data.id);
    if (error) return { error: error.message };
    return { ok: true };
  });

export const deletePayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase
      .from("payers")
      .delete()
      .eq("id", data.id);
    if (error) return { error: error.message };
    return { ok: true };
  });

/* ---------- Payment methods ---------- */

export const createPayerSetupIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      payer_id: z.string().uuid(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      // Verify owner
      const { data: payer } = await context.supabase
        .from("payers")
        .select("id")
        .eq("id", data.payer_id)
        .eq("owner_user_id", context.userId)
        .maybeSingle();
      if (!payer) return { error: "Payer not found" };

      const env = data.environment as StripeEnv;
      const customerId = await ensurePayerCustomer(env, data.payer_id);
      const stripe = createStripeClient(env);
      const si = await stripe.setupIntents.create({
        customer: customerId,
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: { payerId: data.payer_id, ownerUserId: context.userId },
      });
      return { clientSecret: si.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const recordPayerPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      payer_id: z.string().uuid(),
      environment: z.enum(["sandbox", "live"]),
      payment_method_id: z.string().min(3).max(200),
      make_default: z.boolean().optional(),
      label: z.string().trim().max(120).optional().or(z.literal("")),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      const { data: payer } = await context.supabase
        .from("payers")
        .select("id")
        .eq("id", data.payer_id)
        .eq("owner_user_id", context.userId)
        .maybeSingle();
      if (!payer) return { error: "Payer not found" };

      const env = data.environment as StripeEnv;
      const stripe = createStripeClient(env);
      const pm = await stripe.paymentMethods.retrieve(data.payment_method_id);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cust } = await (supabaseAdmin as any)
        .from("payer_stripe_customers")
        .select("stripe_customer_id")
        .eq("payer_id", data.payer_id)
        .eq("environment", env)
        .maybeSingle();
      if (!cust?.stripe_customer_id || pm.customer !== cust.stripe_customer_id) {
        return { error: "Card does not belong to this payer" };
      }

      const card = (pm as any).card;
      const ins = await (supabaseAdmin as any).from("payer_payment_methods").insert({
        payer_id: data.payer_id,
        environment: env,
        stripe_payment_method_id: pm.id,
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        exp_month: card?.exp_month ?? null,
        exp_year: card?.exp_year ?? null,
        is_default: !!data.make_default,
        label: data.label || null,
      });
      if (ins.error) return { error: ins.error.message };

      if (data.make_default) {
        await (supabaseAdmin as any)
          .from("payer_payment_methods")
          .update({ is_default: false })
          .eq("payer_id", data.payer_id)
          .eq("environment", env)
          .neq("stripe_payment_method_id", pm.id);
      }
      return { ok: true };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const listPayerCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ payer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("payer_payment_methods")
      .select("id, brand, last4, exp_month, exp_year, is_default, environment, label, created_at")
      .eq("payer_id", data.payer_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deletePayerCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { data: row } = await context.supabase
      .from("payer_payment_methods")
      .select("id, environment, stripe_payment_method_id, payer_id, payers!inner(owner_user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || (row as any).payers?.owner_user_id !== context.userId) {
      return { error: "Not found" };
    }
    try {
      const stripe = createStripeClient(row.environment as StripeEnv);
      await stripe.paymentMethods.detach(row.stripe_payment_method_id as string).catch(() => {});
    } catch {}
    const { error } = await context.supabase
      .from("payer_payment_methods")
      .delete()
      .eq("id", data.id);
    if (error) return { error: error.message };
    return { ok: true };
  });

/* ---------- Assignment ---------- */

export const setPatientDefaultPayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      patient_id: z.string().uuid(),
      payer_id: z.string().uuid().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (data.payer_id) {
      const { data: p } = await context.supabase
        .from("payers").select("id").eq("id", data.payer_id).eq("owner_user_id", context.userId).maybeSingle();
      if (!p) return { error: "Payer not found" };
    }
    const { error } = await context.supabase
      .from("saved_patients")
      .update({ default_payer_id: data.payer_id })
      .eq("id", data.patient_id)
      .eq("owner_id", context.userId);
    if (error) return { error: error.message };
    return { ok: true };
  });

export const setReservationPayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      reservation_id: z.string().uuid(),
      payer_id: z.string().uuid().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (data.payer_id) {
      const { data: p } = await context.supabase
        .from("payers").select("id").eq("id", data.payer_id).eq("owner_user_id", context.userId).maybeSingle();
      if (!p) return { error: "Payer not found" };
    }
    const { error } = await context.supabase
      .from("ride_requests")
      .update({ payer_id: data.payer_id })
      .eq("id", data.reservation_id)
      .eq("requester_user_id", context.userId);
    if (error) return { error: error.message };
    return { ok: true };
  });
