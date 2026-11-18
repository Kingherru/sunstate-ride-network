export const RESOURCE_MIME = 'application/x-mfn-resource';
export type AssignmentInput = { tripId: string; driverId: string | null; vehicleId: string | null; start: string; end: string | null };
export type AssignmentTrip = { id: string; driver_id?: string | null; assigned_driver_id?: string | null; vehicle_id?: string | null; scheduled_start_time?: string | null; pickup_time?: string | null; assignment_end_time?: string | null };
export type AssignmentResource = { id: string; status?: string | null };
/** Shared board/fallback drop handler. The authenticated RPC remains the authorization boundary. */
export async function handleResourceDrop({ raw, trip, drivers, vehicles, preview, assign, simulate }: {
  raw: string; trip: AssignmentTrip; drivers: AssignmentResource[]; vehicles: AssignmentResource[];
  preview: boolean; assign: (input: AssignmentInput) => Promise<unknown>; simulate: (input: AssignmentInput) => void;
}) {
  const resource = JSON.parse(raw) as { kind?: string; id?: string };
  if ((resource.kind !== 'driver' && resource.kind !== 'vehicle') || typeof resource.id !== 'string') throw new Error('Choose an eligible driver or vehicle.');
  const eligible = (resource.kind === 'driver' ? drivers : vehicles).find(r => r.id === resource.id && r.status === 'active');
  if (!eligible) throw new Error('This resource is unavailable for assignment. Previous assignment unchanged.');
  const start = (trip.scheduled_start_time ?? trip.pickup_time ?? '').slice(0, 5);
  if (!start) throw new Error('Review a schedule start time using the assignment form.');
  const input: AssignmentInput = { tripId: trip.id,
    driverId: resource.kind === 'driver' ? resource.id : (trip.driver_id ?? trip.assigned_driver_id ?? null),
    vehicleId: resource.kind === 'vehicle' ? resource.id : (trip.vehicle_id ?? null),
    start, end: trip.assignment_end_time?.slice(0, 5) ?? null };
  if (preview) simulate(input); else await assign(input);
  return input;
}
