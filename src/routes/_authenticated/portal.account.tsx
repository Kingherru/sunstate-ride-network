import { createFileRoute } from "@tanstack/react-router";
import { getPortalSummary } from "@/lib/portal-requests.functions";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";

const ROLE: Record<string, string> = { owner: "Owner", admin: "Workspace admin", member: "Member" };

export const Route = createFileRoute("/_authenticated/portal/account")({
  head: () => ({ meta: [{ title: "Account — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => getPortalSummary(),
  component: Account,
});

function Account() {
  const s = Route.useLoaderData();
  const { access } = Route.useRouteContext();
  const ws = s.workspace;
  const rows: [string, string][] = [
    ["Email", s.email ?? "—"],
    ["Account", ws?.name || "—"],
    ["Account type", ws ? ACCOUNT_TYPE_LABEL[ws.type] ?? ws.type : access.isAdmin ? "MFN Admin" : "—"],
    ["Account status", ws ? (ws.status === "active" ? "Active" : ws.status === "pending" ? "Pending review" : "Suspended") : "—"],
    ["Your access", ws ? ROLE[ws.role] ?? "Member" : "—"],
  ];
  return (
    <>
      <PageHead title="Account" />
      <section className={`${panelCls} p-5 sm:p-6`}>
        <dl className="divide-y divide-ds-border">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="ds-support font-semibold uppercase tracking-[0.06em]">{k}</dt>
              <dd className="ds-body break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="ds-support mt-4">To change your password, sign out and use “Forgot password” on the sign-in page.</p>
      </section>
    </>
  );
}
