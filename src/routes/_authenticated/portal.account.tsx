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
import { ProviderPlatformRequests } from '@/components/messaging/PlatformRequests';
import { ProviderSettings } from '@/components/portal/ProviderSettings';
import { PersonalSettings } from '@/components/portal/PersonalSettings';
import { ProviderVerificationBadge } from '@/components/portal/ProviderVerificationBadge';
import { MembershipBilling } from '@/components/portal/MembershipBilling';
import { CustomerBilling } from '@/components/portal/CustomerBilling';
import { PatientManagement } from '@/components/portal/PatientManagement';
import { InterfaceSize } from '@/components/portal/InterfaceSize';
import { Link } from '@tanstack/react-router';
import { DsButton } from '@/components/ds/controls';
import { BusinessContactSettings } from '@/components/onboarding/BusinessContactSettings';

const ROLE: Record<string, string> = { owner: "Owner", admin: "Workspace admin", member: "Member" };
type Tab = "profile" | "business" | "pricing" | "integrations" | "payouts" | "network" | "membership" | "requests" | "security" | "patients" | "billing" | "notifications";

export const Route = createFileRoute("/_authenticated/portal/account")({
  head: () => ({ meta: [{ title: "Account — MY FLORIDA NEMT Portal" }, { name: 'description', content: 'Manage your account and authorized business permissions.' }, { property: 'og:title', content: 'Account — MY FLORIDA NEMT Portal' }, { property: 'og:description', content: 'Manage your account and authorized business permissions.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (search: Record<string, unknown>): { section?: string } => ({ section: typeof search.section === 'string' ? search.section : typeof search.tab === 'string' ? search.tab : undefined }),
  loader: () => getPortalSummary(),
  component: Account,
});

function Account() {
  const s = Route.useLoaderData();
  const search = Route.useSearch();
  const { access, user } = Route.useRouteContext();
  const provider = access.portalKind === "provider";
  const ws = access.primary;
  const canEditNetwork = provider && !!ws && (ws.role === "owner" || ws.role === "admin");
  const [tab, setTab] = useState<Tab>("profile");
  const setupLink = ws?.role === 'owner' && !ws.is_contractor ? <div className="mb-5 border-b border-ds-border pb-4"><Link to="/onboarding" className="ds-label text-ds-link underline">{access.onboardingPending ? 'Continue account setup' : 'Review account setup'}</Link><p className="ds-caption mt-1">Update missing information without changing your portal access.</p></div> : null;
  if (provider && !access.restricted && canEditNetwork && ws && !ws.is_contractor) return <><PageHead title="Settings" /><div className="p-5 sm:p-6">{setupLink}<ProviderSettings workspaceId={ws.id} role={ws.role} email={s.email} initialSection={search.section} accountDetails={<Profile email={s.email} />} teamMessaging={<TeamMessaging workspaceId={ws.id} />} financialTools={ws.role === 'owner' ? <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Earnings & payouts</h2><div className="portal-business-body space-y-8"><ProviderBalancePanel /><PayoutsPanel userId={user.id} /></div></section> : null} /></div></>;
  const tabs: { value: Tab; label: string }[] = provider && !access.restricted
    ? [{ value: "profile", label: "Profile" }, { value: "business", label: "Business information" },
       { value: "integrations", label: "Integrations" },
       ...(canEditNetwork ? [{ value: "network" as Tab, label: "Network profile" }] : []),
       { value: "membership", label: "Membership" }, { value: "requests", label: "Platform requests" }, { value: "security", label: "Security" }]
    : [{ value: "profile", label: "Profile" }, { value: "security", label: "Security" },
       ...(!provider && ws && !access.restricted ? [{ value: "patients" as Tab, label: "Patients" }] : []),
       ...(!provider && ws ? [{ value: "billing" as Tab, label: "Billing" }] : []),
       { value: "notifications", label: "Notifications" }];

  return (
    <>
      <PageHead title="Account" />
      {setupLink}
      <div className="mb-5"><SegTabs label="Account sections" value={tab} onChange={setTab} options={tabs} /></div>
      <section className={`${panelCls} p-5 sm:p-6`}>
        {tab === "profile" && <><PersonalSettings />{!provider && ws?.type !== 'private_pay' && ws?.role === 'owner' && <div className="my-6"><BusinessContactSettings /></div>}<div className="my-6"><InterfaceSize /></div><Profile email={s.email} />{ws && (ws.role === 'owner' || ws.role === 'admin') && <BusinessPermissions workspaceId={ws.id} />}</>}
        {tab === "business" && <BusinessInfoPanel />}
        {tab === "pricing" && <div className="space-y-10"><PricingPanel /><RulesPanel /></div>}
        {tab === "integrations" && <IntegrationsPanel />}
        {tab === "payouts" && <div className="space-y-8"><ProviderBalancePanel /><PayoutsPanel userId={user.id} /></div>}
        {tab === "network" && canEditNetwork && ws && <NetworkProfileForm workspaceId={ws.id} />}
        {tab === "membership" && <>{ws && <MembershipBilling workspaceId={ws.id} role={ws.role} />}{ws && (ws.role === "owner" || ws.role === "admin") && <TeamMessaging workspaceId={ws.id} />}</>}
        {tab === "requests" && ws && <ProviderPlatformRequests workspaceId={ws.id} />}
        {tab === "security" && <Security />}
        {tab === "patients" && <PatientManagement />}
        {tab === "billing" && <CustomerBilling />}
        {tab === "notifications" && <div className="space-y-4"><PersonalSettings /><Link to="/portal/notifications" className="ds-support font-semibold text-ds-link underline">Open notifications inbox</Link></div>}
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
    ...(ws?.type === 'provider' ? [["Provider verification", <ProviderVerificationBadge workspaceId={ws.id} />] as [string, React.ReactNode]] : []),
    ["Your access", ws ? ROLE[ws.role] ?? "Member" : "—"],
  ];
  return (
    <>
      <section className="portal-business-section portal-business-form mt-4">
      <h2 className="portal-business-heading ds-subheading uppercase">Account details</h2>
      <dl className="portal-business-body divide-y divide-ds-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid min-w-0 gap-1 py-3">
            <dt className="ds-label">{k}</dt>
            <dd className="ds-body min-w-0 break-words">{v}</dd>
          </div>
        ))}
        {ws && (
          <div className="grid gap-1 py-3">
            <dt className="ds-label"><label htmlFor="org-type">Account type</label></dt>
            <dd className="ds-body">
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-3">
                  <select id="org-type" value={org} onChange={(e) => setOrg(e.target.value)} className="portal-input max-w-sm">
                    {org === "needs_review" && <option value="needs_review">Choose a type…</option>}
                    {ORGANIZATION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <DsButton onClick={onSave} disabled={busy || org === "needs_review" || org === ws.organization_type}>Save type</DsButton>
                </div>
              ) : organizationLabel(ws.organization_type)}
              <p className="ds-support mt-2">This describes your business. It doesn't change what you can access.</p>
            </dd>
          </div>
        )}
      </dl>
      </section>
    </>
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
