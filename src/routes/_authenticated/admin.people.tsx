import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listPeopleAndAccounts, type PersonRow } from "@/lib/portal-account.functions";
import { organizationLabel } from "@/lib/account-types";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { SegTabs } from "@/components/portal/SegTabs";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";

type View = "all" | "providers" | "private_pay" | "organizations" | "learners" | "review";
const ORG_TYPES = new Set(["facility", "hospital"]);

export const Route = createFileRoute("/_authenticated/admin/people")({
  head: () => ({ meta: [{ title: "People & Accounts — MY FLORIDA NEMT Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
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

function People() {
  const rows = Route.useLoaderData();
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => rows.filter((p) => matches(p, view)).filter((p) => {
    const t = q.trim().toLowerCase();
    return !t || [p.mfnId, p.email, p.name, ...p.accounts.map((a) => `${a.name} ${a.mfnId}`)].some((x) => x?.toLowerCase().includes(t));
  }), [rows, view, q]);
  const counts = (v: View) => rows.filter((p) => matches(p, v)).length;

  return (
    <>
      <PageHead title="People & Accounts">Everyone who can sign in, and the accounts they belong to.</PageHead>
      <div className="mb-4"><SegTabs label="People views" value={view} onChange={setView} options={[
        { value: "all", label: `Users (${rows.length})` },
        { value: "providers", label: `Providers (${counts("providers")})` },
        { value: "private_pay", label: `Private pay (${counts("private_pay")})` },
        { value: "organizations", label: `Facilities & orgs (${counts("organizations")})` },
        { value: "learners", label: `Training only (${counts("learners")})` },
        { value: "review", label: `Needs review (${counts("review")})` },
      ]} /></div>
      <label htmlFor="people-q" className="sr-only">Search people</label>
      <input id="people-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by MFN ID, email or account" className="portal-input mb-4 max-w-md" />
      <section className={panelCls}>
        {list.length === 0 ? <DsEmpty title="No one here">Nobody matches this view.</DsEmpty> : (
          <ul className="divide-y divide-ds-border">
            {list.map((p) => (
              <li key={p.userId} className="grid gap-2 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-6">
                <div className="min-w-0">
                  <p className="ds-body break-all font-semibold">{p.email ?? "No email"}</p>
                  {p.isMasterAdmin && <p className="ds-support font-semibold uppercase tracking-[0.08em] text-ds-action">Master Admin</p>}
                  <p className="ds-support font-mono">{p.mfnId}</p>
                </div>
                <div className="ds-support min-w-0">
                  <p>{p.roles.length ? p.roles.map((r) => r.replace("_", " ")).join(", ") : "No staff role"}</p>
                  <p>{p.emailVerified ? "Email verified" : "Email not verified"}{p.status === "suspended" ? " · Suspended" : ""}</p>
                  {p.needsReview && <p className="font-semibold text-ds-warning">Needs classification</p>}
                </div>
                <div className="ds-support min-w-0">
                  {p.accounts.length === 0 ? <p>No business account</p> : p.accounts.map((a) => (
                    <p key={a.id} className="break-words">
                      <span className="font-semibold text-ds-on-surface">{a.name || "Unnamed"}</span>{a.name !== (ACCOUNT_TYPE_LABEL[a.type] ?? a.type) && ` · ${ACCOUNT_TYPE_LABEL[a.type] ?? a.type}`}
                      {a.type !== "provider" && organizationLabel(a.orgType) !== (ACCOUNT_TYPE_LABEL[a.type] ?? a.type) && ` · ${organizationLabel(a.orgType)}`} · {a.status} · <span className="font-mono">{a.mfnId}</span>
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
