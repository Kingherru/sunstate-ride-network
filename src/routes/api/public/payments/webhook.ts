import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

async function handleSubscriptionCreated(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: productId,
      price_id: priceId,
      status: sub.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionUpdated(sub: any, env: StripeEnv) {
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
      .eq("environment", env)
    .maybeSingle();

  // If we never saw the `created` event, insert the row now so membership syncs.
  if (!existing) {
    await handleSubscriptionCreated(sub, env);
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .update({
      status: sub.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}


async function handleSubscriptionDeleted(sub: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}

async function handleTransferUpdated(tr: any) {
  if (!tr?.id) return;
  await getSupabase()
    .from("provider_payout_transfers")
    .update({ status: tr.reversed ? "failed" : "paid", updated_at: new Date().toISOString() })
    .eq("stripe_transfer_id", tr.id);
}
async function handleCheckoutSessionCompleted(sess: any, env: StripeEnv) {
  const meta = sess?.metadata ?? {};
  const userId = meta.userId;
  const sb = getSupabase();

  // Membership checkout: mark the member Paid immediately, even if the
  // customer.subscription.* events arrive late or out of order.
  if (userId && sess?.mode === "subscription" && sess?.payment_status === "paid") {
    const subId = typeof sess.subscription === "string" ? sess.subscription : sess.subscription?.id;
    if (subId) {
      await sb.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_subscription_id: subId,
          stripe_customer_id: typeof sess.customer === "string" ? sess.customer : sess.customer?.id,
          status: "active",
          price_id: meta.price_id ?? null,
          product_id: meta.product_id ?? null,
          environment: env,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );
    }
  }

  if (!userId || sess.mode !== 'payment' || sess.payment_status !== 'paid') return;
  let slugs: string[] = meta.course_slug ? [meta.course_slug] : [];
  if (meta.course_slugs) {
    const parsed: unknown = JSON.parse(meta.course_slugs);
    if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) slugs = parsed;
  }
  for (const slug of [...new Set(slugs)]) {
    const { data: course } = await sb.from('courses').select('id').eq('slug', slug).maybeSingle();
    if (!course) continue;
    const { error } = await sb.from('course_enrollments').upsert(
      { user_id: userId, course_id: course.id, stripe_session_id: sess.id, status: 'active' },
      { onConflict: 'user_id,course_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  }
}



export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case 'invoice.paid':
            case 'invoice.payment_failed': {
              const { reconcileMembershipInvoice } = await import('@/lib/membership-evidence.server');
              await reconcileMembershipInvoice(event.data.object, env);
              break;
            }
            case 'charge.refunded':
            case 'charge.dispute.created':
            case 'charge.dispute.closed': {
              const { reconcileMembershipCharge } = await import('@/lib/membership-evidence.server');
              await reconcileMembershipCharge(event.data.object, env);
              await (await import('@/lib/verification-evidence.server')).reconcileNetworkCharge(event.data.object, env);
              break;
            }
            case "customer.subscription.created":
              await handleSubscriptionCreated(event.data.object, env);
              await (await import('@/lib/membership-evidence.server')).reconcileLatestMembershipInvoice(event.data.object, env);
              break;
            case "customer.subscription.updated":
              await handleSubscriptionUpdated(event.data.object, env);
              await (await import('@/lib/membership-evidence.server')).reconcileLatestMembershipInvoice(event.data.object, env);
              break;
            case "customer.subscription.deleted":
              await handleSubscriptionDeleted(event.data.object, env);
              break;
            case "account.updated":
              await (await import('@/lib/verification-evidence.server')).reconcileConnectEvidence(event.data.object, env);
              break;
            case 'payment_intent.succeeded':
            case 'payment_intent.payment_failed':
            case 'payment_intent.canceled':
              await (await import('@/lib/verification-evidence.server')).reconcileNetworkIntent(event.data.object, env);
              break;
            case "transfer.created":
            case "transfer.updated":
            case "transfer.reversed":
              await handleTransferUpdated(event.data.object);
              break;
            case "checkout.session.completed":
              await handleCheckoutSessionCompleted(event.data.object, env);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
