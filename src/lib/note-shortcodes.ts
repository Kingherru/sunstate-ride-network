/**
 * Smart Notes shortcode parser.
 *
 * Turns a note written with trip shortcodes into a New Trip draft payload.
 * Codes are case-insensitive and accept either `CODE: information` or
 * `CODE information`. Everything the parser cannot place into a real trip-form
 * field is preserved inside Additional Information (specialInstructions), so
 * nothing the user typed is lost. Nothing is ever submitted from a note — the
 * draft form opens for review.
 *
 * Two safeguards keep values from being misread as codes:
 *  - A bare (colonless) code is ignored when a comma precedes it, so a US
 *    address suffix such as "…, Annapolis, MD" stays part of the address.
 *  - A bare (colonless) value code is only accepted when the text after it
 *    actually looks like that kind of value (a date, a time, an address…),
 *    so an ordinary sentence such as "do not call" is not read as a drop-off.
 *    With an explicit colon the value is always taken as written.
 */

import { RECURRENCE_OPTIONS } from "@/lib/request-schemas";

export type ShortcodeGroup = {
  title: string;
  items: { code: string; label: string }[];
};

/** Complete dictionary, shown in the collapsible Shortcode guide. */
export const SHORTCODE_GUIDE: ShortcodeGroup[] = [
  {
    title: "Trip type",
    items: [
      { code: "1W or OW", label: "One way" },
      { code: "RT", label: "Round trip" },
      { code: "MS", label: "Multi-stop" },
      { code: "REC", label: "Recurring trip" },
    ],
  },
  {
    title: "Transportation service",
    items: [
      { code: "AMB", label: "Ambulatory" },
      { code: "WC", label: "Wheelchair (also MWC, PWC)" },
      { code: "STR", label: "Stretcher or gurney (also GUR)" },
      { code: "MD", label: "Medical delivery" },
    ],
  },
  {
    title: "Trip information",
    items: [
      { code: "DATE:", label: "Trip date" },
      { code: "PU:", label: "Pickup address" },
      { code: "PUT:", label: "Requested pickup time" },
      { code: "DO:", label: "Drop-off address" },
      { code: "DOT:", label: "Requested drop-off time" },
      { code: "APT:", label: "Appointment time" },
      { code: "RET:", label: "Return pickup time" },
      { code: "STOP:", label: "Additional stop" },
      { code: "DAYS:", label: "Recurring trip days" },
      { code: "START:", label: "Recurring schedule start date" },
      { code: "END:", label: "Recurring schedule end date" },
      { code: "FREQ:", label: "Recurring frequency" },
    ],
  },
  {
    title: "Rider and contact",
    items: [
      { code: "RIDER:", label: "Rider or patient name" },
      { code: "CONTACT:", label: "Contact person" },
      { code: "PHONE:", label: "Contact phone number" },
      { code: "EMAIL:", label: "Contact email" },
      { code: "PAX:", label: "Number of passengers" },
      { code: "ESCORT:", label: "Escort or attendant information" },
    ],
  },
  {
    title: "Transportation details",
    items: [
      { code: "DRIVER:", label: "Assigned or preferred driver" },
      { code: "VEH:", label: "Assigned or preferred vehicle" },
      { code: "WAIT:", label: "Wait-time instructions" },
      { code: "STAIRS:", label: "Stair information" },
      { code: "EQUIP:", label: "Required equipment" },
      { code: "SIGN:", label: "Signature required" },
      { code: "PAYER:", label: "Payer or billing source" },
      { code: "AUTH:", label: "Authorization or reference number" },
      { code: "RATE:", label: "Agreed or requested trip rate" },
      { code: "NOTES:", label: "Additional trip instructions" },
    ],
  },
  {
    title: "Scheduling and recurrence",
    items: [
      { code: "READY:", label: "Rider ready time" },
      { code: "WILL:", label: "Will-call return" },
      { code: "WINDOW:", label: "Pickup-time window" },
      { code: "DURATION:", label: "Expected appointment or trip duration" },
      { code: "OCC:", label: "Number of occurrences" },
      { code: "EXCEPT:", label: "Dates excluded from recurrence" },
    ],
  },
  {
    title: "Locations",
    items: [
      { code: "STOP1: … STOP5:", label: "Additional stops, in order" },
      { code: "PUZIP:", label: "Pickup ZIP code" },
      { code: "DOZIP:", label: "Drop-off ZIP code" },
      { code: "FAC:", label: "Facility name" },
      { code: "UNIT:", label: "Unit or department" },
      { code: "ROOM:", label: "Room number" },
      { code: "FLOOR:", label: "Floor number" },
      { code: "ENTRANCE:", label: "Required entrance" },
      { code: "GATE:", label: "Gate or access instructions" },
      { code: "PARK:", label: "Parking instructions" },
      { code: "LANDMARK:", label: "Location landmark" },
      { code: "MILES:", label: "Estimated trip mileage" },
    ],
  },
  {
    title: "Rider details",
    items: [
      { code: "DOB:", label: "Date of birth" },
      { code: "REL:", label: "Contact's relationship to rider" },
      { code: "ALT:", label: "Alternate phone number" },
      { code: "LANG:", label: "Preferred language" },
      { code: "CALL:", label: "Calling instructions" },
      { code: "TEXT:", label: "Text-message instructions" },
      { code: "COA:", label: "Call on arrival" },
      { code: "EMC:", label: "Emergency contact information" },
    ],
  },
  {
    title: "Mobility and accessibility",
    items: [
      { code: "WALKER, CANE, RAMP, ELEV, LIFT", label: "Mobility flags" },
      { code: "FOLDWC, WIDEWC, LEGREST, D2D, C2C", label: "Equipment and service flags" },
      { code: "WCSIZE:", label: "Wheelchair dimensions" },
      { code: "ASSIST:", label: "Assistance required" },
      { code: "STEPS:", label: "Number of steps" },
      { code: "TRANSFER:", label: "Transfer-assistance instructions" },
      { code: "HANDOFF:", label: "Required handoff information" },
      { code: "OXY:", label: "Portable oxygen information" },
      { code: "WEIGHT:", label: "Operational weight information" },
      { code: "ANIMAL:", label: "Service animal information" },
      { code: "SEAT:", label: "Seating instructions" },
    ],
  },
  {
    title: "Provider operations",
    items: [
      { code: "WAITMIN:", label: "Expected waiting minutes" },
      { code: "LOAD:, UNLOAD:", label: "Loading and unloading instructions" },
      { code: "TOLL:, PARKFEE:", label: "Toll and parking-fee information" },
      { code: "DISCHARGE:, ADMIT:", label: "Facility discharge and admission" },
      { code: "FLIGHT:, TRAIN:", label: "Flight or train information" },
      { code: "CONFIRM:, ARRIVAL:", label: "Confirmation and arrival instructions" },
      { code: "DRIVERNOTE:, CONTACTNOTE:", label: "Notes for driver or trip contact" },
    ],
  },
  {
    title: "Billing and authorization",
    items: [
      { code: "PAYTYPE:", label: "Payment type" },
      { code: "MEMBER:", label: "Member or policy identifier" },
      { code: "CLAIM:, PO:, INVOICE:", label: "Claim, purchase-order or invoice reference" },
      { code: "COPAY:", label: "Copay amount" },
      { code: "BILLTO:", label: "Billing contact" },
      { code: "BROKER:", label: "Broker information" },
      { code: "PREPAID, SELFPAY, FACPAY, INSPAY", label: "Payment flags for review" },
    ],
  },
  {
    title: "Medical delivery",
    items: [
      { code: "CATEGORY:", label: "Approved delivery category" },
      { code: "ITEM:, QTY:", label: "Item description and quantity" },
      { code: "SIZE:, PKGWT:", label: "Package size and weight" },
      { code: "HANDLING:, TEMP:", label: "Handling and temperature instructions" },
      { code: "PUCONTACT:, DOCONTACT:", label: "Pickup and delivery contacts" },
      { code: "DEADLINE:", label: "Delivery deadline" },
      { code: "FRAGILE", label: "Fragile item" },
      { code: "RETURNITEM:", label: "Return-item instructions" },
    ],
  },
  {
    title: "General",
    items: [
      { code: "PRIORITY:", label: "Operational priority" },
      { code: "ALERT:", label: "Important operational warning" },
      { code: "ACCESS:, PREF:", label: "Access and preference instructions" },
      { code: "SPECIAL:", label: "Special instructions" },
      { code: "FOLLOWUP:", label: "Follow-up reminder" },
      { code: "REF:, SOURCE:, REPEAT:", label: "Reference, source and repeat information" },
    ],
  },
];

/** Codes shown first, in the compact reference beside the note editor. */
export const COMMON_CODES: { code: string; label: string }[] = [
  { code: "1W", label: "One way" },
  { code: "RT", label: "Round trip" },
  { code: "MS", label: "Multi-stop" },
  { code: "REC", label: "Recurring" },
  { code: "AMB", label: "Ambulatory" },
  { code: "WC", label: "Wheelchair" },
  { code: "STR", label: "Stretcher" },
  { code: "DATE:", label: "Trip date" },
  { code: "PU:", label: "Pickup" },
  { code: "PUT:", label: "Pickup time" },
  { code: "DO:", label: "Drop-off" },
  { code: "APT:", label: "Appointment" },
  { code: "RET:", label: "Return time" },
  { code: "RIDER:", label: "Rider name" },
  { code: "PHONE:", label: "Phone" },
  { code: "NOTES:", label: "Instructions" },
];

type Op =
  | { kind: "tripType"; value: "one_way" | "round_trip" | "multi_trip" }
  | { kind: "transport"; value: "ambulatory" | "wheelchair" | "gurney" }
  | { kind: "recurrence" }
  | { kind: "field"; field: string }
  | { kind: "date"; field: string }
  | { kind: "time"; field: string }
  | { kind: "stop" }
  | { kind: "name" }
  | { kind: "phone" }
  | { kind: "email" }
  | { kind: "zip" }
  | { kind: "mobility" }
  | { kind: "note" };

type Def = { code: string; label: string; op: Op; value: boolean };

/** Every recognized code. Colonless entries are accepted only with a shape
 *  guard (see isShapeMatch); flag entries carry no value. */
const DEFS: Def[] = [
  // Trip type
  { code: "1W", label: "One way", op: { kind: "tripType", value: "one_way" }, value: false },
  { code: "OW", label: "One way", op: { kind: "tripType", value: "one_way" }, value: false },
  { code: "RT", label: "Round trip", op: { kind: "tripType", value: "round_trip" }, value: false },
  { code: "MS", label: "Multi-stop", op: { kind: "tripType", value: "multi_trip" }, value: false },
  { code: "REC", label: "Recurring trip", op: { kind: "recurrence" }, value: false },
  // Transportation service
  { code: "AMB", label: "Ambulatory", op: { kind: "transport", value: "ambulatory" }, value: false },
  { code: "WC", label: "Wheelchair", op: { kind: "transport", value: "wheelchair" }, value: false },
  { code: "MWC", label: "Manual wheelchair", op: { kind: "transport", value: "wheelchair" }, value: false },
  { code: "PWC", label: "Power wheelchair", op: { kind: "transport", value: "wheelchair" }, value: false },
  { code: "STR", label: "Stretcher or gurney", op: { kind: "transport", value: "gurney" }, value: false },
  { code: "GUR", label: "Stretcher or gurney", op: { kind: "transport", value: "gurney" }, value: false },
  { code: "SCOOTER", label: "Mobility scooter", op: { kind: "mobility" }, value: false },
  { code: "BARI", label: "Bariatric transportation", op: { kind: "mobility" }, value: false },
  { code: "MD", label: "Medical delivery", op: { kind: "note" }, value: false },
  { code: "DME", label: "Durable medical equipment delivery", op: { kind: "note" }, value: false },
  { code: "SUP", label: "Medical supplies delivery", op: { kind: "note" }, value: false },
  { code: "OTH", label: "Other requested service", op: { kind: "note" }, value: true },
  // Trip information
  { code: "DATE", label: "Trip date", op: { kind: "date", field: "pickupDate" }, value: true },
  { code: "PU", label: "Pickup address", op: { kind: "field", field: "pickupAddress" }, value: true },
  { code: "PUT", label: "Requested pickup time", op: { kind: "time", field: "pickupTime" }, value: true },
  { code: "DO", label: "Drop-off address", op: { kind: "field", field: "dropoffAddress" }, value: true },
  { code: "DOT", label: "Requested drop-off time", op: { kind: "note" }, value: true },
  { code: "APT", label: "Appointment time", op: { kind: "time", field: "appointmentTime" }, value: true },
  { code: "RET", label: "Return pickup time", op: { kind: "time", field: "returnPickupTime" }, value: true },
  { code: "STOP", label: "Additional stop", op: { kind: "stop" }, value: true },
  { code: "STOP1", label: "Stop 1", op: { kind: "stop" }, value: true },
  { code: "STOP2", label: "Stop 2", op: { kind: "stop" }, value: true },
  { code: "STOP3", label: "Stop 3", op: { kind: "stop" }, value: true },
  { code: "STOP4", label: "Stop 4", op: { kind: "stop" }, value: true },
  { code: "STOP5", label: "Stop 5", op: { kind: "stop" }, value: true },
  { code: "DAYS", label: "Recurring trip days", op: { kind: "note" }, value: true },
  { code: "START", label: "Recurring schedule start date", op: { kind: "date", field: "pickupDate" }, value: true },
  { code: "END", label: "Recurring schedule end date", op: { kind: "date", field: "recurrenceEndDate" }, value: true },
  { code: "FREQ", label: "Recurring frequency", op: { kind: "recurrence" }, value: true },
  // Scheduling extras
  { code: "READY", label: "Rider ready time", op: { kind: "note" }, value: true },
  { code: "WILL", label: "Will-call return", op: { kind: "note" }, value: true },
  { code: "WINDOW", label: "Pickup-time window", op: { kind: "note" }, value: true },
  { code: "DURATION", label: "Expected duration", op: { kind: "note" }, value: true },
  { code: "OCC", label: "Number of occurrences", op: { kind: "note" }, value: true },
  { code: "EXCEPT", label: "Excluded dates", op: { kind: "note" }, value: true },
  // Locations
  { code: "PUZIP", label: "Pickup ZIP code", op: { kind: "zip" }, value: true },
  { code: "DOZIP", label: "Drop-off ZIP code", op: { kind: "note" }, value: true },
  { code: "FAC", label: "Facility name", op: { kind: "note" }, value: true },
  { code: "UNIT", label: "Unit or department", op: { kind: "note" }, value: true },
  { code: "ROOM", label: "Room number", op: { kind: "note" }, value: true },
  { code: "FLOOR", label: "Floor number", op: { kind: "note" }, value: true },
  { code: "ENTRANCE", label: "Required entrance", op: { kind: "note" }, value: true },
  { code: "GATE", label: "Gate or access instructions", op: { kind: "note" }, value: true },
  { code: "PARK", label: "Parking instructions", op: { kind: "note" }, value: true },
  { code: "LANDMARK", label: "Location landmark", op: { kind: "note" }, value: true },
  { code: "MILES", label: "Estimated trip mileage", op: { kind: "note" }, value: true },
  // Rider and contact
  { code: "RIDER", label: "Rider or patient name", op: { kind: "name" }, value: true },
  { code: "DOB", label: "Date of birth", op: { kind: "note" }, value: true },
  { code: "CONTACT", label: "Contact person", op: { kind: "note" }, value: true },
  { code: "REL", label: "Contact relationship", op: { kind: "note" }, value: true },
  { code: "PHONE", label: "Contact phone number", op: { kind: "phone" }, value: true },
  { code: "ALT", label: "Alternate phone number", op: { kind: "note" }, value: true },
  { code: "EMAIL", label: "Contact email", op: { kind: "email" }, value: true },
  { code: "PAX", label: "Number of passengers", op: { kind: "note" }, value: true },
  { code: "ESCORT", label: "Escort or attendant", op: { kind: "note" }, value: true },
  { code: "LANG", label: "Preferred language", op: { kind: "note" }, value: true },
  { code: "CALL", label: "Calling instructions", op: { kind: "note" }, value: true },
  { code: "TEXT", label: "Text-message instructions", op: { kind: "note" }, value: true },
  { code: "COA", label: "Call on arrival", op: { kind: "note" }, value: false },
  { code: "EMC", label: "Emergency contact", op: { kind: "note" }, value: true },
  // Mobility and accessibility
  { code: "WALKER", label: "Rider uses a walker", op: { kind: "mobility" }, value: false },
  { code: "CANE", label: "Rider uses a cane", op: { kind: "mobility" }, value: false },
  { code: "FOLDWC", label: "Foldable wheelchair", op: { kind: "mobility" }, value: false },
  { code: "LEGREST", label: "Wheelchair leg rest", op: { kind: "mobility" }, value: false },
  { code: "WIDEWC", label: "Wide wheelchair", op: { kind: "mobility" }, value: false },
  { code: "WCSIZE", label: "Wheelchair dimensions", op: { kind: "mobility" }, value: true },
  { code: "ASSIST", label: "Assistance required", op: { kind: "mobility" }, value: true },
  { code: "STAIRS", label: "Stair information", op: { kind: "mobility" }, value: true },
  { code: "STEPS", label: "Number of steps", op: { kind: "mobility" }, value: true },
  { code: "RAMP", label: "Ramp available or required", op: { kind: "mobility" }, value: false },
  { code: "ELEV", label: "Elevator available", op: { kind: "mobility" }, value: false },
  { code: "LIFT", label: "Vehicle lift required", op: { kind: "mobility" }, value: false },
  { code: "TRANSFER", label: "Transfer assistance", op: { kind: "mobility" }, value: true },
  { code: "D2D", label: "Door-to-door", op: { kind: "mobility" }, value: false },
  { code: "C2C", label: "Couch-to-couch", op: { kind: "mobility" }, value: false },
  { code: "HANDOFF", label: "Required handoff", op: { kind: "mobility" }, value: true },
  { code: "OXY", label: "Portable oxygen", op: { kind: "mobility" }, value: true },
  { code: "WEIGHT", label: "Operational weight", op: { kind: "mobility" }, value: true },
  { code: "ANIMAL", label: "Service animal", op: { kind: "mobility" }, value: true },
  { code: "EQUIP", label: "Required equipment", op: { kind: "mobility" }, value: true },
  { code: "SEAT", label: "Seating instructions", op: { kind: "mobility" }, value: true },
  // Provider operations
  { code: "DRIVER", label: "Preferred driver", op: { kind: "note" }, value: true },
  { code: "VEH", label: "Preferred vehicle", op: { kind: "note" }, value: true },
  { code: "WAIT", label: "Wait-time instructions", op: { kind: "note" }, value: true },
  { code: "WAITMIN", label: "Expected waiting minutes", op: { kind: "note" }, value: true },
  { code: "LOAD", label: "Loading instructions", op: { kind: "note" }, value: true },
  { code: "UNLOAD", label: "Unloading instructions", op: { kind: "note" }, value: true },
  { code: "TOLL", label: "Toll information", op: { kind: "note" }, value: true },
  { code: "PARKFEE", label: "Parking-fee information", op: { kind: "note" }, value: true },
  { code: "DISCHARGE", label: "Facility discharge", op: { kind: "note" }, value: true },
  { code: "ADMIT", label: "Facility admission", op: { kind: "note" }, value: true },
  { code: "FLIGHT", label: "Flight information", op: { kind: "note" }, value: true },
  { code: "TRAIN", label: "Train information", op: { kind: "note" }, value: true },
  { code: "CONFIRM", label: "Confirmation instructions", op: { kind: "note" }, value: true },
  { code: "ARRIVAL", label: "Arrival instructions", op: { kind: "note" }, value: true },
  { code: "DRIVERNOTE", label: "Note for the driver", op: { kind: "note" }, value: true },
  { code: "CONTACTNOTE", label: "Note for the trip contact", op: { kind: "note" }, value: true },
  // Billing and authorization
  { code: "PAYER", label: "Payer or billing source", op: { kind: "note" }, value: true },
  { code: "PAYTYPE", label: "Payment type", op: { kind: "note" }, value: true },
  { code: "AUTH", label: "Authorization number", op: { kind: "note" }, value: true },
  { code: "MEMBER", label: "Member or policy identifier", op: { kind: "note" }, value: true },
  { code: "CLAIM", label: "Claim number", op: { kind: "note" }, value: true },
  { code: "PO", label: "Purchase-order number", op: { kind: "note" }, value: true },
  { code: "RATE", label: "Requested or agreed rate", op: { kind: "note" }, value: true },
  { code: "COPAY", label: "Copay amount", op: { kind: "note" }, value: true },
  { code: "BILLTO", label: "Billing contact", op: { kind: "note" }, value: true },
  { code: "INVOICE", label: "Invoice reference", op: { kind: "note" }, value: true },
  { code: "PREPAID", label: "Marked prepaid for review", op: { kind: "note" }, value: false },
  { code: "SELFPAY", label: "Private-pay trip", op: { kind: "note" }, value: false },
  { code: "FACPAY", label: "Facility-paid trip", op: { kind: "note" }, value: false },
  { code: "INSPAY", label: "Insurance-paid trip", op: { kind: "note" }, value: false },
  { code: "BROKER", label: "Broker information", op: { kind: "note" }, value: true },
  // Medical delivery
  { code: "CATEGORY", label: "Delivery category", op: { kind: "note" }, value: true },
  { code: "ITEM", label: "Item description", op: { kind: "note" }, value: true },
  { code: "QTY", label: "Item quantity", op: { kind: "note" }, value: true },
  { code: "SIZE", label: "Package dimensions", op: { kind: "note" }, value: true },
  { code: "PKGWT", label: "Package weight", op: { kind: "note" }, value: true },
  { code: "HANDLING", label: "Handling instructions", op: { kind: "note" }, value: true },
  { code: "TEMP", label: "Temperature-handling instructions", op: { kind: "note" }, value: true },
  { code: "SIGN", label: "Signature required", op: { kind: "note" }, value: true },
  { code: "PUCONTACT", label: "Pickup contact", op: { kind: "note" }, value: true },
  { code: "DOCONTACT", label: "Delivery contact", op: { kind: "note" }, value: true },
  { code: "DEADLINE", label: "Delivery deadline", op: { kind: "note" }, value: true },
  { code: "FRAGILE", label: "Fragile item", op: { kind: "note" }, value: false },
  { code: "RETURNITEM", label: "Return-item instructions", op: { kind: "note" }, value: true },
  // General
  { code: "PRIORITY", label: "Operational priority", op: { kind: "note" }, value: true },
  { code: "ALERT", label: "Operational warning", op: { kind: "note" }, value: true },
  { code: "ACCESS", label: "Access instructions", op: { kind: "note" }, value: true },
  { code: "PREF", label: "Rider or facility preference", op: { kind: "note" }, value: true },
  { code: "SPECIAL", label: "Special instructions", op: { kind: "note" }, value: true },
  { code: "NOTES", label: "Additional instructions", op: { kind: "note" }, value: true },
  { code: "FOLLOWUP", label: "Follow-up reminder", op: { kind: "note" }, value: true },
  { code: "REF", label: "Internal reference", op: { kind: "note" }, value: true },
  { code: "SOURCE", label: "Request source", op: { kind: "note" }, value: true },
  { code: "REPEAT", label: "Repeats on recurring drafts", op: { kind: "note" }, value: true },
];

const BY_CODE = new Map(DEFS.map((d) => [d.code, d]));
/** Longest first so STOP1 wins over STOP and WCSIZE over WC. */
const CODES_BY_LENGTH = [...BY_CODE.keys()].sort((a, b) => b.length - a.length);
const FIND = new RegExp(`\\b(${CODES_BY_LENGTH.join("|")})(?::|(?=[\\s,]|$))`, "gi");

const NOTE_LIMIT = 1000;
const MOBILITY_LIMIT = 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return buildDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (m) {
    const y = +m[3] < 100 ? +m[3] + 2000 : +m[3];
    return buildDate(y, +m[1], +m[2]);
  }
  return null;
}

function buildDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function normalizeTime(raw: string): string | null {
  const m = /^([01]?\d|2[0-3])[:.](\d{2})\s*([AaPp]\.?[Mm]\.?)?$/.exec(raw.trim());
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  if (min > 59) return null;
  const ap = (m[3] ?? "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h !== 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** "123 Main St, Jacksonville, FL" → pickup "123 Main St" / city "Jacksonville". */
export function splitAddress(raw: string): { address: string; city: string } {
  const s = raw.trim().replace(/[,.\s]+$/, "");
  const three = /^(.*?),\s*([^,]+?),\s*([A-Za-z]{2})$/.exec(s);
  if (three) return { address: three[1].trim(), city: three[2].trim() };
  const two = /^(.*?),\s*([^,]+)$/.exec(s);
  if (two && !/\b\d{5}$/.test(s)) return { address: two[1].trim(), city: two[2].trim() };
  return { address: s, city: "" };
}

function isDateLike(v: string) {
  return normalizeDate(v) !== null;
}
function isTimeLike(v: string) {
  return normalizeTime(v) !== null;
}
function isAddressLike(v: string) {
  return /\d/.test(v) || /,/.test(v);
}
function isPhoneLike(v: string) {
  return /^[\s+().-]*\d[\d\s+().-]{5,}$/.test(v);
}
function isEmailLike(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
function isZipLike(v: string) {
  return /^\d{5}(-\d{4})?$/.test(v.trim());
}
function isNumberLike(v: string) {
  return /^\d{1,3}$/.test(v.trim());
}

/** Bare (colonless) values need the text after the code to look like the
 *  value that code carries. With a colon the value is always accepted. */
function shapeMatches(def: Def, value: string): boolean {
  if (!def.value) return true;
  const op = def.op;
  if (op.kind === "date") return isDateLike(value);
  if (op.kind === "time") return isTimeLike(value);
  if (op.kind === "phone") return isPhoneLike(value);
  if (op.kind === "email") return isEmailLike(value);
  if (op.kind === "zip") return isZipLike(value);
  if (op.kind === "field" && (op.field === "pickupAddress" || op.field === "dropoffAddress")) return isAddressLike(value);
  if (op.kind === "stop") return isAddressLike(value);
  if (op.kind === "recurrence") return true;
  if (op.kind === "note" || op.kind === "mobility" || op.kind === "name") return value.length > 0;
  return true;
}

export type ParsedNote = {
  /** Fields the trip form restores (keys match the New Trip form). */
  payload: Record<string, unknown>;
  /** Codes that were placed into a form field. */
  placed: { code: string; label: string }[];
  /** Codes and free text kept inside Additional Information. */
  held: string[];
  /** Values written as a recognizable code but not understood. */
  unreadable: string[];
};

/** Parses note text into a New Trip draft payload. Pure — no network, storage
 *  or side effects; the caller saves it as an unsubmitted draft. */
export function parseNoteShortcodes(text: string): ParsedNote {
  const payload: Record<string, unknown> = {};
  const placed: { code: string; label: string }[] = [];
  const held: string[] = [];
  const unreadable: string[] = [];
  const notes: string[] = [];
  const mobility: string[] = [];
  const stops: { address: string; city: string; pickupTime: string; note: string }[] = [];
  let recurrenceRequested = false;
  let recurrenceSet = false;

  const addNote = (line: string) => {
    if (line.trim()) notes.push(line.trim());
  };
  const addMobility = (line: string) => {
    if (line.trim()) mobility.push(line.trim());
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const found: { def: Def; start: number; end: number; colon: boolean }[] = [];
    for (const m of line.matchAll(FIND)) {
      const code = m[1].toUpperCase();
      const def = BY_CODE.get(code);
      if (!def) continue;
      const after = line[(m.index ?? 0) + m[1].length];
      const colon = after === ":";
      // "…, Annapolis, MD" — a comma means the word belongs to the value before it.
      if (!colon) {
        const before = line.slice(0, m.index).replace(/\s+$/, "");
        if (before.endsWith(",")) continue;
      }
      found.push({ def, start: m.index ?? 0, end: (m.index ?? 0) + m[1].length + (colon ? 1 : 0), colon });
    }

    // Text before the first recognized code is the user's own wording.
    const lead = found.length ? line.slice(0, found[0].start) : line;
    if (lead.trim()) {
      if (found.length) held.push(lead.trim());
      else addNote(line.trim());
    }

    found.forEach((hit, i) => {
      const next = found[i + 1];
      const value = (next ? line.slice(hit.end, next.start) : line.slice(hit.end)).trim();
      const { def, colon } = hit;
      if (!def.value) {
        applyFlag(def);
        return;
      }
      if (!colon && !shapeMatches(def, value)) {
        // Not the value this code carries — keep the wording the user typed.
        held.push(line.slice(hit.start, next ? next.start : line.length).trim());
        return;
      }
      applyValue(def, value, colon);
    });
  }

  function applyFlag(def: Def) {
    const op = def.op;
    if (op.kind === "tripType") {
      payload.tripType = op.value;
      if (op.value === "round_trip") payload.roundTrip = true;
      placed.push({ code: def.code, label: def.label });
    } else if (op.kind === "transport") {
      payload.transportType = op.value;
      placed.push({ code: def.code, label: def.label });
    } else if (op.kind === "recurrence") {
      recurrenceRequested = true;
      placed.push({ code: def.code, label: def.label });
    } else if (op.kind === "mobility") {
      addMobility(`${def.label} (flagged in note)`);
      placed.push({ code: def.code, label: def.label });
    } else {
      held.push(def.label);
    }
  }

  function applyValue(def: Def, value: string, colon: boolean) {
    const op = def.op;
    if (!value) {
      unreadable.push(`${def.code}: (no value given)`);
      return;
    }
    switch (op.kind) {
      case "date": {
        const d = normalizeDate(value);
        if (!d) {
          unreadable.push(`${def.code}: ${value}`);
          return;
        }
        if (payload[op.field] === undefined) {
          payload[op.field] = d;
          placed.push({ code: def.code, label: def.label });
        } else {
          held.push(`${def.label}: ${value}`);
        }
        return;
      }
      case "time": {
        const t = normalizeTime(value);
        if (!t) {
          unreadable.push(`${def.code}: ${value}`);
          return;
        }
        payload[op.field] = t;
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "field": {
        if (op.field === "pickupAddress" || op.field === "dropoffAddress") {
          const { address, city } = splitAddress(value);
          payload[op.field] = address;
          const cityField = op.field === "pickupAddress" ? "pickupCity" : "dropoffCity";
          if (city) payload[cityField] = city;
          placed.push({ code: def.code, label: def.label });
          return;
        }
        payload[op.field] = value;
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "stop": {
        const { address, city } = splitAddress(value);
        stops.push({ address, city, pickupTime: "", note: "" });
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "name": {
        const parts = value.split(/\s+/).filter(Boolean);
        if (parts.length === 1) payload.patientFirstName = parts[0];
        else {
          payload.patientFirstName = parts[0];
          payload.patientLastName = parts.slice(1).join(" ");
        }
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "phone": {
        if (!isPhoneLike(value)) {
          unreadable.push(`${def.code}: ${value}`);
          return;
        }
        payload.patientPhone = value.trim();
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "email": {
        if (!isEmailLike(value)) {
          unreadable.push(`${def.code}: ${value}`);
          return;
        }
        payload.patientEmail = value.trim();
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "zip": {
        if (!isZipLike(value)) {
          unreadable.push(`${def.code}: ${value}`);
          return;
        }
        payload.pickupAddressDetails = joinDetails(payload.pickupAddressDetails, `${def.label}: ${value.trim()}`);
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "mobility": {
        addMobility(`${def.label}: ${value}`);
        placed.push({ code: def.code, label: def.label });
        return;
      }
      case "recurrence": {
        const v = value.trim().toLowerCase().replace(/[^a-z]/g, "");
        const match = RECURRENCE_OPTIONS.find((o) => o !== "none" && (o === v || v.startsWith(o)));
        if (!match) {
          unreadable.push(`${def.code}: ${value}`);
          return;
        }
        payload.recurrence = match;
        recurrenceSet = true;
        placed.push({ code: def.code, label: def.label });
        return;
      }
      default: {
        addNote(`${def.label}: ${value}`);
        placed.push({ code: def.code, label: def.label });
        return;
      }
    }
  }

  if (stops.length) payload.additionalStops = stops.slice(0, 10);
  if (recurrenceRequested && !recurrenceSet && payload.recurrence === undefined) {
    unreadable.push("REC: needs a frequency — choose one in the form (FREQ: daily, weekly, …)");
  }

  const special = [...held, ...notes].join("\n").trim();
  if (special) payload.specialInstructions = special.slice(0, NOTE_LIMIT);
  if (mobility.length) payload.mobilityNotes = mobility.join("\n").slice(0, MOBILITY_LIMIT);

  return { payload, placed, held: [...held, ...unreadable], unreadable };
}

function joinDetails(current: unknown, addition: string) {
  const base = typeof current === "string" ? current : "";
  return base ? `${base}\n${addition}` : addition;
}
