import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, connectWebhookSecretConfigured, verifyWebhook } from "@/lib/stripe.server";

/** Connected-account (Stripe Connect) events: account.updated, payout.paid, payout.failed.
 * Separate signing secret; workspaces resolve only through stored payout-account bindings; no bank data stored. */
export const Route = createFileRoute("/api/public/payments/connect-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        const env: StripeEnv = rawEnv;
        if (!connectWebhookSecretConfigured(env)) return new Response("Connected-account webhook is not configured", { status: 503 });
        try {
          const event = await verifyWebhook(request, env, "connect") as { id?: string; type: string; account?: string; livemode?:boolean; created?:number; data: { object: any } };
          if(env==='sandbox')return Response.json({received:true,...await (await import('@/lib/sandbox-reconciliation.server')).prepareSandboxReconciliation(event,'connect')});
          const np = await import("@/lib/network-payments.server");
          if (await np.alreadyProcessed(event.id)) return Response.json({ received: true, duplicate: true });
          switch (event.type) {
            case "account.updated":
              // Re-reads the account from Stripe, so out-of-order events always converge on current state.
              await (await import("@/lib/verification-evidence.server")).reconcileConnectEvidence(event.data.object, env);
              break;
            case "payout.paid":
            case "payout.failed":
              await np.reconcileSettlementPayout(event.data.object, event.type, event.account);
              break;
            default:
              console.log("Unhandled connect event type");
          }
          await np.markProcessed(event.id, event.type, env, "connect");
          return Response.json({ received: true });
        } catch {
          console.error("Connect webhook rejected");
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
