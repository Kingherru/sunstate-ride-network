export type DriverCandidate = { id: string; workspace_id: string | null; status: string; service_capabilities: string[]; license_expiry?: string | null; vacation_start?: string | null; vacation_end?: string | null };
export function eligibleDriver(d: DriverCandidate, workspaceId: string, service: string, date: string) {
  return d.workspace_id === workspaceId && d.status === 'active' && d.service_capabilities.includes(service) && (!d.license_expiry || d.license_expiry >= date) && !(d.vacation_start && d.vacation_end && date >= d.vacation_start && date <= d.vacation_end);
}
export function vehicleMissingFields(v: { make?: string | null; model?: string | null; model_year?: number | null; plate?: string | null; vehicle_category?: string | null; capacity?: number | null; service_capabilities?: string[] | null }) {
  return [!v.make?.trim() && 'Make', !v.model?.trim() && 'Model', !v.model_year && 'Model year', !v.plate?.trim() && 'License plate', !v.vehicle_category && 'Vehicle category', !(v.capacity && v.capacity > 0) && 'Passenger capacity', !v.service_capabilities?.length && 'Supported services'].filter((v): v is string => !!v);
}
export function providerSubtypeChangeAllowed(owner: boolean, confirmed: boolean, subtype: string) {
  return owner && confirmed && ['nemt_business', 'independent_contractor'].includes(subtype);
}