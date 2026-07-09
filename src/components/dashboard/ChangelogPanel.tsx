import { CHANGELOG } from "@/components/ChangelogChip";

function daysSince(iso: string): number {
  const then = new Date(iso + "T00:00:00").getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

type Tag = "New" | "Improved" | "Fixed";

function inferTag(note: string): Tag {
  const n = note.toLowerCase();
  if (n.startsWith("fix") || n.includes("fixed") || n.includes("bug")) return "Fixed";
  if (n.startsWith("improve") || n.includes("updated") || n.includes("merged") || n.includes("restyled")) return "Improved";
  return "New";
}

export function ChangelogPanel() {
  const latest = CHANGELOG[0];
  const fresh = latest ? daysSince(latest.date) <= 7 : false;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.04_220)] mb-2">
          Florida NEMT · release notes
        </div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">
          {latest ? `What's new in v${latest.version}` : "Release notes"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Every meaningful change shipped across the patient, provider, and facility portals.
        </p>
      </div>

      {CHANGELOG.map((entry, idx) => {
        const isFresh = idx === 0 && fresh;
        return (
          <section
            key={entry.version}
            className="bg-card border border-border shadow-card rounded-sm"
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-lg font-bold tracking-tight">v{entry.version}</h3>
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  {entry.date}
                </span>
                {isFresh && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded-sm">
                    New this week
                  </span>
                )}
              </div>
            </div>
            <ul className="divide-y divide-border">
              {entry.notes.map((note, i) => {
                const tag = inferTag(note);
                return (
                  <li key={i} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={
                        "shrink-0 mt-0.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest w-[88px] text-center border " +
                        (tag === "New"
                          ? "bg-[oklch(0.96_0.05_75)] text-[oklch(0.35_0.12_45)] border-[oklch(0.872_0.078_65.2)]"
                          : tag === "Improved"
                            ? "bg-[oklch(0.96_0.03_220)] text-[oklch(0.30_0.08_240)] border-[oklch(0.78_0.10_220)]"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200")
                      }
                    >
                      {tag}
                    </span>
                    <p className="text-sm text-foreground/90 leading-relaxed">{note}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
