import { useServerFn } from '@tanstack/react-start';
import { listDriverUpcomingTrips } from '@/lib/schedule-board.functions';
import { usePortalQuery } from '@/components/portal/preview-data';
import { DetailOverlayFrame } from '@/components/portal/DetailOverlayFrame';
import { DetailSection } from '@/components/portal/DetailSection';
import { StatusPill } from '@/components/ds/status';
import { displayPhone } from '@/lib/portal-read-rules';
export function DriverDetailModal({driverId,onClose}:{driverId:string;onClose:()=>void}) {
 const list=useServerFn(listDriverUpcomingTrips);const q=usePortalQuery({queryKey:['driver-upcoming-trips',driverId],queryFn:()=>list({data:{driver_id:driverId,days:7}})});
 const driver=q.data?.driver;const trips=q.data?.trips??[];
 return <DetailOverlayFrame title={driver ? `${driver.first_name??''} ${driver.last_name??''}`.trim() : 'Driver'} onClose={onClose}>
 <DetailSection title="Driver contact"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="ds-label">Email</dt><dd className="ds-body break-words">{driver?.email??'NOT PROVIDED'}</dd></div><div><dt className="ds-label">Phone</dt><dd className="ds-body">{displayPhone(driver?.phone??'NOT PROVIDED')}</dd></div></dl></DetailSection>
 <DetailSection title="Next seven days"><p className="ds-support">Schedule email unavailable — delivery OFF.</p>{q.isLoading&&<p role="status">Loading…</p>}{q.isError&&<p role="alert">Driver schedule unavailable.</p>}{!q.isLoading&&!trips.length&&<p className="ds-support mt-3">No upcoming assigned trips.</p>}<ul className="divide-y divide-ds-border">{trips.map(t=><li key={t.id} className="grid gap-2 py-3 sm:grid-cols-2"><div><p className="ds-label">{t.pickup_date} · {String(t.scheduled_start_time??t.pickup_time??'').slice(0,5)}</p><p className="ds-body">{t.patient_first_name} {t.patient_last_name}</p><p className="ds-support break-words">{t.pickup_city} → {t.dropoff_city}</p></div>{t.status&&<div><StatusPill status={t.status}/></div>}</li>)}</ul></DetailSection>
 </DetailOverlayFrame>;
}
