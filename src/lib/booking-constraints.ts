/**
 * Booking constraint constants + helpers for trip / ride pickup date & time.
 *
 * Rules applied consistently across New Trip (dashboard) and Request-a-Ride:
 *  - Minimum lead time: pickup must be at least MIN_LEAD_MINUTES in the future.
 *  - Allowable date range: today .. today + MAX_ADVANCE_DAYS.
 *  - Past / invalid dates are disabled in the calendar.
 */

export const MIN_LEAD_MINUTES = 120; // 2 hours minimum notice
export const MAX_ADVANCE_DAYS = 365; // 1 year booking window

/** ISO YYYY-MM-DD in the local timezone. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** HH:MM in the local timezone. */
export function toHm(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Earliest allowable pickup instant (now + lead time). */
export function earliestPickup(now: Date = new Date()): Date {
  const d = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);
  return d;
}

/** Latest allowable pickup instant. */
export function latestPickup(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + MAX_ADVANCE_DAYS);
  return d;
}

/** Minimum ISO date users may pick (today if lead time still fits today, else tomorrow). */
export function minPickupDate(now: Date = new Date()): string {
  const earliest = earliestPickup(now);
  // If the earliest instant falls on a later calendar day (e.g. lead time crosses midnight),
  // the calendar's earliest selectable day is that day.
  return toIsoDate(earliest);
}

/** Maximum ISO date users may pick. */
export function maxPickupDate(now: Date = new Date()): string {
  return toIsoDate(latestPickup(now));
}

/**
 * Given a selected pickup date, return the minimum HH:MM allowed for that date.
 * Returns "" when the date is in the future (any time is fine).
 */
export function minPickupTimeForDate(dateIso: string, now: Date = new Date()): string {
  if (!dateIso) return "";
  const earliest = earliestPickup(now);
  const earliestDate = toIsoDate(earliest);
  if (dateIso < earliestDate) return "23:59"; // date is invalid — force failure
  if (dateIso === earliestDate) return toHm(earliest);
  return "";
}

/** Validate a date+time combo. Returns error message or null. */
export function validatePickupDateTime(
  dateIso: string,
  timeHm: string,
  now: Date = new Date(),
): string | null {
  if (!dateIso) return "Pickup date is required";
  const min = minPickupDate(now);
  const max = maxPickupDate(now);
  if (dateIso < min) return `Pickup must be on or after ${min}`;
  if (dateIso > max) return `Pickup must be on or before ${max}`;
  if (timeHm) {
    const minTime = minPickupTimeForDate(dateIso, now);
    if (minTime && timeHm < minTime) {
      return `Pickup must be at least ${Math.round(MIN_LEAD_MINUTES / 60)}h from now (earliest ${minTime})`;
    }
  }
  return null;
}
