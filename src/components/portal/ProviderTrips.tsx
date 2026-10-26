import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ReservationsPanel, ReferralReservationsSection } from "@/components/dashboard/RequestsPanel";
import { TripHistoryPanel } from "@/components/dashboard/TripHistoryPanel";
import { SavedTripsPanel } from "@/components/dashboard/SavedTripsPanel";
import { actionCls } from "@/components/portal/PortalShell";
import { SegTabs } from "@/components/portal/SegTabs";
import { ProviderNetworkOffers, DistributionActivity } from '@/components/portal/TripNetwork';

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
          <div className="flex flex-wrap items-center justify-between gap-3 border border-ds-sky-border bg-ds-sky p-4 rounded-ds">
            <h3 className="ds-subheading text-ds-primary">Provider-created requests</h3>
            <div className="flex flex-wrap gap-2"><Link to="/portal/requests/new" className={actionCls}>New trip</Link><Link to="/portal/requests" className="ds-button-text inline-flex items-center px-3 text-ds-primary">View created requests</Link></div>
          </div>
          <h3 className="ds-subheading pt-3 text-ds-primary">Incoming assigned & referred trips</h3>
          <ProviderNetworkOffers />
          <ReferralReservationsSection userId={userId} />
          <DistributionActivity />
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
