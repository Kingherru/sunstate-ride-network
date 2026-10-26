export function safeCsvCell(value: unknown) {
  const raw = value == null ? '' : String(value);
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export const EXPORT_FIELDS = ['display_id', 'pickup_date', 'pickup_time', 'pickup_address', 'pickup_city', 'dropoff_address', 'dropoff_city', 'status', 'driver_id', 'vehicle_id'] as const;
export function providerCsv(rows: Record<string, unknown>[]) {
  return [EXPORT_FIELDS.map(safeCsvCell).join(','), ...rows.map(r => EXPORT_FIELDS.map(k => safeCsvCell(r[k])).join(','))].join('\r\n');
}