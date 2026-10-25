import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ReservationsPanel, ReferralReservationsSection } from "@/components/dashboard/RequestsPanel";
import { TripHistoryPanel } from "@/components/dashboard/TripHistoryPanel";
import { SavedTripsPanel } from "@/components/dashboard/SavedTripsPanel";
import { SegTabs } from "@/components/portal/SegTabs";

export type ProviderTripView = "new" | "reservations" | "drafts" | "history";

/**
 * Provider trips: NEW TRIPS (only trips assigned or referred to this provider —
 * no open pool), RESERVATIONS, DRAFTS (own drafts only) and HISTORY.
 * Row-level rules decide every row; nothing here widens access.
 */
export function ProviderTrips({ userId, initial = "new" }: { userId: string; initial?: ProviderTripView }) {
  const [view, setView] = useState<ProviderTripView>(initial);
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <SegTabs label="Trip views" value={view} onChange={setView}
        options={[
          { value: "new", label: "New trips" },
          { value: "reservations", label: "Reservations" },
          { value: "drafts", label: "Drafts" },
          { value: "history", label: "History" },
        ]} />
      {view === "new" && (
        <div className="space-y-3">
          <p className="ds-support text-ds-muted">
            Trips assigned or referred to your company appear here for you to confirm. There is no open pool of other companies' trips.
          </p>
          <ReferralReservationsSection userId={userId} />
        </div>
      )}
      {view === "reservations" && <ReservationsPanel userId={userId} scope="provider" hideReferrals />}
      {view === "drafts" && (
        <SavedTripsPanel variant="drafts" onResume={(draft) => navigate({ to: "/portal/requests/new", search: { draft: draft.id } })} />
      )}
      {view === "history" && <TripHistoryPanel userId={userId} />}
    </div>
  );
}
