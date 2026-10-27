import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { classifyAccount, sendPeoplePasswordReset, getNeedsReviewCounts } from "@/lib/admin-management.functions";
import { ORGANIZATION_TYPES } from "@/lib/account-types";
import { createFileRoute } from "@tanstack/react-router";
import { listPeopleAndAccounts, type PersonRow } from "@/lib/portal-account.functions";
import { organizationLabel } from "@/lib/account-types";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { SegTabs } from "@/components/portal/SegTabs";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";
import { useQuery } from "@tanstack/react-query";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";
import { PersonDetails } from '@/components/admin/PersonDetails';
import { DsButton, DsField, DsInput, DsSelect } from '@/components/ds/controls';
import { matchesPeopleFilters } from '@/lib/people-filters';
import { ProviderBadgeControl } from '@/components/admin/ProviderBadgeControl';

type View = "all" | "providers" | "private_pay" | "organizations" | "learners" | "review";
const ORG_TYPES = new Set(["facility", "hospital"]);

export const Route = createFileRoute("/_authenticated/admin/people")({
  head: () => ({ meta: [{ title: "People & Accounts — MY FLORIDA NEMT Admin" }, { name: 'description', content: 'Scoped people, account details and login access management.' }, { property: 'og:title', content: 'People & Accounts — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Scoped people, account details and login access management.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => listPeopleAndAccounts(),
  component: People,
});

function matches(p: PersonRow, v: View) {
  const types = p.accounts.map((a) => a.type);
  switch (v) {
    case "providers": return types.includes("provider");
    case "private_pay": return types.includes("private_pay");
    case "organizations": return types.some((t) => ORG_TYPES.has(t));
    case "learners": return p.accounts.length === 0 && p.roles.length === 0 && !p.needsReview;
    case "review": return p.needsReview || p.accounts.some((a) => a.orgType === "needs_review" && a.type !== "provider");
    default: return true;
  }
}

const CLASS_OPTIONS = [
  { value: "private_pay_patient", label: "Private Pay / Patient" },
  { value: "provider", label: "Provider" } as const,
  ...ORGANIZATION_TYPES.filter((o) => o.value !== "private_pay_patient"),
  { value: "training_only", label: "Training-Only" },
];

function ResetControl({ p }: { p: PersonRow }) {
  const resetFn = useServerFn(sendPeoplePasswordReset);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (confirming) return (
    <div role="group" aria-label="Confirm password reset" className="mt-2 rounded-ds-sm bg-ds-surface-muted p-3">
      <p className="ds-support text-ds-on-surface">Send a password reset link to <span className="font-mono">{p.mfnId}</span>? You will never see their new password.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={busy} onClick={async () => { setBusy(true); try { await resetFn({ data: { userId: p.userId } }); toast.success("Reset link sent if the account has an email."); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setConfirming(false); } }} className="portal-btn-primary">Confirm</button>
        <button onClick={() => setConfirming(false)} className="portal-btn-secondary">Cancel</button>
      </div>
    </div>
  );
  return <button onClick={() => setConfirming(true)} className="portal-btn-secondary mt-2">Send password reset link</button>;
}

function ClassifyControl({ p }: { p: PersonRow }) {
  const router = useRouter();
  const classify = useServerFn(classifyAccount);
  const [type, setType] = useState("");
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [busy, setBusy] = useState(false);
  const id = `cls-${p.userId.slice(0, 8)}`;
  const label = CLASS_OPTIONS.find((o) => o.value === type)?.label;
  async function go() {
    setBusy(true);
    try { await classify({ data: { userId: p.userId, type } }); toast.success("Account classified."); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setStep("pick"); }
  }
  if (step === "confirm") return (
    <div role="group" aria-label="Confirm classification" className="mt-2 rounded-ds-sm bg-ds-surface-muted p-3">
      <p className="ds-support text-ds-on-surface">Classify <span className="font-mono">{p.mfnId}</span> as <strong>{label}</strong>? Their sign-in, MFN ID and records stay the same. This never grants provider verification or admin access.</p>
      <div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} onClick={go} className="portal-btn-primary">Confirm</button><button onClick={() => setStep("pick")} className="portal-btn-secondary">Cancel</button></div>
    </div>
  );
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div><label htmlFor={id} className="sr-only">Classification</label>
        <select id={id} value={type} onChange={(e) => setType(e.target.value)} className="portal-input py-1">
          <option value="">Leave as Needs Review</option>
          {CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select></div>
      <button disabled={!type} onClick={() => setStep("confirm")} className="portal-btn-secondary">Classify…</button>
    </div>
  );
}

function People() {
  const rows = Route.useLoaderData();
  const peopleLevel = useAdminLevel("people");
  const classifyLevel = useAdminLevel("classify");
  const canClassify = classifyLevel === "manage";
  const canManagePeople = peopleLevel === "manage";
  const peopleReadOnly = peopleLevel === "read";
  const reviewCountsFn = useServerFn(getNeedsReviewCounts);
  const reviewCounts = useQuery({ queryKey: ["needs-review-counts"], queryFn: () => reviewCountsFn() });
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PersonRow | null>(null);
  const [status, setStatus] = useState('all');
  const [activity, setActivity] = useState('all');
  const [accountType, setAccountType] = useState('all');
  const [accountStatus, setAccountStatus] = useState('all');
  const [verification, setVerification] = useState('all');
  const list = useMemo(() => rows.filter((p) => matches(p, view)).filter((p) => {
    const t = q.trim().toLowerCase();
    const recent = !!p.lastSignIn && Date.now() - Date.parse(p.lastSignIn) <= 30 * 86400000;
    return matchesPeopleFilters(p, accountType, accountStatus, verification) && (status === 'all' || (status === 'review' ? matches(p, 'review') : p.status === status)) && (activity === 'all' || (activity === 'recent' ? recent : activity === 'never' ? !p.lastSignIn : !recent)) && (!t || [p.mfnId, p.email, p.name, ...p.accounts.map((a) => `${a.name} ${a.mfnId} ${a.type} ${a.orgType}`)].some((x) => x?.toLowerCase().includes(t)));
  }), [rows, view, q, status, activity, accountType, accountStatus, verification]);
  const counts = (v: View) => rows.filter((p) => matches(p, v)).length;

  return (
    <>
      <PageHead title="People & Accounts">Everyone who can sign in, and the accounts they belong to. {peopleReadOnly && <ReadOnlyBadge />}</PageHead>
      <div className="mb-4"><SegTabs label="People views" value={view} onChange={setView} options={[
        { value: "all", label: `Users (${rows.length})` },
        { value: "providers", label: `Providers (${counts("providers")})` },
        { value: "private_pay", label: `Private pay (${counts("private_pay")})` },
        { value: "organizations", label: `Facilities & orgs (${counts("organizations")})` },
        { value: "learners", label: `Training only (${counts("learners")})` },
        { value: "review", label: `Needs review (${counts("review")})` },
      ]} /></div>
      {reviewCounts.data && (
        <p className="ds-support mb-4 text-ds-text-2">
          <span className="font-semibold">People needing review:</span> {reviewCounts.data.peopleNeedingReview}
          {"  ·  "}
          <span className="font-semibold">Accounts needing classification:</span> {reviewCounts.data.accountsNeedingClassification}
        </p>
      )}
      <div className="mb-5 grid gap-4 md:grid-cols-[2fr_1fr_1fr]"><DsField label="Search people and accounts">{p => <DsInput {...p} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, email, MFN ID, company or type" />}</DsField><DsField label="Status">{p => <DsSelect {...p} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Disabled</option><option value="review">Needs Review</option></DsSelect>}</DsField><DsField label="Account activity">{p => <DsSelect {...p} value={activity} onChange={e => setActivity(e.target.value)}><option value="all">All activity</option><option value="recent">Signed in within 30 days</option><option value="inactive">No sign-in within 30 days</option><option value="never">Never signed in</option></DsSelect>}</DsField></div>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <DsField label="Account type">{p => <DsSelect {...p} value={accountType} onChange={e => setAccountType(e.target.value)}><option value="all">All account types</option>{Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DsSelect>}</DsField>
        <DsField label="Account status">{p => <DsSelect {...p} value={accountStatus} onChange={e => setAccountStatus(e.target.value)}><option value="all">All account statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></DsSelect>}</DsField>
        <DsField label="Email verification">{p => <DsSelect {...p} value={verification} onChange={e => setVerification(e.target.value)}><option value="all">All verification statuses</option><option value="verified">Verified</option><option value="unverified">Not verified</option></DsSelect>}</DsField>
      </div>
      <section className={panelCls}>
        {list.length === 0 ? <DsEmpty title="No one here">Nobody matches this view.</DsEmpty> : (
          <ul className="divide-y divide-ds-border">
            {list.map((p) => (
              <li key={p.userId} className="grid gap-2 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-6">
                <div className="min-w-0">
                  <DsButton variant="ghost" className="!px-0 text-left" onClick={() => setSelected(p)}>{p.name || p.email || 'Account details'}</DsButton>
                  <p className="ds-body break-all font-semibold">{p.email ?? "No email"}</p>
                  {p.isMasterAdmin && <p className="ds-support font-semibold uppercase tracking-[0.08em] text-ds-action">Master Admin</p>}
                  <p className="ds-support font-mono">{p.mfnId}</p>
                </div>
                <div className="ds-support min-w-0">
                  <p>{p.roles.length ? p.roles.map((r) => r.replace("_", " ")).join(", ") : "No staff role"}</p>
                  <p>{p.emailVerified ? "Email verified" : "Email not verified"}{p.status === "suspended" ? " · Suspended" : ""}</p>
                  {p.needsReview && <p className="font-semibold text-ds-warning">Needs classification</p>}
                  {p.isTest && <p className="font-semibold">Test account</p>}
                  {p.needsReview && canClassify && view === "review" && <ClassifyControl p={p} />}
                  {canManagePeople && <ResetControl p={p} />}
                </div>
                <div className="ds-support min-w-0">
                  {p.accounts.length === 0 ? <p>No business account</p> : p.accounts.map((a) => (
                    <div key={a.id} className="break-words">
                      <span className="font-semibold text-ds-on-surface">{a.name || "Unnamed"}</span>{a.name !== (ACCOUNT_TYPE_LABEL[a.type] ?? a.type) && ` · ${ACCOUNT_TYPE_LABEL[a.type] ?? a.type}`}
                      {a.type !== "provider" && organizationLabel(a.orgType) !== (ACCOUNT_TYPE_LABEL[a.type] ?? a.type) && ` · ${organizationLabel(a.orgType)}`} · {a.status} · <span className="font-mono">{a.mfnId}</span>
                      {a.type === 'provider' && <ProviderBadgeControl workspaceId={a.id} protectedAccount={p.isMasterAdmin} />}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected && <PersonDetails person={selected} canManage={canManagePeople} onClose={() => setSelected(null)} />}
    </>
  );
}
