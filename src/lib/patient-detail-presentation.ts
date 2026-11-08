/** Defense-in-depth display allowlist; caller must still obtain an authorized snapshot. */
export function patientDetailFields(row: Record<string, unknown>) {
  const text = (key: string) => typeof row[key] === 'string' && row[key].trim() ? row[key] as string : 'Not Provided';
  const services: Record<string, string> = { ambulatory: 'Ambulatory', wheelchair: 'Wheelchair', gurney: 'Gurney / Stretcher', delivery: 'Medical Delivery' };
  const trips: Record<string, string> = { one_way: 'One way', round_trip: 'Round trip', multi_trip: 'Multi-stop' };
  const fields = [
    { label: 'Trip type', value: trips[String(row.trip_type)] ?? 'Not Available' },
    { label: 'Service type', value: services[String(row.transport_type)] ?? 'Not Available' },
    { label: 'Pickup', value: text('pickup_address') },
    { label: 'Pickup city', value: text('pickup_city') },
    { label: 'Pickup date', value: text('pickup_date') },
    { label: 'Requested pickup time', value: text('pickup_time') },
    { label: 'Drop-off', value: text('dropoff_address') },
    { label: 'Drop-off city', value: text('dropoff_city') },
    { label: 'Requested drop-off / appointment time', value: text('appointment_time') },
  ];
  if (row.trip_type === 'round_trip' || row.round_trip === true) fields.push(
    { label: 'Return date', value: text('return_date') },
    { label: 'Return pickup time', value: text('return_pickup_time') },
    { label: 'Return drop-off time', value: text('return_dropoff_time') },
  );
  else fields.push({ label: 'Return information', value: 'Not Required' });
  return fields;
}