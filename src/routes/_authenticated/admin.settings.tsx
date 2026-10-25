import { createFileRoute, Link } from "@tanstack/react-router";
import { Monitor, Users } from "lucide-react";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { PersonalSecurity } from "@/components/portal/PersonalSecurity";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin Settings — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSettings,
});

const PREVIEWS = [
  { to: "/portal", title: "Patient & Facility Portal", body: "The signed-in area every approved account sees: account home, request list, new-request form and account page. You view it as yourself — accounts with their own workspaces see only their own requests." },
  { to: "/portal/requests/new", title: "New Request Form (Portal)", body: "The same request form customers and facilities use inside the portal. Submitting here creates a real request — use the public Book a Trip page for look-only checks, or don't submit." },
  { to: "/portal/account", title: "Account Page", body: "The account details page each signed-in user sees: profile, workspace membership and contact information." },
  { to: "/learn", title: "Training / Learner Area", body: "What a training-only learner sees after sign-in: their enrolled courses, progress and certificates." },
  { to: "/book", title: "Public Booking Page", body: "The public Book a Trip page visitors use without signing in, including the Medical Delivery notice." },
  { to: "/join", title: "Provider Sign-Up Page", body: "The public page transportation providers use to apply to join the network." },
] as const;

function AdminSettings() {
  const { access } = Route.useRouteContext();
  return (
    <>
      <PageHead title="Settings">
        Your own profile, password and admin preview tools. Nothing here changes data unless you submit a form.
      </PageHead>

      {access.isMasterAdmin && (
        <section className={`${panelCls} mb-6`} aria-labelledby="portal-previews-h">
          <h2 id="portal-previews-h" className="ds-subheading flex items-center gap-2 border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">
            <Monitor className="size-4" aria-hidden />Portal previews
          </h2>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <p className="ds-support text-ds-text-2">
              View how the Provider and Patient & Facility portals look using real components and synthetic demo data. Nothing here submits a real form, sends a notification or changes your admin session.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin/preview/$kind" params={{ kind: "provider" }} className={actionCls}>
                <Users className="size-4" aria-hidden />View provider portal
              </Link>
              <Link to="/admin/preview/$kind" params={{ kind: "customer" }} className={actionCls}>
                <Users className="size-4" aria-hidden />View patient &amp; facility portal
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className={`${panelCls} mb-6`} aria-labelledby="preview-h">
        <h2 id="preview-h" className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">Other page previews</h2>
        <ul className="divide-y divide-ds-border">
          {PREVIEWS.map((p) => (
            <li key={p.to} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 max-w-2xl">
                <h3 className="ds-body font-semibold text-ds-text">{p.title}</h3>
                <p className="ds-support mt-1 text-ds-text-2">{p.body}</p>
              </div>
              <Link to={p.to as "/portal"} className={actionCls}>Open</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${panelCls} p-4 sm:p-6`} aria-labelledby="security-h">
        <h2 id="security-h" className="ds-subheading mb-4 uppercase text-ds-primary">Your profile &amp; security</h2>
        <PersonalSecurity />
      </section>
    </>
  );
}
