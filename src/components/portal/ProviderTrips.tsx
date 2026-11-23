import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { TripHistoryPanel } from "@/components/dashboard/TripHistoryPanel";
import { SavedTripsPanel } from "@/components/dashboard/SavedTripsPanel";
import { PortalTabbedLayout } from "@/components/portal/PortalTabbedLayout";
import {ProviderExports} from './ProviderExports';
import {SelectedTripExport} from './SelectedTripExport';
import { usePortalPreview } from './preview-data';
import { ProviderNetworkOffers,DistributionActivity } from './TripNetwork';
import { NewTripWorkspace } from './NewTripWorkspace';
import { RequestForm } from '@/components/requests/RequestForm';
import { SegTabs } from './SegTabs';
import { PROVIDER_RESERVATION_TABS, reservationSectionFor, type ProviderReservationView } from './provider-trip-navigation';
import type { AccessWorkspace } from '@/lib/access.functions';

export type ProviderTripView = "new" | "reservations" | "drafts" | "history" | "transfer";

/**
 * Provider trips: NEW TRIP, RESERVATIONS (compact summaries; full authorized
 * details load only in the popup) and IMPORT & EXPORT. Row-level rules decide
 * every row; combining sections never changes a record's status.
 */
export function ProviderTrips({ userId, business, initial = "new" }: { userId: string; business?: AccessWorkspace | null; initial?: ProviderTripView }) {
  const [view, setView] = useState<'new' | 'reservations' | 'transfer'>(initial === 'new' ? 'new' : initial === 'transfer' ? 'transfer' : 'reservations');
  const [reservation, setReservation] = useState<ProviderReservationView>(reservationSectionFor(initial));
  const navigate = useNavigate();
  const preview = usePortalPreview();
  const canPrepare = preview.active || !!business && business.type === 'provider' && ['owner', 'admin'].includes(business.role) && !business.is_contractor;
  const workspaceId = preview.active ? 'preview-ws' : business?.id;
  const active = reservation === 'pending' || reservation === 'booked';
  const lifecycle = reservation === 'booked' ? 'booked' : 'unconfirmed';
  return (
    <div className="space-y-5">
      <PortalTabbedLayout label="Trip views" queryKey="view" aliases={{drafts:'reservations', history:'reservations'}} value={view} onChange={v=>{setView(v); if(v === 'reservations')setReservation(reservationSectionFor(null));}}
        options={[
          { value: "new", label: "New Trip" },
          { value: "reservations", label: "Reservations" },
          { value: "transfer", label: "Import & Export" },
        ]} >
      {view === "new" && (
        <div className="space-y-3">
          <nav aria-label="Secondary trip actions" className="flex flex-wrap gap-x-5 gap-y-2 ds-support font-semibold text-ds-link"><Link to="/portal/requests">View Created Requests</Link></nav>
          {canPrepare && workspaceId ? <NewTripWorkspace workspaceId={workspaceId} provider/> : <RequestForm context="portal"/>}
        </div>
      )}
      {view === "reservations" && <div className="space-y-4"><SegTabs label="Reservation sections" value={reservation} onChange={setReservation} options={[...PROVIDER_RESERVATION_TABS]}/>
      {active ? (
        <div className="provider-active-reservations grid min-w-0 gap-4 lg:grid-cols-2">
          <section aria-labelledby="resv-trips" data-reservation-column="trips" className="min-w-0 space-y-2 border border-ds-border bg-ds-surface p-3 sm:p-4">
            <h2 id="resv-trips" className="ds-subheading bg-ds-sky px-3 py-2">Trips · {reservation==='pending'?'Unconfirmed & Drafts':'Booked'}</h2>
            {reservation === "pending" && <SavedTripsPanel variant="drafts" compact onResume={(draft) => preview.active ? navigate({ to: '/admin/preview/$kind', params: {kind: preview.kind}, search: {page: 'requests/new', accountType: preview.accountType, draft: draft.id} }) : navigate({ to: "/portal/requests/new", search: { draft: draft.id } })} />}
            <ReservationsPanel userId={userId} scope="provider" compact hideReferrals hideLifecycleTabs hideScheduling selectedState={lifecycle} category="owned" workspaceId={workspaceId}/>
          </section>
          <section aria-labelledby="resv-referrals" data-reservation-column="referrals" className="min-w-0 space-y-3 border border-ds-border bg-ds-surface p-3 sm:p-4">
            <h2 id="resv-referrals" className="ds-subheading bg-ds-sky px-3 py-2">Referrals · {reservation==='booked'?'Booked':'Unconfirmed'}</h2>
            <div className="space-y-2"><h3 className="ds-label uppercase">Received Referrals</h3>
              <ReservationsPanel userId={userId} scope="provider" compact hideReferrals hideLifecycleTabs hideScheduling selectedState={lifecycle} category="received" workspaceId={workspaceId}/>
              {reservation!=='booked'&&<ProviderNetworkOffers pendingOnly compact/>}
            </div>
            <div className="space-y-2 border-t border-ds-border pt-3"><h3 className="ds-label uppercase">Sent Referrals</h3>
              <ReservationsPanel userId={userId} scope="provider" compact hideReferrals hideLifecycleTabs hideScheduling selectedState={lifecycle} category="sent" workspaceId={workspaceId}/>
              {reservation!=='booked'&&<DistributionActivity pendingOnly compact/>}
            </div>
          </section>
        </div>
      ) : reservation === 'history' ? <section className="min-w-0 space-y-3 border border-ds-border bg-ds-surface p-3 sm:p-4"><TripHistoryPanel userId={userId} includeCanceled workspaceId={canPrepare?workspaceId:undefined}/></section>
        : <section className="min-w-0 space-y-3 border border-ds-border bg-ds-surface p-3 sm:p-4"><ReservationsPanel userId={userId} scope="provider" compact hideReferrals hideLifecycleTabs hideScheduling selectedState="past" workspaceId={workspaceId}/></section>}
      </div>}
      {view === "transfer" && <section aria-labelledby="trip-transfer" className="min-w-0 space-y-5 border border-ds-border bg-ds-surface p-3 sm:p-4">
        <h2 id="trip-transfer" className="ds-subheading bg-ds-sky px-3 py-2">Import & Export</h2>
        <div className="space-y-2"><h3 className="ds-label uppercase">Import trips</h3><p className="ds-support">Uploads create editable drafts only — nothing is submitted.</p><Link to="/portal/upload-csv" className="trip-compact-action inline-flex">Open trip import</Link></div>
        <div className="space-y-2 border-t border-ds-border pt-4"><h3 className="ds-label uppercase">Selected-trip reports</h3><SelectedTripExport/></div>
        <div className="space-y-2 border-t border-ds-border pt-4"><h3 className="ds-label uppercase">Trip exports</h3><ProviderExports/></div>
      </section>}
    </PortalTabbedLayout>
    </div>
  );
}
