import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  opts: { email?: string; userId?: string },
): Promise<string> {
  if (opts.userId && !/^[a-zA-Z0-9_-]+$/.test(opts.userId)) throw new Error("Invalid userId");
  if (opts.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${opts.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (opts.email) {
    const existing = await stripe.customers.list({ email: opts.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (opts.userId && c.metadata?.userId !== opts.userId) {
        await stripe.customers.update(c.id, { metadata: { ...c.metadata, userId: opts.userId } });
      }
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(opts.email && { email: opts.email }),
    ...(opts.userId && { metadata: { userId: opts.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    customerEmail?: string;
    userId?: string;
    returnUrl: string;
    environment: StripeEnv;
    metadata?: Record<string, string>;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = (data.customerEmail || data.userId)
        ? await resolveOrCreateCustomer(stripe, { email: data.customerEmail, userId: data.userId })
        : undefined;

      const metadata: Record<string, string> = { ...(data.metadata ?? {}) };
      if (data.userId) metadata.userId = data.userId;

      let productDescription: string | undefined;
      if (!isRecurring) {
        const pid = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
        try {
          const product = await stripe.products.retrieve(pid);
          productDescription = product.name;
        } catch { /* ignore */ }
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(customerId && { customer: customerId }),
        ...(Object.keys(metadata).length && { metadata }),
        ...(isRecurring && data.userId && { subscription_data: { metadata: { userId: data.userId } } }),
        ...(!isRecurring && productDescription && { payment_intent_data: { description: productDescription } }),
        managed_payments: { enabled: true },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id) throw new Error("No subscription found");
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type CancelResult = { ok: true; effective_at: string | null } | { error: string };

const CANCEL_REASON_LABELS: Record<string, string> = {
  cost: "Too expensive",
  not_enough_trips: "Not receiving enough trips",
  no_longer_needed: "No longer need the service",
  technical_issues: "Technical issues",
  switching_services: "Switching to another service",
  other: "Other",
};

export const cancelMyMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    environment: StripeEnv;
    reason_code: keyof typeof CANCEL_REASON_LABELS | string;
    comment?: string;
  }) => {
    if (!data.reason_code || typeof data.reason_code !== "string") throw new Error("Reason is required");
    if (data.comment && data.comment.length > 1000) throw new Error("Comment is too long");
    return data;
  })
  .handler(async ({ data, context }): Promise<CancelResult> => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id, price_id, status")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_subscription_id) return { error: "No active membership found" };

    let effectiveAt: string | null = null;
    try {
      const stripe = createStripeClient(data.environment);
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: data.reason_code,
          cancellation_comment: data.comment?.slice(0, 500) ?? "",
        },
      });
      const cpe = (updated as any).current_period_end;
      if (typeof cpe === "number") effectiveAt = new Date(cpe * 1000).toISOString();
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }

    const reasonLabel = CANCEL_REASON_LABELS[data.reason_code] ?? data.reason_code;
    const { error: logErr } = await supabase.from("subscription_cancellation_reasons").insert({
      user_id: userId,
      stripe_subscription_id: sub.stripe_subscription_id,
      stripe_customer_id: sub.stripe_customer_id,
      environment: data.environment,
      reason_code: data.reason_code,
      reason_label: reasonLabel,
      comment: data.comment?.trim() || null,
      price_id: sub.price_id,
      plan_tier: "paid",
      effective_at: effectiveAt,
    });
    if (logErr) console.error("Failed to log cancellation reason", logErr);

    return { ok: true, effective_at: effectiveAt };
  });

