import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin Settings — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSettings,
});

const PREVIEWS = [
  {
    to: "/portal",
    title: "Customer Portal",
    body: "The signed-in area every approved account sees: account home, request list, new-request form and account page. You view it as yourself — accounts with their own workspaces see only their own requests.",
  },
  {
    to: "/portal/requests/new",
    title: "New Request Form (Portal)",
    body: "The same request form customers and facilities use inside the portal. Submitting here creates a real request — use the public Book a Trip page for look-only checks, or don't submit.",
  },
  {
    to: "/portal/account",
    title: "Account Page",
    body: "The account details page each signed-in user sees: profile, workspace membership and contact information.",
  },
  {
    to: "/learn",
    title: "Training / Learner Area",
    body: "What a training-only learner sees after sign-in: their enrolled courses, progress and certificates.",
  },
  {
    to: "/book",
    title: "Public Booking Page",
    body: "The public Book a Trip page visitors use without signing in, including the Medical Delivery notice.",
  },
  {
    to: "/join",
    title: "Provider Sign-Up Page",
    body: "The public page transportation providers use to apply to join the network.",
  },
] as const;

function AdminSettings() {
  return (
    <>
      <PageHead title="Settings">
        Preview how each area of the site is built and works. These open the real pages as your admin account — nothing here changes data unless you submit a form.
      </PageHead>
      <section className={panelCls} aria-labelledby="preview-h">
        <h2 id="preview-h" className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">Portal previews</h2>
        <ul className="divide-y divide-ds-border">
          {PREVIEWS.map((p) => (
            <li key={p.to} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 max-w-2xl">
                <h3 className="ds-body font-semibold text-ds-text">{p.title}</h3>
                <p className="ds-support mt-1 text-ds-text-2">{p.body}</p>
              </div>
              <Link
                to={p.to as "/portal"}
                className="ds-button-text inline-flex min-h-11 shrink-0 items-center rounded-ds-sm bg-ds-primary px-5 uppercase text-ds-on-primary ds-transition hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
