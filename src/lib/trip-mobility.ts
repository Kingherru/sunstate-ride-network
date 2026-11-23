/** Versioned selections retained in the existing canonical mobility_notes field. */
export const MOBILITY_OPTIONS = ['Wheelchair Required', 'Oxygen Required', 'Assistance to Vehicle', 'Door-to-Door Assistance', 'Luggage', 'Bariatric Assistance', 'Walker or Cane', 'Additional Passenger or Escort'] as const;
export type MobilityOption = typeof MOBILITY_OPTIONS[number];
/** Shown as Mobility Requirements; moved/retired options stay readable for legacy records. */
export const VISIBLE_MOBILITY_OPTIONS = ['Wheelchair Required', 'Oxygen Required', 'Luggage', 'Bariatric Assistance'] as const satisfies readonly MobilityOption[];
export const PICKUP_OPTIONS = ['Curbside Pickup', 'Front Door Pickup', 'Couch Pickup', 'Bed Pickup', 'Stairs', 'Door-to-Door Assistance', 'Assistance to Vehicle', 'Walker or Cane'] as const;
export type PickupOption = typeof PICKUP_OPTIONS[number];
const MOVED: readonly string[] = ['Door-to-Door Assistance', 'Assistance to Vehicle', 'Walker or Cane'];
const pickupPrefix = '[Pickup options v1] ';
export function mobilityOperationalFields(notes: string | null | undefined, transport: string) {
  const {selected}=readMobility(notes); const pickup=readPickupOptions(notes);
  return {needs_wheelchair:transport==='wheelchair'||selected.includes('Wheelchair Required'),needs_assistance_to_vehicle:pickup.includes('Assistance to Vehicle'),...(pickup.includes('Door-to-Door Assistance')?{service_level:'door_to_door' as const}:{})};
}
const prefix = '[Mobility selections v1] ';
export function readMobility(notes: string | null | undefined): { selected: MobilityOption[]; legacy: string } {
  const lines = (notes ?? '').split('\n');
  const selection = lines.find(line => line.startsWith(prefix));
  return { selected: MOBILITY_OPTIONS.filter(option => selection?.slice(prefix.length).split(' | ').includes(option)), legacy: lines.filter(line => !line.startsWith(prefix) && !line.startsWith(pickupPrefix)).join('\n') };
}
/** Pickup options, including legacy moved choices previously saved as mobility selections. */
export function readPickupOptions(notes: string | null | undefined): PickupOption[] {
  const line = (notes ?? '').split('\n').find(l => l.startsWith(pickupPrefix));
  const explicit = line ? line.slice(pickupPrefix.length).split(' | ') : [];
  const legacy = readMobility(notes).selected.filter(o => MOVED.includes(o));
  return PICKUP_OPTIONS.filter(o => explicit.includes(o) || (legacy as string[]).includes(o));
}
function compose(legacy: string, mobility: readonly string[], pickup: readonly string[]) {
  return [legacy, mobility.length ? prefix + mobility.join(' | ') : '', pickup.length ? pickupPrefix + pickup.join(' | ') : ''].filter(Boolean).join('\n');
}
export function writeMobility(notes: string | null | undefined, selected: readonly MobilityOption[]): string {
  const legacy = readMobility(notes).legacy;
  const pickup = (notes ?? '').split('\n').find(l => l.startsWith(pickupPrefix))?.slice(pickupPrefix.length).split(' | ') ?? [];
  return compose(legacy, MOBILITY_OPTIONS.filter(option => selected.includes(option)), PICKUP_OPTIONS.filter(o => pickup.includes(o)));
}
/** Writing pickup options moves legacy duplicates out of the mobility line (no loss). */
export function writePickupOptions(notes: string | null | undefined, selected: readonly PickupOption[]): string {
  const { legacy, selected: mobility } = readMobility(notes);
  return compose(legacy, mobility.filter(o => !MOVED.includes(o)), PICKUP_OPTIONS.filter(o => selected.includes(o)));
}
export function matchingTripPatients<T extends { first_name: string; last_name: string; phone?: string | null; email?: string | null }>(rows: readonly T[], value: string): T[] {
  const term = value.trim().toLowerCase();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, '');
  return rows.filter(p => [p.first_name, p.last_name, p.email, `${p.first_name} ${p.last_name}`].some(v => v?.toLowerCase().includes(term)) || digits.length >= 3 && p.phone?.replace(/\D/g, '').includes(digits)).slice(0, 8);
}
