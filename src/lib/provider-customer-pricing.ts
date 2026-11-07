import { z } from 'zod';

export const CUSTOMER_SERVICES = { ambulatory: 'Ambulatory', wheelchair: 'Wheelchair', stretcher: 'Gurney / Stretcher', medical_delivery: 'Medical Delivery' } as const;
export type CustomerService = keyof typeof CUSTOMER_SERVICES;
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const customerServiceRate = z.object({
  base_cents: cents, minimum_cents: cents, included_miles: z.number().finite().nonnegative(), per_mile_cents: cents,
  wait_cents: cents, wait_unit: z.enum(['minute', 'half_hour', 'hour']), after_hours_cents: cents, holiday_cents: cents,
  additional_stop_cents: cents, cancellation_cents: cents, no_show_cents: cents, additional_passenger_cents: cents,
  cold_chain_cents: cents, signature_cents: cents, rush_cents: cents, round_trip: z.enum(['per_leg', 'single_pickup']),
  after_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), after_hours_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
}).strict();
export const customerRateBook = z.object({ ambulatory: customerServiceRate, wheelchair: customerServiceRate, stretcher: customerServiceRate, medical_delivery: customerServiceRate }).strict();
export type CustomerRate = z.infer<typeof customerServiceRate>;
export type CustomerRateBook = z.infer<typeof customerRateBook>;
export const customerPricingInput = z.object({ workspaceId: z.string().uuid(), rates: customerRateBook, expectedVersion: z.number().int().nonnegative(), confirmed: z.literal(true) }).strict();
export const customerQuoteInput = z.object({ service: z.enum(['ambulatory', 'wheelchair', 'stretcher', 'medical_delivery']), miles: z.number().finite().nonnegative(), waitMinutes: z.number().finite().nonnegative().default(0), additionalStops: z.number().int().nonnegative().default(0), additionalPassengers: z.number().int().nonnegative().default(0), roundTrip: z.boolean().default(false), pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), outcome: z.enum(['normal','canceled','no_show']).default('normal'), coldChain: z.boolean().default(false), signature: z.boolean().default(false), rush: z.boolean().default(false) }).strict();
export type CustomerQuoteInput = z.infer<typeof customerQuoteInput>;

/** Legacy numeric dollar values are read, never modified or adopted as active rates without confirmation. */
export function customerRatesFromLegacy(legacy: Record<string, unknown> | null): CustomerRateBook {
  const money = (key: string) => { const n = Number(legacy?.[key] ?? 0); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0; };
  const common: CustomerRate = { base_cents: money('base_pickup'), minimum_cents: money('minimum_fare'), included_miles: 0, per_mile_cents: money('per_mile'), wait_cents: money('wait_per_min'), wait_unit: ['minute','half_hour','hour'].includes(String(legacy?.wait_unit)) ? legacy?.wait_unit as CustomerRate['wait_unit'] : 'hour', after_hours_cents: money('after_hours_addon'), holiday_cents: money('holiday_surcharge'), additional_stop_cents: 0, cancellation_cents: money('cancellation'), no_show_cents: money('no_show'), additional_passenger_cents: money('additional_passenger'), cold_chain_cents: 0, signature_cents: 0, rush_cents: 0, round_trip: 'per_leg', after_hours_start: String(legacy?.after_hours_start ?? '19:00').slice(0,5), after_hours_end: String(legacy?.after_hours_end ?? '07:00').slice(0,5), holidays: Array.isArray(legacy?.holidays) ? legacy.holidays as string[] : [] };
  return { ambulatory: { ...common }, wheelchair: { ...common, base_cents: common.base_cents + money('wheelchair_addon') }, stretcher: { ...common, base_cents: common.base_cents + money('stretcher_addon') }, medical_delivery: { ...common, base_cents: money('delivery_base'), minimum_cents: money('delivery_min_fee'), per_mile_cents: money('delivery_per_mile'), wait_cents: money('delivery_wait_per_unit'), additional_passenger_cents: 0, cold_chain_cents: money('delivery_cold_chain_surcharge'), signature_cents: money('delivery_signature_surcharge'), rush_cents: money('delivery_rush_surcharge') } };
}

export function calculateCustomerQuote(book: CustomerRateBook, input: CustomerQuoteInput) {
  const rates = customerRateBook.parse(book)[input.service];
  const trip = customerQuoteInput.parse(input);
  const lines: { label: string; cents: number; quantity: number; rateCents: number }[] = [];
  const add = (label: string, amount: number, quantity = 1, rateCents = amount) => { const value = Math.round(amount); if (!Number.isSafeInteger(value) || value < 0) throw new Error('Quote exceeds supported currency precision'); if (value) lines.push({ label, cents: value, quantity, rateCents }); };
  if (trip.outcome === 'canceled') add('Cancellation', rates.cancellation_cents);
  else if (trip.outcome === 'no_show') add('No-show', rates.no_show_cents);
  else {
    const pickups = trip.roundTrip && rates.round_trip === 'per_leg' ? 2 : 1;
    add('Pickup / loading', rates.base_cents * pickups, pickups, rates.base_cents);
    const billableMiles = Math.max(0, trip.miles - rates.included_miles);
    add('Mileage after included miles', billableMiles * rates.per_mile_cents, billableMiles, rates.per_mile_cents);
    const unit = rates.wait_unit === 'hour' ? 60 : rates.wait_unit === 'half_hour' ? 30 : 1;
    const waitUnits = unit === 1 ? trip.waitMinutes : Math.ceil(trip.waitMinutes / unit);
    add('Wait time', waitUnits * rates.wait_cents, waitUnits, rates.wait_cents);
    const time = trip.pickupTime; const start = rates.after_hours_start; const end = rates.after_hours_end;
    if (start < end ? time >= start && time < end : time >= start || time < end) add('After-hours', rates.after_hours_cents);
    if (rates.holidays.includes(trip.pickupDate)) add('Holiday', rates.holiday_cents);
    add('Additional stops', trip.additionalStops * rates.additional_stop_cents, trip.additionalStops, rates.additional_stop_cents);
    if (trip.service !== 'medical_delivery') add('Additional passengers', trip.additionalPassengers * rates.additional_passenger_cents);
    if (trip.service === 'medical_delivery') { if (trip.coldChain) add('Cold-chain', rates.cold_chain_cents); if (trip.signature) add('Signature required', rates.signature_cents); if (trip.rush) add('Rush / priority', rates.rush_cents); }
    const subtotal = lines.reduce((sum, line) => sum + line.cents, 0);
    if (subtotal < rates.minimum_cents) add('Minimum charge adjustment', rates.minimum_cents - subtotal);
  }
  const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  if (!Number.isSafeInteger(totalCents)) throw new Error('Quote exceeds supported currency precision');
  return { currency: 'usd' as const, lines, totalCents };
}