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

    const keys = ["nemt_provider_base_monthly", "nemt_network_addon_monthly", "course_nemt_v2", "course_hipaa_v2", "contractor_monthly", "nemt_startup_guide_50"];
    const prices: Record<string, number | null> = Object.fromEntries(keys.map((k) => [k, null]));
    // Readiness never calls a processor; absent attested mapping is unknown, not ready.

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
      liveTokenPresent: !!process.env['PAYMENTS_LIVE_SECRET_KEY'],
      mainSecret: !!process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET,
      connectSecret,
      flags,
      placeholderPhone: /555/.test(CONTACT_INFO.phone),
      testAccounts: { total: tests?.length ?? 0, disabled },
      settlementLedger: !ledgerErr,
      connectedAccounts: accounts ?? 0,
    });
    groups.push({title:'Public launch prerequisites',items:[
      {label:'Domain and public URL',status:'Configured in site content — domain verification required',tone:'yellow',note:'Owner action: confirm myfloridanemt.com domain routing before launch.'},
      {label:'Public email',status:CONTACT_INFO.email?'Address configured — delivery unverified':'Missing',tone:CONTACT_INFO.email?'yellow':'red',note:'Owner action: verify sender-domain configuration and approved public inbox.'},
      {label:'Auth email confirmation / secure change',status:'Hosted settings not verified',tone:'yellow',note:'Owner action: confirm hosted email confirmation and secure email change settings; code alone does not prove configuration.'},
      {label:'Managed email delivery',status:'Intentionally Off — no send test performed',tone:'yellow',note:'Owner action: separately approve delivery and sender verification.'},
      {label:'Policy and terms links',status:'Ready — /policies and /policies#terms',tone:'green',note:'Retained consolidated policy text; purchase/refund approval remains a separate gate.'},
      {label:'Public booking workflow',status:'Request-review path present — live submission untested',tone:'yellow',note:'Owner action: authorize a controlled end-to-end booking test before launch.'},
      {label:'Portal route protection',status:'Authenticated layout and server checks present',tone:'green',note:'Permissions remain enforced by existing owner-scoped reads and writes.'},
      {label:'Indexing and sitemap',status:'Crawlable sources present — hosted crawl unverified',tone:'yellow',note:'Owner action: confirm sitemap availability and search-engine indexing after approved publication.'},
      {label:'Location child-page indexing',status:'Existing noindex rules retained',tone:'yellow',note:'No city-page indexing changes in this pass; review retained launch policy.'},
      {label:'Purchased digital-resource entitlement',status:'Prepared — verified purchase evidence required',tone:'yellow',note:'Private 60-second access requires server-attested completed non-refunded purchase. Legacy enrollments never prove payment; owner must approve payment evidence reconciliation.'},
      {label:'Family and reminder delivery',status:'Intentionally Off',tone:'yellow',note:'Consent and previews do not confirm recipient email. Owner action: approve verification and timezone-bound sending separately.'},
      {label:'Refund / dispute execution',status:'Intentionally Off — policy approval required',tone:'yellow',note:'Owner action: approve refund responsibility, fee treatment and tested webhook mapping before money actions.'},
    ]});
    void ledger;
    return { groups, connectSecret };
  });
