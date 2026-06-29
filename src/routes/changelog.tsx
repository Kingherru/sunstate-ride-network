import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CHANGELOG } from "@/components/ChangelogChip";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — Florida NEMT" },
      { name: "description", content: "What's new on Florida NEMT — recent releases, fixes, and improvements across the patient, provider, and facility portals." },
      { property: "og:title", content: "Changelog — Florida NEMT" },
      { property: "og:description", content: "Recent releases, fixes, and improvements across Florida NEMT." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://floridanemt.com/changelog" }],
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
    <div className="relative w-full min-h-screen bg-[#020617] text-white selection:bg-[#f97316]/30 overflow-hidden">
      <div
      <div aria-hidden className="pointer-events-none absolute inset-0" />


      {/* Nav */}
      <nav className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-[#f97316] to-[#fbbf24] flex items-center justify-center font-extrabold text-[#0b1d3a] tracking-tighter">
            F
          </div>
          <span className="font-extrabold text-xl tracking-tight">Florida NEMT</span>
        </div>
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </nav>

      {/* Header */}
      <section className="relative max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#f97316]/10 border border-[#f97316]/25 text-[#fbbf24] text-xs font-bold uppercase tracking-widest mb-3">
              <span className={`w-1.5 h-1.5 rounded-full ${fresh ? "bg-emerald-400 animate-pulse" : "bg-[#f97316]"}`} />
              Changelog
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
              {latest ? `What's new in v${latest.version}` : "Release notes"}
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Every meaningful change shipped across the patient, provider, and facility portals.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {CHANGELOG.slice().reverse().map((c, i, arr) => (
              <span key={c.version} className="flex items-center gap-2">
                <span
                  className={
                    i === arr.length - 1
                      ? "px-2 py-1 rounded-sm border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]"
                      : "px-2 py-1 rounded-sm border border-white/10 bg-white/5"
                  }
                >
                  v{c.version}
                </span>
                {i < arr.length - 1 && <span>→</span>}
              </span>
            ))}
          </div>
        </div>

        {CHANGELOG.map((entry, idx) => {
          const isFresh = idx === 0 && fresh;
          return (
            <div key={entry.version} className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-extrabold text-white">v{entry.version}</h2>
                <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">{entry.date}</span>
                {isFresh && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-sm">
                    New this week
                  </span>
                )}
              </div>
              <ul className="rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent divide-y divide-white/5">
                {entry.notes.map((note, i) => {
                  const tag = inferTag(note);
                  return (
                    <li key={i} className="flex items-start gap-3 px-4 sm:px-5 py-3">
                      <span
                        className={
                          "shrink-0 mt-0.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest w-[88px] text-center " +
                          (tag === "New"
                            ? "bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/25"
                            : tag === "Improved"
                              ? "bg-[#f97316]/10 text-[#fb923c] border border-[#f97316]/25"
                              : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25")
                        }
                      >
                        {tag}
                      </span>
                      <p className="text-sm text-slate-300 leading-relaxed">{note}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="relative max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-sm border border-white/10 bg-gradient-to-r from-[#f97316]/10 to-[#fbbf24]/10">
          <div>
            <h3 className="text-lg font-extrabold mb-1">Back to your dashboard</h3>
            <p className="text-sm text-slate-400">Pick up where you left off.</p>
          </div>
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-gradient-to-r from-[#f97316] to-[#fbbf24] text-[#0b1d3a] font-extrabold rounded-sm flex items-center gap-2 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] transition-all transform hover:-translate-y-0.5 shrink-0"
          >
            <Sparkles className="w-4 h-4" strokeWidth={2.5} />
            Open Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
