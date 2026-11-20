import { Link } from "@tanstack/react-router";
import { CalendarDays, Truck, Users, GraduationCap, Network, MessageSquare } from "lucide-react";
import { SmartNotes } from "@/components/portal/SmartNotes";
import { ReferralReservationsSection } from "@/components/dashboard/RequestsPanel";
import { panelCls } from "@/components/portal/PortalShell";

import { NotificationIndicator } from './NotificationIndicator';
import { usePortalQuery } from './preview-data';
import { getMessagingUnreadCount } from '@/lib/workspace-messages.functions';
import { getUnreadMessageCount } from '@/lib/messages.functions';
import { listMyNotifications, type NotificationRow } from '@/lib/notifications.functions';
import { getActivityIndicators } from '@/lib/indicators.functions';
import { overviewMessageCount, overviewNotificationCounts } from './provider-overview-activity';

const TOOLS = [
  { to: "/portal/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/portal/vehicles", label: "Vehicles", icon: Truck },
  { to: "/portal/drivers", label: "Drivers & contractors", icon: Users },
  { to: "/portal/training", label: "Training & tests", icon: GraduationCap },
  { to: "/portal/network", label: "Network", icon: Network },
  { to: "/portal/messaging", label: "Messages", icon: MessageSquare },
] as const;

/** Provider Overview: Smart Notes first (stacks first on phones), New Trips second, then tool cards. */
export function ProviderOverview({ workspaceId, userId }: { workspaceId: string | null; userId: string }) {
  const workspaceUnread = usePortalQuery({ queryKey: ['messaging-unread'], staleTime: 60_000, queryFn: () => getMessagingUnreadCount() });
  const directUnread = usePortalQuery({ queryKey: ['msg-unread-total'], staleTime: 30_000, queryFn: () => getUnreadMessageCount() });
  const activity = usePortalQuery({ queryKey: ['activity-indicators'], staleTime: 60_000, queryFn: () => getActivityIndicators() });
  const notifications = usePortalQuery({
    queryKey: ['notifications', 'provider-overview-unread'], staleTime: 60_000,
    queryFn: async () => {
      const rows: NotificationRow[] = [];
      let offset = 0;
      while (true) {
        const page = await listMyNotifications({ data: { filter: 'unread', limit: 200, offset } });
        rows.push(...page.rows);
        offset += page.rows.length;
        if (offset >= page.total || page.rows.length === 0) return { rows };
      }
    },
  });
  const counts = overviewNotificationCounts(notifications.data?.rows ?? []);
  const messages = overviewMessageCount(workspaceUnread.data, directUnread.data?.count);
  const badgeCounts: Partial<Record<(typeof TOOLS)[number]['to'], number>> = {
    '/portal/schedule': counts.schedule,
    '/portal/messaging': messages,
    '/portal/network': overviewMessageCount(activity.data?.network, 0),
  };
  return (
    <div className="provider-overview grid items-start gap-5 lg:grid-cols-2">
        <SmartNotes workspaceId={workspaceId} />
        <div className="min-w-0 space-y-4">
        <section className={`${panelCls} min-w-0`} aria-labelledby="new-trips-h">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border bg-ds-info-soft px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
            <h2 id="new-trips-h" className="ds-subheading uppercase text-ds-primary">New trips</h2>
            <NotificationIndicator tone="attention" count={counts.newTrips} label="unread new trip or referral notifications" />
            </div>
            <Link to="/portal/trips" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">All trips</Link>
          </div>
          <div className="p-4 sm:p-5"><ReferralReservationsSection userId={userId} /></div>
        </section>
      <nav aria-label="Provider tools" className="grid gap-2 min-[460px]:grid-cols-2">
        {TOOLS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="ds-support flex min-h-12 min-w-0 items-center gap-2.5 rounded-ds border border-ds-border bg-ds-surface px-3 py-2.5 font-semibold text-ds-primary ds-transition hover:border-ds-accent hover:bg-ds-info-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
            <Icon className="size-4 shrink-0 text-ds-accent" aria-hidden />
            <span className="min-w-0 flex-1">{label}</span>
            <NotificationIndicator tone="attention" count={badgeCounts[to] ?? 0} label={`unread ${label.toLowerCase()} updates`} />
          </Link>
        ))}
      </nav>
      </div>
    </div>
  );
}
