import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getPortalSummary, getCustomerOverview } from "@/lib/portal-requests.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { ACCOUNT_TYPE_LABEL, RequestTable, fmtDateTime } from "@/components/portal/request-display";
import { ProviderOverview } from "@/components/portal/ProviderOverview";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Portal Overview — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => getPortalSummary(),
  component: PortalHome,
});

function PortalHome() {
  const s = Route.useLoaderData();
  const { access, user } = Route.useRouteContext();
  const ws = access.primary;
  const provider = access.portalKind === "provider";
  return (
    <>
      <PageHead title={ws?.name || "Your account"} action={!provider && <Link to="/portal/requests/new" className={actionCls}>New trip</Link>}>
        {ws ? <>{ACCOUNT_TYPE_LABEL[ws.type] ?? ws.type} account{ws.status === "pending" ? " · Pending review" : ""}</> : "MY FLORIDA NEMT account"}
      </PageHead>
      {provider && ws?.status === "pending" && (
        <p role="status" className="ds-body mb-5 rounded-ds bg-ds-warning-soft px-4 py-3">Your provider account is pending verification. Trips can be offered to you once verification is complete.</p>
      )}
      {provider ? (
        <ProviderOverview workspaceId={ws?.status === "active" ? ws.id : null} userId={user.id} />
      ) : (
        <CustomerOverview />
      )}
    </>
  );
}

function CustomerOverview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCustomerOverview>> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let on = true;
    getCustomerOverview()
      .then((d) => { if (on) setData(d); })
      .catch(() => { if (on) setFailed(true); });
    return () => { on = false; };
  }, []);

  if (failed) {
    return <p role="alert" className="ds-body rounded-ds bg-ds-error-soft px-4 py-3 text-ds-error">Your overview could not be loaded. Please refresh the page.</p>;
  }
  if (!data) return <p className="ds-body text-ds-text-2">Loading your overview…</p>;

  const { counts, recent, notifications } = data;
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3">
        {([["Sent", counts.sent], ["Accepted", counts.accepted], ["Declined", counts.declined]] as const).map(([label, n]) => (
          <div key={label} className="rounded-ds border border-ds-border bg-ds-surface px-4 py-4 text-center shadow-[var(--ds-shadow)]">
            <dd className="text-2xl font-extrabold text-ds-primary">{n}</dd>
            <dt className="ds-support mt-1 uppercase">{label}</dt>
          </div>
        ))}
      </dl>

      <section className={panelCls} aria-labelledby="recent-h">
        <div className="flex items-center justify-between gap-3 border-b border-ds-border px-4 py-3 sm:px-5">
          <h2 id="recent-h" className="ds-subheading uppercase text-ds-primary">Recent requests</h2>
          {recent.length > 0 && <Link to="/portal/requests" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">View all</Link>}
        </div>
        {recent.length === 0 ? (
          <DsEmpty title="No requests yet" action={<Link to="/portal/requests/new" className={actionCls}>New trip</Link>}>
            Requests you submit, or that your account is authorized to view, will appear here.
          </DsEmpty>
        ) : (
          <RequestTable rows={recent} detailBase="/portal/requests" />
        )}
      </section>

      <section className={panelCls} aria-labelledby="notes-h">
        <div className="flex items-center justify-between gap-3 border-b border-ds-border px-4 py-3 sm:px-5">
          <h2 id="notes-h" className="ds-subheading uppercase text-ds-primary">Recent notifications</h2>
          <Link to="/portal/notifications" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">View all</Link>
        </div>
        {notifications.length === 0 ? (
          <p className="ds-body px-4 py-5 text-ds-text-2 sm:px-5">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-ds-border">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ds-error" aria-label="Unread" />}
                <div className="min-w-0">
                  <p className="ds-body font-semibold">{n.title}</p>
                  {n.body && <p className="ds-support mt-0.5">{n.body}</p>}
                  <p className="ds-caption mt-0.5">{fmtDateTime(n.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
