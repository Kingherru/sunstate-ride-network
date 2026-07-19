import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CHANGELOG } from "@/components/ChangelogChip";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — My Florida NEMT" },
      { name: "description", content: "What's new on My Florida NEMT — recent releases, fixes, and improvements across the patient, provider, and facility portals." },
      { property: "og:title", content: "Changelog — My Florida NEMT" },
      { property: "og:description", content: "Recent releases, fixes, and improvements across My Florida NEMT." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://myfloridanemt.com/changelog" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/changelog" }],
  }),
  component: ChangelogPage,
});

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

function ChangelogPage() {
  const latest = CHANGELOG[0];
  const fresh = latest ? daysSince(latest.date) <= 7 : false;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Portal-style sidebar */}
      <aside className="w-64 shrink-0 bg-[oklch(0.20_0.05_257)] text-white min-h-screen flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 mb-5">
            <span className="size-7 bg-[oklch(0.872_0.078_65.2)] grid place-items-center font-display font-bold text-[oklch(0.18_0.05_257)] text-sm">F</span>
            <span className="font-display font-bold text-base tracking-tight uppercase">My Florida NEMT</span>
          </Link>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.10_195)] mb-1">
            Release notes
          </div>
          <div className="font-display text-lg font-bold tracking-tight">Changelog</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {CHANGELOG.map((c, i) => (
            <a
              key={c.version}
              href={`#v${c.version}`}
              className="relative block w-full text-left pl-4 pr-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            >
              {i === 0 && fresh && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[oklch(0.872_0.078_65.2)]" />
              )}
              <span className="inline-flex items-center gap-2">
                v{c.version}
                {i === 0 && fresh && (
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-sm">
                    New
                  </span>
                )}
              </span>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 mt-0.5">{c.date}</div>
            </a>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-xs space-y-2">
          <Link to="/dashboard" className="font-bold uppercase tracking-wider text-white/70 hover:text-white text-[11px] flex items-center gap-1.5">
            <ArrowLeft className="w-3 h-3" /> Back to dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 bg-card border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
            florida nemt / changelog
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span className="font-mono uppercase tracking-wider text-muted-foreground">Live</span>
            <span className="size-2 rounded-full bg-[oklch(0.872_0.078_65.2)] animate-pulse" />
          </div>
        </div>

        <div className="px-8 py-7 space-y-7 max-w-5xl">
          {/* Hero */}
          <div className="pb-2 border-b border-border">
            <div className="text-xs font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.04_220)] mb-2">
              My Florida NEMT · release notes
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-brand">
              {latest ? `What's new in v${latest.version}` : "Release notes"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Every meaningful change shipped across the patient, provider, and facility portals.
            </p>
          </div>

          {CHANGELOG.map((entry, idx) => {
            const isFresh = idx === 0 && fresh;
            return (
              <section
                id={`v${entry.version}`}
                key={entry.version}
                className="bg-card border border-border shadow-card scroll-mt-24"
              >
                <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-xl font-bold tracking-tight">v{entry.version}</h2>
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
                      <li key={i} className="flex items-start gap-3 px-6 py-3">
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

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-[oklch(0.18_0.05_257)] text-white border-l-4 border-[oklch(0.872_0.078_65.2)]">
            <div>
              <h3 className="font-display text-lg font-bold mb-1">Back to your dashboard</h3>
              <p className="text-sm text-white/70">Pick up where you left off.</p>
            </div>
            <Link
              to="/dashboard"
              className="px-6 py-3 bg-[oklch(0.872_0.078_65.2)] text-[oklch(0.18_0.05_257)] font-bold uppercase tracking-wider text-xs rounded-sm flex items-center gap-2 hover:opacity-90 transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4" strokeWidth={2.5} />
              Open Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
