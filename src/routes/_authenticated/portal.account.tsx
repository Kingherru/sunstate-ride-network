import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPortalSummary } from "@/lib/portal-requests.functions";
import { setOrganizationType } from "@/lib/portal-account.functions";
import { ORGANIZATION_TYPES, organizationLabel, type OrganizationType } from "@/lib/account-types";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { SegTabs } from "@/components/portal/SegTabs";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { BusinessInfoPanel } from "@/components/dashboard/BusinessInfoPanel";
import { PricingPanel } from "@/components/dashboard/PricingPanel";
import { RulesPanel } from "@/components/dashboard/RulesPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { ProviderBalancePanel } from "@/components/dashboard/ProviderBalancePanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";

const ROLE: Record<string, string> = { owner: "Owner", admin: "Workspace admin", member: "Member" };
type Tab = "profile" | "business" | "pricing" | "integrations" | "payouts" | "membership" | "security";

export const Route = createFileRoute("/_authenticated/portal/account")({
  head: () => ({ meta: [{ title: "Account — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => getPortalSummary(),
  component: Account,
});

function Account() {
  const s = Route.useLoaderData();
  const { access, user } = Route.useRouteContext();
  const provider = access.portalKind === "provider";
  const [tab, setTab] = useState<Tab>("profile");
  const tabs: { value: Tab; label: string }[] = provider
    ? [{ value: "profile", label: "Profile" }, { value: "business", label: "Business information" }, { value: "pricing", label: "Pricing rules" },
       { value: "integrations", label: "Integrations" }, { value: "payouts", label: "Payouts" }, { value: "membership", label: "Membership" }, { value: "security", label: "Security" }]
    : [{ value: "profile", label: "Profile" }, { value: "security", label: "Security" }];

  return (
    <>
      <PageHead title="Account" />
      <div className="mb-5"><SegTabs label="Account sections" value={tab} onChange={setTab} options={tabs} /></div>
      <section className={`${panelCls} p-5 sm:p-6`}>
        {tab === "profile" && <Profile email={s.email} />}
        {tab === "business" && <BusinessInfoPanel />}
        {tab === "pricing" && <div className="space-y-10"><PricingPanel /><RulesPanel /></div>}
        {tab === "integrations" && <IntegrationsPanel />}
        {tab === "payouts" && <div className="space-y-8"><ProviderBalancePanel /><PayoutsPanel userId={user.id} /></div>}
        {tab === "membership" && <Membership />}
        {tab === "security" && <Security />}
      </section>
    </>
  );
}

function Profile({ email }: { email: string | null }) {
  const { access } = Route.useRouteContext();
  const ws = access.primary;
  const router = useRouter();
  const save = useServerFn(setOrganizationType);
  const canEdit = !!ws && (ws.role === "owner" || ws.role === "admin") && ws.type !== "provider";
  const [org, setOrg] = useState<string>(ws?.organization_type ?? "needs_review");
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (!ws || org === "needs_review") return;
    setBusy(true);
    try { await save({ data: { workspaceId: ws.id, type: org as OrganizationType } }); toast.success("Account type saved."); await router.invalidate(); }
    catch { toast.error("You can't change this account's type."); }
    finally { setBusy(false); }
  }

  const rows: [string, React.ReactNode][] = [
    ["Your MFN ID", <span className="font-mono">{access.mfnId ?? "—"}</span>],
    ["Email", email ?? "—"],
    ["Account", ws?.name || "—"],
    ["Account MFN ID", <span className="font-mono">{ws?.mfn_id ?? "—"}</span>],
    ["Account kind", ws ? ACCOUNT_TYPE_LABEL[ws.type] ?? ws.type : access.isAdmin ? "MFN Admin" : "—"],
    ["Account status", ws ? (ws.status === "active" ? "Active" : ws.status === "pending" ? "Pending review" : "Suspended") : "—"],
    ["Your access", ws ? ROLE[ws.role] ?? "Member" : "—"],
  ];
  return (
    <>
      <dl className="divide-y divide-ds-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="ds-support font-semibold uppercase tracking-[0.06em]">{k}</dt>
            <dd className="ds-body break-words">{v}</dd>
          </div>
        ))}
        {ws && (
          <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="ds-support font-semibold uppercase tracking-[0.06em]"><label htmlFor="org-type">Account type</label></dt>
            <dd className="ds-body">
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-3">
                  <select id="org-type" value={org} onChange={(e) => setOrg(e.target.value)} className="portal-input max-w-sm">
                    {org === "needs_review" && <option value="needs_review">Choose a type…</option>}
                    {ORGANIZATION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={onSave} disabled={busy || org === "needs_review" || org === ws.organization_type} className={actionCls}>Save type</button>
                </div>
              ) : organizationLabel(ws.organization_type)}
              <p className="ds-support mt-2">This describes your business. It doesn't change what you can access.</p>
            </dd>
          </div>
        )}
      </dl>
    </>
  );
}

function Membership() {
  return (
    <div className="ds-body max-w-2xl space-y-3">
      <h2 className="ds-subheading uppercase text-ds-primary">Provider membership</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>30 days free</li>
        <li>$10 per company per month after that</li>
        <li>2% MY FLORIDA NEMT platform fee on completed network trips</li>
        <li>Payment processing fees are shown separately where they apply</li>
      </ul>
      <p className="ds-support">Membership billing isn't changed from this page yet.</p>
    </div>
  );
}

function Security() {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(/weak|pwned|leaked/i.test(error.message) ? "Please choose a stronger password that hasn't appeared in a data breach." : "We couldn't update your password.");
    setPw(""); setPw2(""); toast.success("Password updated.");
  }
  return (
    <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
      <h2 className="ds-subheading uppercase text-ds-primary">Change password</h2>
      <div><label htmlFor="npw" className="portal-label">New password</label><input id="npw" type="password" autoComplete="new-password" className="portal-input" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div><label htmlFor="npw2" className="portal-label">Confirm new password</label><input id="npw2" type="password" autoComplete="new-password" className="portal-input" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      {err && <p role="alert" className="ds-support text-ds-error">{err}</p>}
      <button type="submit" disabled={busy} className={actionCls}>{busy ? "Updating…" : "Update password"}</button>
    </form>
  );
}
