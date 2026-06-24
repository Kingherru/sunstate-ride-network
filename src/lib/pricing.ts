// Pure pricing calculator — safe for browser and server.

export interface PricingRates {
  base_pickup: number;
  per_mile: number;
  wait_per_min: number;
  no_show: number;
  cancellation: number;
  wheelchair_addon: number;
  stretcher_addon: number;
  after_hours_addon: number;
  holiday_surcharge: number;
  additional_passenger: number;
  minimum_fare: number;
  after_hours_start: string; // "HH:MM" or "HH:MM:SS"
  after_hours_end: string;
  holidays: string[]; // YYYY-MM-DD
}

export interface TripCostInput {
  status?: string | null;
  miles?: number | null;
  wait_minutes?: number | null;
  transport_type?: string | null;
  additional_passengers?: number | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
}

export interface CostLine { label: string; amount: number }
export interface CostBreakdown { lines: CostLine[]; total: number }

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function isAfterHours(time: string | null | undefined, startStr: string, endStr: string): boolean {
  if (!time) return false;
  const t = toMin(time);
  const s = toMin(startStr);
  const e = toMin(endStr);
  // If window crosses midnight (e.g. 19:00–07:00)
  return s < e ? t >= s && t < e : t >= s || t < e;
}

export function calculateTripCost(trip: TripCostInput, rates: PricingRates): CostBreakdown {
  const lines: CostLine[] = [];

  if (trip.status === "no_show") {
    if (rates.no_show > 0) lines.push({ label: "No-show fee", amount: rates.no_show });
    const total = sum(lines);
    return { lines, total };
  }
  if (trip.status === "canceled") {
    if (rates.cancellation > 0) lines.push({ label: "Cancellation fee", amount: rates.cancellation });
    return { lines, total: sum(lines) };
  }

  if (rates.base_pickup > 0) lines.push({ label: "Base pickup", amount: rates.base_pickup });
  const miles = Number(trip.miles ?? 0);
  if (miles > 0 && rates.per_mile > 0) {
    lines.push({ label: `Mileage (${miles.toFixed(1)} mi × $${rates.per_mile.toFixed(2)})`, amount: +(miles * rates.per_mile).toFixed(2) });
  }
  const wait = Number(trip.wait_minutes ?? 0);
  if (wait > 0 && rates.wait_per_min > 0) {
    lines.push({ label: `Wait time (${wait} min × $${rates.wait_per_min.toFixed(2)})`, amount: +(wait * rates.wait_per_min).toFixed(2) });
  }
  if (trip.transport_type === "wheelchair" && rates.wheelchair_addon > 0) {
    lines.push({ label: "Wheelchair add-on", amount: rates.wheelchair_addon });
  }
  if (trip.transport_type === "stretcher" && rates.stretcher_addon > 0) {
    lines.push({ label: "Stretcher add-on", amount: rates.stretcher_addon });
  }
  if (isAfterHours(trip.pickup_time, rates.after_hours_start, rates.after_hours_end) && rates.after_hours_addon > 0) {
    lines.push({ label: "After-hours surcharge", amount: rates.after_hours_addon });
  }
  if (trip.pickup_date && rates.holidays?.includes(trip.pickup_date) && rates.holiday_surcharge > 0) {
    lines.push({ label: "Holiday surcharge", amount: rates.holiday_surcharge });
  }
  const extra = Number(trip.additional_passengers ?? 0);
  if (extra > 0 && rates.additional_passenger > 0) {
    lines.push({ label: `Additional passengers (${extra} × $${rates.additional_passenger.toFixed(2)})`, amount: +(extra * rates.additional_passenger).toFixed(2) });
  }
  let total = sum(lines);
  if (total < rates.minimum_fare) {
    lines.push({ label: "Minimum fare adjustment", amount: +(rates.minimum_fare - total).toFixed(2) });
    total = rates.minimum_fare;
  }
  return { lines, total: +total.toFixed(2) };
}

function sum(lines: CostLine[]) {
  return +lines.reduce((a, l) => a + l.amount, 0).toFixed(2);
}

export const DEFAULT_RATES: PricingRates = {
  base_pickup: 0, per_mile: 0, wait_per_min: 0, no_show: 0, cancellation: 0,
  wheelchair_addon: 0, stretcher_addon: 0, after_hours_addon: 0, holiday_surcharge: 0,
  additional_passenger: 0, minimum_fare: 0,
  after_hours_start: "19:00", after_hours_end: "07:00", holidays: [],
};
