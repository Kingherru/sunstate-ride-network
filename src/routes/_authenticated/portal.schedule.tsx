import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { useState } from "react";
import { ScheduleCalendarPanel } from "@/components/dashboard/ScheduleCalendarPanel";
import { ScheduleRangeView } from "@/components/portal/ScheduleRangeView";
import { SegTabs } from "@/components/portal/SegTabs";

export const Route = createFileRoute("/_authenticated/portal/schedule")({
  head: () => ({ meta: [{ title: "Schedule — MY FLORIDA NEMT" }, { name: 'description', content: 'View authorized daily trips and driver or vehicle scheduling conflicts.' }, { property: 'og:title', content: 'Schedule — MY FLORIDA NEMT' }, { property: 'og:description', content: 'View authorized daily trips and driver or vehicle scheduling conflicts.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalSchedule,
});

function PortalSchedule() {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  return (
    <>
      <PageHead title="Schedule" />
      <section className={`${panelCls} space-y-5 p-4 sm:p-6`}>
        <SegTabs label="Schedule view" value={view} onChange={setView} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
        {view === "day" ? <ScheduleCalendarPanel /> : <ScheduleRangeView key={view} view={view} />}
      </section>
    </>
  );
}
