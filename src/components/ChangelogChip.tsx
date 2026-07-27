

/**
 * Hardcoded changelog. Add new entries at the TOP.
 * `date` is ISO; when the latest entry is < 7 days old, the chip turns light green.
 */
export const CHANGELOG: { version: string; date: string; notes: string[] }[] = [
  {
    version: "0.14.0",
    date: "2026-07-27",
    notes: [
      "Redesigned the Review Reservation dialog with a full trip summary, inline editing while Unconfirmed, and 12-hour AM/PM times across the platform.",
      "Added green Approve / red Decline actions with a reason-capture step; declines record a cancel reason and move the trip to Past.",
      "Unconfirmed Reservations now auto-expire after 60 days with 7/3/1-day reminders and an admin extend/restore action.",
      "New Trip creation instantly syncs to the Unconfirmed tab and updates the notification badge across all portals.",
      "Fixed request-a-ride submission errors and added a 'Remember my info' option so patients don't re-enter contact details.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-07-20",
    notes: [
      "Consolidated Trip History into the Trips panel with search, date filters, and financial summaries.",
      "Reservation workflow now carries every New Trip field into the reservation and keeps changes synchronized across portals.",
      "Three-email trip lifecycle: Confirmation on creation, Invoice on acceptance, Details after payment.",
      "Populated the five Florida Dispatch Zones and auto-assign providers, facilities, and patients by ZIP.",
      "Added a universal notification badge system and a dedicated Notifications page with multi-select mark-as-read.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-07-13",
    notes: [
      "Simplified reservation lifecycle: Unconfirmed → Booked → Past, with accepted referrals promoted into Booked automatically.",
      "Round Trip workflow now includes an editable Return Date reflected in quotes, summaries, emails, and PDF exports.",
      "Added Medical Pickups & Deliveries as a new service with dedicated pricing and reservation flow.",
      "Improved multi-leg quote calculation on New Trip and Reservation pages.",
      "Moved HIPAA acknowledgment to a one-time settings step instead of after every trip.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-07-06",
    notes: [
      "Providers are auto-approved on registration; compliance is tracked as Approved / Caution / Denied with real-time sync across portals.",
      "Onboarding tab disappears once complete; non-members see a Soft Access banner with membership-gated features.",
      "Merged New Trip and Reservations into a single Trips panel, and Contacts + Payers into one panel.",
      "Bidirectional Driver ↔ Vehicle assignment with a Primary Driver / Primary Vehicle picker.",
      "Referral Fee Settings added to Provider Account (flat amount or percentage).",
      "48-hour payout hold on standard trips and Net-15 payouts on Medicaid trips, with server-side guards against self-assignment and price tampering.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-07-15",
    notes: [
      "Simplified Driver Pay setup to three clear types: Hourly, Daily Salary, or Independent Contractor (1099).",
      "Only the pay fields that apply to the selected pay type are shown — hourly shows a single hourly rate, daily salary shows a single daily amount, and 1099 contractors show per-pickup-leg, per-trip, per-mile, wait time, and cancellation fee.",
      "Improved: Driver edit dialog is now fully responsive and mobile-friendly, ready for the upcoming Driver mobile app.",
      "Added Driver Earnings & Payment History inside the Vehicles & Drivers tab, with PDF earnings statements you can preview and email to drivers.",
      "Expanded Driver & Vehicle Management to support employee and contractor drivers, service capabilities (Ambulatory, Wheelchair, Gurney/Stretcher), and contractor pricing tied to each driver.",
    ],
  },
  {
    version: "0.9.3",
    date: "2026-07-12",
    notes: [
      "Patients and facilities can create trips without a paid membership.",
      "New Trip form now uses Google Places autofill for pickup and drop-off with a live mileage-based quote.",
      "Added a Payer picker to the New Trip form (facilities and providers).",
      "Trip checkout now enforces that the card used matches the trip's assigned payer.",
    ],
  },
  {
    version: "0.9.2",
    date: "2026-07-11",
    notes: [
      "Replaced header logo with a clean MYFLORIDANEMT bold uppercase wordmark.",
      "Added dedicated service pages for Ambulatory, Wheelchair, and Gurney & Stretcher transportation.",
      "Expanded SEO landing pages for major Florida cities: Jacksonville, Orlando, Tampa, Miami, Tallahassee, and Fort Lauderdale.",
      "Implemented Service schema JSON-LD and breadcrumb navigation across service pages.",
      "Updated XML sitemap to include all service and city landing pages.",
    ],
  },
  {
    version: "0.9.1",
    date: "2026-06-29",
    notes: [
      "Patient submissions now capture appointment time and return pickup/drop-off times.",
      "Dedicated /changelog page replaces the popover — shareable release notes.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-29",
    notes: [
      "Saved payment methods (Stripe-secured) for patients and facilities.",
      "One-click Pay button on confirmed ride requests.",
      "Changelog chip near sign-out.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-22",
    notes: [
      "Facility provider lookup with distance + fare comparison.",
      "Vehicles & Drivers merged with insurance uploads.",
      "DuetRide integration stub.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-15",
    notes: [
      "Provider Network ZIP radius routing (10–50 mi + long-distance).",
      "Reservations, Rules, and Referrals panels.",
      "Google Maps fare estimates ($50 load + $3/mi baseline).",
    ],
  },
];

function daysSince(iso: string): number {
  const then = new Date(iso + "T00:00:00").getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

export function ChangelogChip({ onClick }: { onClick?: () => void }) {
  const latest = CHANGELOG[0];
  const fresh = daysSince(latest.date) <= 7;

  const chipClass = fresh
    ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300"
    : "bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-sm transition-colors ${chipClass}`}
      title={fresh ? "Updated this week — view changelog" : "View changelog"}
    >
      v{latest.version}
      <span className="ml-1 font-medium normal-case opacity-80">
        {fresh ? "· New this week" : "· What's new"}
      </span>
    </button>
  );
}

