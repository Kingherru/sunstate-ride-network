export type PatientEvent = { action: string; at: string };
export type PatientStage = 'Pending' | 'Waiting on Payment' | 'Approved' | 'Added to Dispatch Schedule' | 'Driver Assigned' | 'Completed' | 'Canceled' | 'Declined' | 'Needs Attention';
export function patientStage(status: string | null | undefined, invoiceDue = false): PatientStage {
  const s = (status ?? '').toLowerCase();
  if (['canceled','cancelled'].includes(s)) return 'Canceled';
  if (s === 'declined') return 'Declined';
  if (s === 'completed') return 'Completed';
  if (s === 'needs_attention') return 'Needs Attention';
  if (invoiceDue) return 'Waiting on Payment';
  if (s === 'driver_assigned') return 'Driver Assigned';
  if (['scheduled','dispatched'].includes(s)) return 'Added to Dispatch Schedule';
  if (['approved','confirmed','accepted','reserved','assigned','in_progress'].includes(s)) return 'Approved';
  return 'Pending';
}
export function patientTimeline(events: PatientEvent[]) {
  const known=new Set(['received','new','pending','approved','confirmed','accepted','reserved','assigned','scheduled','dispatched','driver_assigned','completed','canceled','cancelled','declined','needs_attention']);
  return events.filter(e => known.has(e.action) && Number.isFinite(Date.parse(e.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).map(e => ({ ...e, label: patientStage(e.action) })).filter((e,i,a) => i === 0 || e.label !== a[i-1]?.label);
}
export function patientTripGroup(stage: PatientStage) {
  return stage === 'Completed' ? 'completed' : ['Canceled','Declined'].includes(stage) ? 'canceled' : ['Pending','Needs Attention','Waiting on Payment'].includes(stage) ? 'pending' : 'upcoming';
}