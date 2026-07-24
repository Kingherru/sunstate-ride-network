import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type EnvInput = { environment: StripeEnv };

async function ensureCustomer(env: StripeEnv, userId: string, email?: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .eq("environment", env)
    .maybeSingle();
  if (row?.stripe_customer_id) return row.stripe_customer_id as string;

  const stripe = createStripeClient(env);
  const created = await stripe.customers.create({
    ...(email && { email }),
    metadata: { userId },
  });
  await supabaseAdmin.from("stripe_customers").insert({
    user_id: userId,
    environment: env,
    stripe_customer_id: created.id,
  });
  return created.id;
}

/** Create a SetupIntent so the user can save a card via Stripe Elements. */
export const createSetupIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ environment: z.enum(["sandbox", "live"]) }).parse(i))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const email = (context.claims as any)?.email as string | undefined;
      const customerId = await ensureCustomer(data.environment as StripeEnv, context.userId, email);
      const stripe = createStripeClient(data.environment as StripeEnv);
      const si = await stripe.setupIntents.create({
        customer: customerId,
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: { userId: context.userId },
      });
      return { clientSecret: si.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Persist a freshly attached PaymentMethod into our DB after Stripe confirms it. */
export const recordSavedPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    environment: z.enum(["sandbox", "live"]),
    payment_method_id: z.string().min(3).max(200),
    make_default: z.boolean().optional(),
    patient_id: z.string().uuid().optional().nullable(),
    label: z.string().trim().max(120).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const pm = await stripe.paymentMethods.retrieve(data.payment_method_id);
      // Verify the PM belongs to this user's customer
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cust } = await supabaseAdmin
        .from("stripe_customers").select("stripe_customer_id")
        .eq("user_id", context.userId).eq("environment", data.environment).maybeSingle();
      if (!cust?.stripe_customer_id || pm.customer !== cust.stripe_customer_id) {
        return { error: "Payment method does not belong to this user" };
      }
      // If patient_id provided, validate it belongs to this user
      if (data.patient_id) {
        const { data: pat } = await supabaseAdmin
          .from("saved_patients").select("id")
          .eq("id", data.patient_id).eq("owner_id", context.userId).maybeSingle();
        if (!pat) return { error: "Patient not found for this account" };
      }
      const card = pm.card;
      const insert = await supabaseAdmin.from("saved_payment_methods").insert({
        user_id: context.userId,
        environment: data.environment,
        stripe_payment_method_id: pm.id,
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        exp_month: card?.exp_month ?? null,
        exp_year: card?.exp_year ?? null,
        is_default: !!data.make_default,
        patient_id: data.patient_id ?? null,
        label: data.label ?? null,
      });
      if (insert.error) return { error: insert.error.message };
      if (data.make_default) {
        await supabaseAdmin.from("saved_payment_methods")
          .update({ is_default: false })
          .eq("user_id", context.userId).eq("environment", data.environment)
          .neq("stripe_payment_method_id", pm.id);
      }
      return { ok: true };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const listSavedPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_payment_methods")
      .select("id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, environment, created_at, patient_id, label")
      .eq("user_id", context.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });


export const deleteSavedPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { data: row } = await context.supabase
      .from("saved_payment_methods")
      .select("stripe_payment_method_id, environment")
      .eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!row) return { error: "Not found" };
    try {
      const stripe = createStripeClient(row.environment as StripeEnv);
      await stripe.paymentMethods.detach(row.stripe_payment_method_id as string).catch(() => {});
    } catch {}
    const { error } = await context.supabase
      .from("saved_payment_methods").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) return { error: error.message };
    return { ok: true };
  });

export const setDefaultPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { data: row } = await context.supabase
      .from("saved_payment_methods").select("environment").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!row) return { error: "Not found" };
    const a = await context.supabase.from("saved_payment_methods")
      .update({ is_default: false })
      .eq("user_id", context.userId).eq("environment", row.environment);
    if (a.error) return { error: a.error.message };
    const b = await context.supabase.from("saved_payment_methods")
      .update({ is_default: true }).eq("id", data.id).eq("user_id", context.userId);
    if (b.error) return { error: b.error.message };
    return { ok: true };
  });

/** Charge a confirmed ride request using a saved card or a fresh one provided client-side. */
export const payForConfirmedTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    environment: z.enum(["sandbox", "live"]),
    ride_request_id: z.string().uuid(),
    payment_method_id: z.string().min(3).max(200).optional(),
  }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; payment_intent_id: string } | { error: string; requires_action?: { client_secret: string } }> => {
    const { data: req, error: reqErr } = await context.supabase
      .from("ride_requests")
      .select("id, requester_user_id, assigned_provider_id, estimated_cost_cents, status, payment_status, payer_id")
      .eq("id", data.ride_request_id).maybeSingle();
    if (reqErr || !req) return { error: "Trip not found" };
    if (req.requester_user_id !== context.userId) return { error: "Not your trip" };
    if (req.payment_status === "paid") return { error: "Already paid" };
    if (!req.estimated_cost_cents || req.estimated_cost_cents < 100) return { error: "Trip has no fare yet" };
    if (!["confirmed", "scheduled", "assigned", "completed"].includes((req.status ?? "").toLowerCase())) {
      return { error: "Trip is not confirmed yet" };
    }

    try {
      const env = data.environment as StripeEnv;
      const stripe = createStripeClient(env);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      let customerId: string | null = null;
      let pmId = data.payment_method_id;

      if (req.payer_id) {
        // Payer-scoped charge: customer + PM MUST belong to this payer.
        const { data: payerCust } = await supabaseAdmin
          .from("payer_stripe_customers").select("stripe_customer_id")
          .eq("payer_id", req.payer_id).eq("environment", env).maybeSingle();
        if (!payerCust?.stripe_customer_id) return { error: "Payer has no payment profile" };
        customerId = payerCust.stripe_customer_id as string;

        if (pmId) {
          const { data: match } = await supabaseAdmin
            .from("payer_payment_methods").select("stripe_payment_method_id")
            .eq("payer_id", req.payer_id).eq("environment", env)
            .eq("stripe_payment_method_id", pmId).maybeSingle();
          if (!match) return { error: "Selected card does not belong to this trip's payer" };
        } else {
          const { data: def } = await supabaseAdmin
            .from("payer_payment_methods").select("stripe_payment_method_id")
            .eq("payer_id", req.payer_id).eq("environment", env)
            .eq("is_default", true).maybeSingle();
          pmId = def?.stripe_payment_method_id as string | undefined;
        }
        if (!pmId) return { error: "This trip's payer has no card on file" };
      } else {
        // Self-pay: requester's own customer + saved cards only.
        const { data: cust } = await supabaseAdmin
          .from("stripe_customers").select("stripe_customer_id")
          .eq("user_id", context.userId).eq("environment", env).maybeSingle();
        if (!cust?.stripe_customer_id) return { error: "No payment profile" };
        customerId = cust.stripe_customer_id as string;

        if (pmId) {
          const { data: match } = await supabaseAdmin
            .from("saved_payment_methods").select("stripe_payment_method_id")
            .eq("user_id", context.userId).eq("environment", env)
            .eq("stripe_payment_method_id", pmId).maybeSingle();
          if (!match) return { error: "Selected card is not on your account" };
        } else {
          const { data: def } = await supabaseAdmin
            .from("saved_payment_methods").select("stripe_payment_method_id")
            .eq("user_id", context.userId).eq("environment", env).eq("is_default", true).maybeSingle();
          pmId = def?.stripe_payment_method_id as string | undefined;
        }
        if (!pmId) return { error: "Pick a card or save one first" };
      }

      const platformFee = Math.round(req.estimated_cost_cents * 0.04);
      const pi = await stripe.paymentIntents.create({
        amount: req.estimated_cost_cents,
        currency: "usd",
        customer: customerId,
        payment_method: pmId,
        confirm: true,
        off_session: false,
        metadata: {
          userId: context.userId,
          ride_request_id: req.id,
          payer_id: req.payer_id ?? "",
          platform_fee_cents: String(platformFee),
        },
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      });

      await supabaseAdmin.from("trip_payments").insert({
        ride_request_id: req.id,
        payer_user_id: context.userId,
        provider_user_id: req.assigned_provider_id,
        environment: env,
        stripe_payment_intent_id: pi.id,
        amount_cents: req.estimated_cost_cents,
        platform_fee_cents: platformFee,
        status: pi.status,
      });

      if (pi.status === "succeeded") {
        await supabaseAdmin.from("ride_requests").update({ payment_status: "paid" }).eq("id", req.id);
        try {
          const { data: rr } = await supabaseAdmin
            .from("ride_requests")
            .select("id, patient_first_name, patient_last_name, patient_email, pickup_address, pickup_city, dropoff_address, dropoff_city, pickup_date, pickup_time, return_date, return_pickup_time, assigned_provider_id, special_instructions")
            .eq("id", req.id)
            .maybeSingle();
          if (rr?.patient_email) {
            let providerName: string | undefined;
            if (rr.assigned_provider_id) {
              const { data: prov } = await supabaseAdmin
                .from("provider_applications")
                .select("business_name")
                .eq("user_id", rr.assigned_provider_id)
                .maybeSingle();
              providerName = prov?.business_name ?? undefined;
            }
            const { sendTripEmail } = await import("@/lib/trips/notify.server");
            await sendTripEmail({
              templateName: "trip-final-details",
              recipientEmail: rr.patient_email,
              idempotencyKey: `trip-final:${rr.id}`,
              templateData: {
                recipientName: [rr.patient_first_name, rr.patient_last_name].filter(Boolean).join(" ") || "there",
                tripShortId: String(rr.id).slice(0, 8),
                pickupAddress: [rr.pickup_address, rr.pickup_city].filter(Boolean).join(", "),
                dropoffAddress: [rr.dropoff_address, rr.dropoff_city].filter(Boolean).join(", "),
                pickupDate: rr.pickup_date ?? "",
                pickupTime: rr.pickup_time ?? "",
                returnDate: rr.return_date ?? undefined,
                returnTime: rr.return_pickup_time ?? undefined,
                providerName,
                specialInstructions: rr.special_instructions ?? undefined,
              },
            });
          }
        } catch (e) {
          console.error("trip-final-details send failed", e);
        }
        return { ok: true, payment_intent_id: pi.id };
      }
      if (pi.status === "requires_action" && pi.client_secret) {
        return { error: "Card requires authentication", requires_action: { client_secret: pi.client_secret } };
      }
      return { error: `Payment status: ${pi.status}` };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
