import { useState } from "react";
import { ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { TripHistoryPanel } from "@/components/dashboard/TripHistoryPanel";
import { SegTabs } from "@/components/portal/SegTabs";

type View = "reservations" | "history";

/** Provider trips: reservations (incl. drafts/unconfirmed) and history. Row-level rules limit rows to trips offered or assigned to this provider. */
export function ProviderTrips({ userId }: { userId: string }) {
  const [view, setView] = useState<View>("reservations");
  return (
    <div className="space-y-5">
      <SegTabs label="Trip views" value={view} onChange={setView}
        options={[{ value: "reservations", label: "Reservations" }, { value: "history", label: "Trip history" }]} />
      {view === "reservations" ? <ReservationsPanel userId={userId} scope="provider" /> : <TripHistoryPanel userId={userId} />}
    </div>
  );
}
