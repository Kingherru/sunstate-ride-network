import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Clock, Calendar } from "lucide-react";
import { CATEGORIES, getAllPosts, type Category, type Post } from "@/content/blog";

export const Route = createFileRoute("/resources/")({
  head: () => ({
    meta: [
      { title: "Blog & Resources — MyFloridaNemt.com" },
      {
        name: "description",
        content:
          "The MyFloridaNemt.com blog: guides, playbooks, and reference articles for patients, caregivers, providers, and dispatchers across Florida's non-emergency medical transportation industry.",
      },
      { property: "og:title", content: "MyFloridaNemt.com Blog & Resources" },
      { property: "og:description", content: "Search NEMT guides for patients, providers, caregivers, and Florida transportation planners." },
      { property: "og:url", content: "/resources" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/resources" }],
  }),
  component: ResourcesPage,
});

const COVER_CLASS = "bg-primary";


const PAGE_SIZE = 6;

function ResourcesPage() {
  const all = useMemo(getAllPosts, []);
  const [category, setCategory] = useState<Category | "All">("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [all, category, query]);

  const featured = filtered[0];
  const rest = filtered.slice(1);
  const pageCount = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = rest.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return (
    <>
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.22em] mb-5">
            Blog & Resources
          </p>
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tighter leading-[0.95] mb-6 max-w-4xl">
            The MyFloridaNemt.com blog.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Search plain-English guides on Medicaid transportation, provider credentialing,
            caregiver logistics, and Florida discharge planning — written by dispatchers,
            not marketers.
          </p>

          <div className="mt-8 flex flex-col md:flex-row gap-3 md:items-center">
            <label className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search articles…"
                aria-label="Search articles"
                className="w-full pl-11 pr-4 py-3 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["All", ...CATEGORIES] as const).map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); setPage(1); }}
                  aria-pressed={active}
                  className={
                    "px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-accent")
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20 px-6">
        <div className="max-w-7xl mx-auto">
          {!featured && (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <h2 className="text-2xl font-extrabold tracking-tight mb-2">No articles match your search.</h2>
              <p className="text-muted-foreground">Try a different keyword or clear the category filter.</p>
            </div>
          )}

          {featured && (
            <Link
              to="/resources/$slug"
              params={{ slug: featured.slug }}
              className="block bg-primary text-primary-foreground rounded-3xl overflow-hidden mb-10 group"
            >
              <div className="grid lg:grid-cols-[1.2fr_1fr]">
                <div className={"aspect-[16/10] lg:aspect-auto " + COVER_CLASS} aria-hidden />
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-3">
                    Featured · {featured.category}
                  </p>
                  <h2 className="text-2xl lg:text-4xl font-extrabold tracking-tighter mb-4">
                    {featured.title}
                  </h2>
                  <p className="text-primary-foreground/85 mb-6">{featured.excerpt}</p>
                  <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-widest text-primary-foreground/70">
                    <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{formatDate(featured.publishedAt)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{featured.readMinutes} min read</span>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent uppercase tracking-widest group-hover:gap-3 transition-all">
                    Read article <ArrowRight className="size-4" />
                  </span>
                </div>
              </div>
            </Link>
          )}

          {pageItems.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageItems.map((p) => (
                <Link
                  key={p.slug}
                  to="/resources/$slug"
                  params={{ slug: p.slug }}
                  className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-accent transition-colors group"
                >
                  <div className={"aspect-[16/9] " + COVER_CLASS} aria-hidden />
                  <div className="p-6 flex flex-col gap-3 flex-1">
                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest">
                      <span className="text-accent font-bold">{p.category}</span>
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="size-3" />{p.readMinutes} min
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold tracking-tight leading-tight">{p.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">{p.excerpt}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary mt-2 group-hover:gap-2 transition-all">
                      Read more <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border border-border bg-card disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === clampedPage ? "page" : undefined}
                  className={
                    "px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-colors " +
                    (n === clampedPage
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-accent")
                  }
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={clampedPage === pageCount}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border border-border bg-card disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </section>

      <section className="py-20 px-6 bg-secondary/40 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-4">
            Need help finding a MyFloridaNemt.com provider?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Skip the search. Request a ride and we'll match you with a verified provider in your county.
          </p>
          <Link
            to="/request-a-ride"
            className="inline-block px-10 py-5 bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase rounded-md"
          >
            Request a Ride
          </Link>
        </div>
      </section>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
