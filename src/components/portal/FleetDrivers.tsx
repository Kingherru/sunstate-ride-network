import { StatusPill } from "@/components/ds/status";
import { useState } from "react";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { SegTabs } from "@/components/portal/SegTabs";
import { usePortalQuery } from "@/components/portal/preview-data";
import { listMyDrivers } from "@/lib/schedule-board.functions";

type Section = "vehicles" | "drivers" | "availability";
export function FleetDrivers({ initial = "vehicles" }: { initial?: "vehicles" | "drivers" }) {
  const [section, setSection] = useState<Section>(initial);
  return <div className="min-w-0 max-w-full space-y-5"><SegTabs label="Fleet sections" queryKey="view" value={section} onChange={setSection} options={[
    { value: "vehicles", label: "Vehicles" }, { value: "drivers", label: "Drivers & Contractors" }, { value: "availability", label: "Assignments & Availability" },
  ]} />{section === "availability" ? <Availability /> : <FleetPanel key={section} only={section} />}</div>;
}

/** Read-only availability summary over the same authorized driver records; assignment happens on the Schedule day board. */
function Availability() {
  const q = usePortalQuery({ queryKey: ["my-drivers"], queryFn: () => listMyDrivers() });
  const rows = (q.data ?? []) as { id: string; first_name: string; last_name: string; status: string | null; employment_type: string | null; availability: unknown; vacation_start: string | null; vacation_end: string | null }[];
  if (q.isError) return <p role="alert" className="ds-support text-ds-error">Availability could not be loaded.</p>;
  if (!rows.length) return <p className="ds-support rounded-ds border border-ds-sky-border bg-ds-sky p-5">No authorized drivers yet.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((d) => {
    const away = d.vacation_start && d.vacation_end && today >= d.vacation_start.slice(0, 10) && today <= d.vacation_end.slice(0, 10);
    const avail = typeof d.availability === "string" ? d.availability : Array.isArray(d.availability) ? d.availability.join(", ") : null;
    return <article key={d.id} className="rounded-ds border border-ds-sky-border bg-ds-sky p-4">
      <h3 className="ds-label break-words text-ds-primary">{d.first_name} {d.last_name}</h3>
      <p className="ds-support">{d.employment_type === "contractor" ? "Contractor" : d.employment_type === "employee" ? "Employee" : "Type not provided"} · {d.status === "active" ? "Active" : d.status ? "Inactive" : "Status not provided"}</p>
      <p className="ds-support">Availability: {avail || "Not provided"}</p>
      {away && <StatusPill tone="yellow" status={`On leave through ${d.vacation_end!.slice(0, 10)}`} />}
    </article>;
  })}</div>;
}
