import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMaster } from "@/lib/admin-guard.server";
import { buildReadiness, LAUNCH_FLAG_KEYS, type ReadinessGroup } from "@/lib/launch-readiness";
import { CONTACT_INFO } from "@/lib/contact-info";

/** Master-Admin-only, read-only. Returns statuses/booleans only — never secret values. */
export const getLaunchReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ groups: ReadinessGroup[]; connectSecret: boolean }> => {
    await requireMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const keys = ["nemt_provider_base_monthly", "nemt_network_addon_monthly", "course_nemt_v2", "course_hipaa_v2"];
    const prices: Record<string, number | null> = Object.fromEntries(keys.map((k) => [k, null]));
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const res = await createStripeClient("sandbox").prices.list({ lookup_keys: keys, active: true, limit: 10 });
      for (const p of res.data) if (p.lookup_key && p.currency === "usd") prices[p.lookup_key] = p.unit_amount;
    } catch { /* shown as Missing */ }

    const [{ data: flagRows }, { data: tests }, { count: ledger, error: ledgerErr }, { count: accounts }] = await Promise.all([
      supabaseAdmin.from("platform_launch_flags").select("key, enabled"),
      supabaseAdmin.from("user_profiles").select("user_id").eq("is_test_account", true),
      supabaseAdmin.from("network_settlements").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("provider_payout_accounts").select("workspace_id", { count: "exact", head: true }),
    ]);
    const flags: Record<string, boolean> = Object.fromEntries(LAUNCH_FLAG_KEYS.map((f) => [f.key, false]));
    for (const r of flagRows ?? []) flags[r.key] = r.enabled === true;

    let disabled = 0;
    for (const t of tests ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(t.user_id);
      const until = (data?.user as { banned_until?: string } | undefined)?.banned_until;
      if (until && Date.parse(until) > Date.now()) disabled++;
    }

    const connectSecret = !!process.env.STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET;
    const groups = buildReadiness({
      prices,
      liveTokenPresent: false,
      mainSecret: !!process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET,
      connectSecret,
      flags,
      placeholderPhone: /555/.test(CONTACT_INFO.phone),
      testAccounts: { total: tests?.length ?? 0, disabled },
      settlementLedger: !ledgerErr,
      connectedAccounts: accounts ?? 0,
    });
    void ledger;
    return { groups, connectSecret };
  });
