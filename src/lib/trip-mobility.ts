/** Versioned selections retained in the existing canonical mobility_notes field. */
export const MOBILITY_OPTIONS = ['Wheelchair Required', 'Oxygen Required', 'Assistance to Vehicle', 'Door-to-Door Assistance', 'Luggage', 'Bariatric Assistance', 'Walker or Cane', 'Additional Passenger or Escort'] as const;
export type MobilityOption = typeof MOBILITY_OPTIONS[number];
export function mobilityOperationalFields(notes: string | null | undefined, transport: string) {
  const {selected}=readMobility(notes);
  return {needs_wheelchair:transport==='wheelchair'||selected.includes('Wheelchair Required'),needs_assistance_to_vehicle:selected.includes('Assistance to Vehicle'),...(selected.includes('Door-to-Door Assistance')?{service_level:'door_to_door' as const}:{})};
}
const prefix = '[Mobility selections v1] ';
export function readMobility(notes: string | null | undefined): { selected: MobilityOption[]; legacy: string } {
  const lines = (notes ?? '').split('\n');
  const selection = lines.find(line => line.startsWith(prefix));
  return { selected: MOBILITY_OPTIONS.filter(option => selection?.slice(prefix.length).split(' | ').includes(option)), legacy: lines.filter(line => !line.startsWith(prefix)).join('\n') };
}
export function writeMobility(notes: string | null | undefined, selected: readonly MobilityOption[]): string {
  const legacy = readMobility(notes).legacy;
  const allowed = MOBILITY_OPTIONS.filter(option => selected.includes(option));
  return [legacy, allowed.length ? prefix + allowed.join(' | ') : ''].filter(Boolean).join('\n');
}
export function matchingTripPatients<T extends { first_name: string; last_name: string; phone?: string | null; email?: string | null }>(rows: readonly T[], value: string): T[] {
  const term = value.trim().toLowerCase();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, '');
  return rows.filter(p => [p.first_name, p.last_name, p.email, `${p.first_name} ${p.last_name}`].some(v => v?.toLowerCase().includes(term)) || digits.length >= 3 && p.phone?.replace(/\D/g, '').includes(digits)).slice(0, 8);
}