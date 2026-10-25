import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ScheduleCalendarPanel } from "@/components/dashboard/ScheduleCalendarPanel";

export const Route = createFileRoute("/_authenticated/portal/schedule")({
  head: () => ({ meta: [{ title: "Schedule — MY FLORIDA NEMT" }, { name: 'description', content: 'View authorized daily trips and driver or vehicle scheduling conflicts.' }, { property: 'og:title', content: 'Schedule — MY FLORIDA NEMT' }, { property: 'og:description', content: 'View authorized daily trips and driver or vehicle scheduling conflicts.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalSchedule,
});

function PortalSchedule() {
  return (
    <>
      <PageHead title="Schedule" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ScheduleCalendarPanel />
      </section>
    </>
  );
}
