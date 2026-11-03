import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { StatusPill } from "@/components/ds/status";
import { getLaunchReadiness } from "@/lib/launch-readiness.functions";
import { CONNECT_ENDPOINT_URL, CONNECT_SECRET_NAME, CONNECT_WEBHOOK_EVENTS, type ReadinessGroup } from "@/lib/launch-readiness";

export const Route = createFileRoute("/_authenticated/admin/launch")({
  beforeLoad: ({ context }) => {
    if (!(context as { access?: { isMasterAdmin?: boolean } }).access?.isMasterAdmin) throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [
    { title: "Launch Readiness — MY FLORIDA NEMT" },
    { name: "description", content: "Master Admin view of what is ready, off, or waiting on owner action before launch." },
    { property: "og:title", content: "Launch Readiness — MY FLORIDA NEMT" },
    { property: "og:description", content: "Master Admin launch readiness checklist." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: LaunchReadiness,
});

function summary(groups: ReadinessGroup[]) {
  const all = groups.flatMap((g) => g.items);
  return { green: all.filter((i) => i.tone === "green").length, yellow: all.filter((i) => i.tone === "yellow").length, red: all.filter((i) => i.tone === "red").length };
}

function LaunchReadiness() {
  const q = useQuery({ queryKey: ["admin", "launch-readiness"], queryFn: () => getLaunchReadiness() });
  const s = q.data ? summary(q.data.groups) : null;
  return (
    <>
      <PageHead title="Launch Readiness">
        Read-only. Nothing on this page turns anything on. "Code ready", "Configured in Stripe" and "Launch enabled" are separate states.
      </PageHead>
      {q.isLoading && <p className="ds-support text-ds-text-2">Loading…</p>}
      {q.error && <p className="ds-support" role="alert"><StatusPill status="Could not load" tone="red" /> {(q.error as Error).message}</p>}
      {s && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="ds-glass rounded-ds-md p-4"><StatusPill status="Ready" tone="green" /><p className="ds-heading mt-2 text-ds-primary">{s.green}</p></div>
          <div className="ds-glass rounded-ds-md p-4"><StatusPill status="Off or owner action" tone="yellow" /><p className="ds-heading mt-2 text-ds-primary">{s.yellow}</p></div>
          <div className="ds-glass rounded-ds-md p-4"><StatusPill status="Missing or blocked" tone="red" /><p className="ds-heading mt-2 text-ds-primary">{s.red}</p></div>
        </div>
      )}
      {q.data?.groups.map((g) => (
        <section key={g.title} className={`${panelCls} mb-6`}>
          <h2 className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">{g.title}</h2>
          <ul className="divide-y divide-ds-border">
            {g.items.map((i) => (
              <li key={i.label} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
                <div className="min-w-0 max-w-2xl">
                  <p className="ds-body font-semibold text-ds-text">{i.label}</p>
                  {i.note && <p className="ds-support mt-0.5 break-words text-ds-text-2">{i.note}</p>}
                </div>
                <StatusPill status={i.status} tone={i.tone} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {q.data && !q.data.connectSecret && (
        <section className={`${panelCls} mb-6 px-4 py-4 sm:px-5`}>
          <h2 className="ds-subheading mb-3 uppercase text-ds-primary">Owner action — Stripe test mode</h2>
          <ol className="ds-body list-decimal space-y-2 pl-5 text-ds-text">
            <li>In the Stripe Dashboard, switch to <strong>Test mode</strong> and open Developers → Webhooks → Add endpoint.</li>
            <li>Choose <strong>Events on Connected accounts</strong>.</li>
            <li className="break-all">Endpoint URL: <code>{CONNECT_ENDPOINT_URL}</code></li>
            <li>Select events: {CONNECT_WEBHOOK_EVENTS.join(", ")}.</li>
            <li>Copy the endpoint's signing secret and save it in Project Settings → Secrets as <code>{CONNECT_SECRET_NAME}</code>. Never paste it in chat.</li>
          </ol>
          <p className="ds-support mt-3"><StatusPill status="Warning" tone="yellow" /> Do not create live-mode endpoints or secrets until separately approved.</p>
        </section>
      )}
    </>
  );
}
