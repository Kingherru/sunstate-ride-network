import { Link } from "@tanstack/react-router";

/**
 * Hardcoded changelog. Add new entries at the TOP.
 * `date` is ISO; when the latest entry is < 7 days old, the chip turns light green.
 */
export const CHANGELOG: { version: string; date: string; notes: string[] }[] = [
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
      "DueRide integration stub.",
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

export function ChangelogChip() {
  const latest = CHANGELOG[0];
  const fresh = daysSince(latest.date) <= 7;

  const chipClass = fresh
    ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300"
    : "bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-200";

  return (
    <Link
      to="/changelog"
      className={`block w-full text-left text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-sm transition-colors ${chipClass}`}
      title={fresh ? "Updated this week — view changelog" : "View changelog"}
    >
      v{latest.version}
      <span className="ml-1 font-medium normal-case opacity-80">
        {fresh ? "· New this week" : "· What's new"}
      </span>
    </Link>
  );
}

