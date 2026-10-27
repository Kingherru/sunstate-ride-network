import { useMemo, useState } from "react";
import type { OnBehalfCandidate } from "@/lib/admin-on-behalf.functions";
import { RequestForm, OnBehalfContext } from "@/components/requests/RequestForm";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { DsEmpty } from "@/components/ds/feedback";

export function OnBehalfRequest({ rows }: { rows: OnBehalfCandidate[] }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<OnBehalfCandidate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || [r.name, r.personMfnId, r.accountMfnId, r.accountName].some((x) => x?.toLowerCase().includes(t))).slice(0, 50);
  }, [rows, q]);

  if (picked && confirmed) return (
    <>
      <PageHead title="Request for a customer">
        Submitting for <strong>{picked.accountName || picked.name}</strong> ({picked.accountMfnId}). You stay signed in as yourself; the request records you as the person who entered it.
      </PageHead>
      <button onClick={() => { setPicked(null); setConfirmed(false); }} className="portal-btn-secondary mb-4">Choose a different account</button>
      <OnBehalfContext.Provider value={{ targetUserId: picked.userId, workspaceId: picked.workspaceId }}>
        <RequestForm context="portal" />
      </OnBehalfContext.Provider>
    </>
  );

  return (
    <>
      <PageHead title="Request for a customer">Choose the customer or organization account this request is for. Only accounts in your scope are listed.</PageHead>
      {picked ? (
        <section className={`${panelCls} p-4 sm:p-6`} aria-labelledby="ob-confirm">
          <h2 id="ob-confirm" className="ds-subheading uppercase text-ds-primary">Confirm the account</h2>
          <dl className="ds-body mt-3 grid gap-1">
            <div><dt className="inline font-semibold">Account: </dt><dd className="inline">{picked.accountName || "Unnamed"}</dd></div>
            <div><dt className="inline font-semibold">Type: </dt><dd className="inline">{ACCOUNT_TYPE_LABEL[picked.accountType ?? ""] ?? picked.accountType}</dd></div>
            <div><dt className="inline font-semibold">Account MFN ID: </dt><dd className="inline font-mono">{picked.accountMfnId}</dd></div>
            <div><dt className="inline font-semibold">Person MFN ID: </dt><dd className="inline font-mono">{picked.personMfnId}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => setConfirmed(true)} className="portal-btn-primary">Open request form</button>
            <button onClick={() => setPicked(null)} className="portal-btn-secondary">Back</button>
          </div>
        </section>
      ) : (
        <>
          <label htmlFor="ob-q" className="portal-label">Search accounts</label>
          <input id="ob-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or MFN ID" className="portal-input mb-4 max-w-md" />
          <section className={panelCls}>
            {list.length === 0 ? <DsEmpty title="No accounts available">There are no customer accounts in your scope.</DsEmpty> : (
              <ul className="divide-y divide-ds-border">{list.map((r) => (
                <li key={`${r.userId}-${r.workspaceId}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0"><p className="ds-body break-words font-semibold">{r.accountName || r.name || "Unnamed"}{r.isTest && " (test)"}</p>
                    <p className="ds-support font-mono">{r.accountMfnId} · {r.personMfnId}</p></div>
                  <button onClick={() => setPicked(r)} className="portal-btn-secondary whitespace-nowrap">Select</button>
                </li>
              ))}</ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
