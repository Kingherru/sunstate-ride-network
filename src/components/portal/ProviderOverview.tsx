import { Link } from "@tanstack/react-router";
import { CalendarDays, Truck, Users, GraduationCap, Network, MessageSquare } from "lucide-react";
import { SmartNotes } from "@/components/portal/SmartNotes";
import { ReferralReservationsSection } from "@/components/dashboard/RequestsPanel";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { panelCls } from "@/components/portal/PortalShell";

const TOOLS = [
  { to: "/portal/schedule", label: "Today's schedule", text: "Drivers and trips by hour.", icon: CalendarDays },
  { to: "/portal/vehicles", label: "Vehicles", text: "Your fleet, types and capacity.", icon: Truck },
  { to: "/portal/drivers", label: "Drivers & contractors", text: "Team, availability and earnings.", icon: Users },
  { to: "/portal/training", label: "Training & tests", text: "Courses and certificates.", icon: GraduationCap },
  { to: "/portal/network", label: "Network", text: "Verified providers across Florida.", icon: Network },
  { to: "/portal/messaging", label: "Messages", text: "Business conversations.", icon: MessageSquare },
] as const;

/** Provider Overview: Smart Notes first (stacks first on phones), New Trips second, then tool cards. */
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
          <div className="p-4 sm:p-5"><ReferralReservationsSection userId={userId} /></div>
        </section>
      </div>
      <nav aria-label="Provider tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ to, label, text, icon: Icon }) => (
          <Link key={to} to={to} className={`${panelCls} flex items-start gap-3 p-4 hover:border-ds-accent`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ds-accent" aria-hidden />
            <span>
              <span className="block ds-subheading uppercase text-ds-primary">{label}</span>
              <span className="ds-support text-ds-muted">{text}</span>
            </span>
          </Link>
        ))}
      </nav>
      <section className={`${panelCls} bg-ds-subtle p-4 sm:p-5`} aria-label="Notifications"><NotificationsPanel /></section>
    </div>
  );
}
