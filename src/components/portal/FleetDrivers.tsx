import { useState } from "react";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { SegTabs } from "@/components/portal/SegTabs";

export function FleetDrivers({ initial = "vehicles" }: { initial?: "vehicles" | "drivers" }) {
  const [section, setSection] = useState(initial);
  return <div className="space-y-5"><SegTabs label="Fleet sections" value={section} onChange={setSection} options={[
    { value: "vehicles", label: "Vehicles" }, { value: "drivers", label: "Drivers & Contractors" },
  ]} /><FleetPanel key={section} only={section} /></div>;
}