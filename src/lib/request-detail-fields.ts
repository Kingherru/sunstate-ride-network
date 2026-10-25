export const NOT_PROVIDED = 'NOT PROVIDED';
export const NOT_REQUIRED = 'NOT REQUIRED';
export const NOT_AVAILABLE = 'NOT AVAILABLE';

export function detailValue(record: Record<string, unknown>, key: string, required = true): string {
  if (!required) return NOT_REQUIRED;
  if (!Object.prototype.hasOwnProperty.call(record, key)) return NOT_AVAILABLE;
  const value = record[key];
  if (value === null || value === undefined || value === '') return NOT_PROVIDED;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'string' || typeof value === 'number' ? String(value) : NOT_AVAILABLE;
}

export function selectedTripType(record: Record<string, unknown>): string {
  if (record.recurrence_rule && record.recurrence_rule !== 'none') return 'REPEATING TRIP';
  const type = record.trip_type;
  if (type === 'multi_trip' || type === 'multi_stop') return 'MULTI-TRIP';
  if (type === 'round_trip' || record.round_trip === true) return 'ROUND TRIP';
  if (type === 'one_way' || record.round_trip === false) return 'ONE WAY';
  return NOT_AVAILABLE;
}

export function selectedService(record: Record<string, unknown>): string {
  if (record.trip_kind === 'medical_delivery' || record.transport_type === 'delivery') return 'MEDICAL DELIVERY';
  const service = record.transport_type;
  const labels: Record<string, string> = { ambulatory: 'AMBULATORY', wheelchair: 'WHEELCHAIR', gurney: 'GURNEY/STRETCHER', stretcher: 'GURNEY/STRETCHER' };
  return typeof service === 'string' && service ? labels[service] || service.replaceAll('_', ' ').toUpperCase() : NOT_AVAILABLE;
}