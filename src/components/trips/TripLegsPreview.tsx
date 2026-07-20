import { format, parse, isValid } from "date-fns";

export type LegInput = {
  label: string;
  from: string;
  to: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  /** True when this leg's date/time was inherited from the primary pickup */
  inheritedDate?: boolean;
  inheritedTime?: boolean;
  note?: string;
};

function fmtDate(d: string) {
  if (!d) return "—";
  const parsed = parse(d, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? format(parsed, "EEE, MMM d, yyyy") : d;
}
function fmtTime(t: string) {
  if (!t) return "—";
  const parsed = parse(t, "HH:mm", new Date());
  return isValid(parsed) ? format(parsed, "h:mm a") : t;
}

/**
 * Live preview of the trip's legs. Recomputes as the caller changes
 * dates/times/stops. Legs whose date or time inherit from the primary
 * pickup are tagged so users know what will auto-fill vs. what they
 * have already customized.
 */
export function TripLegsPreview({
  legs,
  className,
}: {
  legs: LegInput[];
  className?: string;
}) {
  if (!legs.length) return null;
  const anyInherited = legs.some((l) => l.inheritedDate || l.inheritedTime);

  return (
    <section
      className={`border border-border rounded-sm bg-card ${className ?? ""}`}
      aria-label="Trip legs preview"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Trip legs preview
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live summary — {legs.length} leg{legs.length === 1 ? "" : "s"} total
          </p>
        </div>
        {anyInherited && (
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded-sm">
            Inherits pickup defaults
          </span>
        )}
      </header>
      <ol className="divide-y divide-border">
        {legs.map((leg, i) => (
          <li key={i} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0"
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-bold">{leg.label}</span>
                  {leg.inheritedDate && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      date inherited
                    </span>
                  )}
                  {leg.inheritedTime && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      time inherited
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">
                    {fmtDate(leg.date)}
                  </span>{" "}
                  · {fmtTime(leg.time)}
                </div>
                <div className="text-sm mt-1 break-words">
                  <span className="text-muted-foreground">From</span>{" "}
                  <span className="font-medium">{leg.from || "—"}</span>
                </div>
                <div className="text-sm break-words">
                  <span className="text-muted-foreground">To</span>{" "}
                  <span className="font-medium">{leg.to || "—"}</span>
                </div>
                {leg.note && (
                  <div className="text-xs text-muted-foreground mt-1 italic">
                    {leg.note}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {anyInherited && (
        <footer className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          Legs marked as inherited will use your primary pickup date/time
          unless you edit them.
        </footer>
      )}
    </section>
  );
}
