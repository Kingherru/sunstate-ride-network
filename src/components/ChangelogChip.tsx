import { useState } from "react";

/**
 * Hardcoded changelog. Add new entries at the TOP.
 * `date` is ISO; when the latest entry is < 7 days old, the chip turns light green.
 */
export const CHANGELOG: { version: string; date: string; notes: string[] }[] = [
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
  const [open, setOpen] = useState(false);
  const latest = CHANGELOG[0];
  const fresh = daysSince(latest.date) <= 7;

  const chipClass = fresh
    ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300"
    : "bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-200";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-sm transition-colors ${chipClass}`}
        title={fresh ? "Updated this week" : "No recent changes"}
      >
        v{latest.version}
        <span className="ml-1 font-medium normal-case opacity-80">
          {fresh ? "· New this week" : "· What's new"}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bottom-full mb-2 left-0 w-72 max-h-80 overflow-auto bg-card border border-border rounded-sm shadow-lg">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <h4 className="text-sm font-extrabold">Changelog</h4>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <ul className="divide-y divide-border">
              {CHANGELOG.map((entry, i) => {
                const isFresh = i === 0 && fresh;
                return (
                  <li key={entry.version} className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">v{entry.version}</span>
                      <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      {isFresh && (
                        <span className="ml-auto text-[10px] font-bold uppercase bg-green-100 text-green-800 px-1.5 py-0.5 rounded-sm">
                          New
                        </span>
                      )}
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      {entry.notes.map((n, j) => <li key={j}>{n}</li>)}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
