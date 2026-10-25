import { Link } from "@tanstack/react-router";
import { SmartNotes } from "@/components/portal/SmartNotes";
import { ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { panelCls } from "@/components/portal/PortalShell";

/** Provider Overview: Smart Notes first (stacks first on phones), New Trips second. */
export function ProviderOverview({ workspaceId, userId }: { workspaceId: string | null; userId: string }) {
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SmartNotes workspaceId={workspaceId} />
        <section className={`${panelCls} min-w-0`} aria-labelledby="new-trips-h">
          <div className="flex items-center justify-between gap-3 border-b border-ds-border px-4 py-3 sm:px-5">
            <h2 id="new-trips-h" className="ds-subheading uppercase text-ds-primary">New trips</h2>
            <Link to="/portal/trips" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">All trips</Link>
          </div>
          <div className="p-4 sm:p-5"><ReservationsPanel userId={userId} scope="provider" /></div>
        </section>
      </div>
      <section className={`${panelCls} bg-ds-subtle p-4 sm:p-5`} aria-label="Notifications"><NotificationsPanel /></section>
    </div>
  );
}
