import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ReservationsPanel, ReferralReservationsSection } from "@/components/dashboard/RequestsPanel";
import { TripHistoryPanel } from "@/components/dashboard/TripHistoryPanel";
import { SavedTripsPanel } from "@/components/dashboard/SavedTripsPanel";
import { PortalTabbedLayout } from "@/components/portal/PortalTabbedLayout";
import {ProviderExports} from './ProviderExports';
import {SelectedTripExport} from './SelectedTripExport';
import { usePortalPreview } from './preview-data';
import { NewTripWorkspace } from './NewTripWorkspace';
import { RequestForm } from '@/components/requests/RequestForm';
import { SegTabs } from './SegTabs';
import { DEFAULT_PROVIDER_RESERVATION, PROVIDER_RESERVATION_TABS, type ProviderReservationView } from './provider-trip-navigation';
import type { AccessWorkspace } from '@/lib/access.functions';

export type ProviderTripView = "new" | "reservations" | "drafts" | "history";

/**
 * Provider trips: NEW TRIPS (only trips assigned or referred to this provider —
 * no open pool), RESERVATIONS, DRAFTS (own drafts only) and HISTORY.
 * Row-level rules decide every row; nothing here widens access.
 */
export function ProviderTrips({ userId, business, initial = "new" }: { userId: string; business?: AccessWorkspace | null; initial?: ProviderTripView }) {
  const [view, setView] = useState<'new' | 'reservations'>(initial === 'new' ? 'new' : 'reservations');
  const [reservation, setReservation] = useState<ProviderReservationView>(initial === 'drafts' || initial === 'history' ? initial : DEFAULT_PROVIDER_RESERVATION);
  const navigate = useNavigate();
  const preview = usePortalPreview();
  const canPrepare = preview.active || !!business && business.type === 'provider' && ['owner', 'admin'].includes(business.role) && !business.is_contractor;
  const workspaceId = preview.active ? 'preview-ws' : business?.id;
  return (
    <div className="space-y-5">
      <PortalTabbedLayout label="Trip views" queryKey="view" aliases={{drafts:'reservations', history:'reservations'}} value={view} onChange={v=>{setView(v); if(v === 'reservations')setReservation(DEFAULT_PROVIDER_RESERVATION);}}
        options={[
          { value: "new", label: "New Trip" },
          { value: "reservations", label: "Reservations" },
        ]} >
      {view === "new" && (
        <div className="space-y-3">
          <nav aria-label="Secondary trip actions" className="flex flex-wrap gap-x-5 gap-y-2 ds-support font-semibold text-ds-link"><Link to="/portal/requests">View Created Requests</Link><Link to="/portal/upload-csv">Import Trips</Link></nav>
          {canPrepare && workspaceId ? <NewTripWorkspace workspaceId={workspaceId} provider/> : <RequestForm context="portal"/>}
        </div>
      )}
      {view === "reservations" && <div className="space-y-5"><SegTabs label="Reservation sections" value={reservation} onChange={setReservation} options={[...PROVIDER_RESERVATION_TABS]}/>
      {reservation === "drafts" ? (
        <SavedTripsPanel variant="drafts" onResume={(draft) => preview.active ? navigate({ to: '/admin/preview/$kind', params: {kind: preview.kind}, search: {page: 'requests/new', accountType: preview.accountType, draft: draft.id} }) : navigate({ to: "/portal/requests/new", search: { draft: draft.id } })} />
      ) : reservation === "history" ? <><TripHistoryPanel userId={userId} /><details className="mt-5"><summary className="ds-label cursor-pointer">Selected-trip reports</summary><div className="pt-4"><SelectedTripExport /></div></details><details className="mt-5"><summary className="ds-label cursor-pointer">Additional trip exports</summary><div className="pt-4"><ProviderExports /></div></details></> : <><ReservationsPanel userId={userId} scope="provider" hideReferrals hideLifecycleTabs selectedState={reservation}/>{reservation === 'unconfirmed' && <ReferralReservationsSection userId={userId}/>}</>}
      </div>}
    </PortalTabbedLayout>
    </div>
  );
}
