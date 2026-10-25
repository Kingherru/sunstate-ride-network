import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPortalSummary } from "@/lib/portal-requests.functions";
import { setOrganizationType } from "@/lib/portal-account.functions";
import { ORGANIZATION_TYPES, organizationLabel, type OrganizationType } from "@/lib/account-types";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { PersonalSecurity } from "@/components/portal/PersonalSecurity";
import { SegTabs } from "@/components/portal/SegTabs";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { BusinessInfoPanel } from "@/components/dashboard/BusinessInfoPanel";
import { PricingPanel } from "@/components/dashboard/PricingPanel";
import { RulesPanel } from "@/components/dashboard/RulesPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { ProviderBalancePanel } from "@/components/dashboard/ProviderBalancePanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { NetworkProfileForm } from "@/components/network/NetworkProfileForm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkspaceMembersForMessaging, setMemberMessagingPermission } from "@/lib/workspace-messages.functions";
import { BusinessPermissions } from '@/components/portal/BusinessPermissions';

const ROLE: Record<string, string> = { owner: "Owner", admin: "Workspace admin", member: "Member" };
type Tab = "profile" | "business" | "pricing" | "integrations" | "payouts" | "network" | "membership" | "security";

export const Route = createFileRoute("/_authenticated/portal/account")({
  head: () => ({ meta: [{ title: "Account — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => getPortalSummary(),
  component: Account,
});

function Account() {
  const s = Route.useLoaderData();
  const { access, user } = Route.useRouteContext();
  const provider = access.portalKind === "provider";
  const ws = access.primary;
  const canEditNetwork = provider && !!ws && (ws.role === "owner" || ws.role === "admin");
  const [tab, setTab] = useState<Tab>("profile");
  const tabs: { value: Tab; label: string }[] = provider && !access.restricted
    ? [{ value: "profile", label: "Profile" }, { value: "business", label: "Business information" }, { value: "pricing", label: "Pricing rules" },
       { value: "integrations", label: "Integrations" }, { value: "payouts", label: "Payouts" },
       ...(canEditNetwork ? [{ value: "network" as Tab, label: "Network profile" }] : []),
       { value: "membership", label: "Membership" }, { value: "security", label: "Security" }]
    : [{ value: "profile", label: "Profile" }, { value: "security", label: "Security" }];

  return (
    <>
      <PageHead title="Account" />
      <div className="mb-5"><SegTabs label="Account sections" value={tab} onChange={setTab} options={tabs} /></div>
      <section className={`${panelCls} p-5 sm:p-6`}>
        {tab === "profile" && <><Profile email={s.email} />{ws && (ws.role === 'owner' || ws.role === 'admin') && <BusinessPermissions workspaceId={ws.id} />}</>}
        {tab === "business" && <BusinessInfoPanel />}
        {tab === "pricing" && <div className="space-y-10"><PricingPanel /><RulesPanel /></div>}
        {tab === "integrations" && <IntegrationsPanel />}
        {tab === "payouts" && <div className="space-y-8"><ProviderBalancePanel /><PayoutsPanel userId={user.id} /></div>}
        {tab === "network" && canEditNetwork && ws && <NetworkProfileForm workspaceId={ws.id} />}
        {tab === "membership" && <><Membership />{ws && (ws.role === "owner" || ws.role === "admin") && <TeamMessaging workspaceId={ws.id} />}</>}
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
  const { user } = Route.useRouteContext();
  return <PersonalSecurity email={user.email ?? null} />;
}

function TeamMessaging({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkspaceMembersForMessaging);
  const setFn = useServerFn(setMemberMessagingPermission);
  const q = useQuery({
    queryKey: ["workspace-messaging-members", workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
  });

  async function toggle(userId: string, allowed: boolean) {
    try {
      await setFn({ data: { workspaceId, userId, allowed } });
      qc.invalidateQueries({ queryKey: ["workspace-messaging-members", workspaceId] });
      toast.success("Updated.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not update that member's permission.");
    }
  }

  const members = q.data ?? [];
  return (
    <div className="mt-8 max-w-2xl space-y-3">
      <h2 className="ds-subheading uppercase text-ds-primary">Team messaging</h2>
      <p className="ds-support">Owners and workspace admins can always message other businesses. Let other team members send network messages for this workspace, too.</p>
      {q.isLoading && <p className="ds-support">Loading…</p>}
      {!q.isLoading && members.length === 0 && <p className="ds-support">No team members yet.</p>}
      {members.length > 0 && (
        <ul className="divide-y divide-ds-border rounded-ds-sm border border-ds-border">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="ds-body truncate font-semibold">{m.name}</p>
                <p className="ds-support">{ROLE[m.role] ?? "Member"}</p>
              </div>
              {m.role === "owner" || m.role === "admin" ? (
                <span className="ds-support text-ds-on-bg/60">Always allowed</span>
              ) : (
                <label className="ds-support inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!m.canMessage} onChange={(e) => toggle(m.userId, e.target.checked)} /> Can message
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
