import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources & Insights — Florida NEMT Blog" },
      {
        name: "description",
        content:
          "Guides and articles for Florida patients, providers, and entrepreneurs in non-emergency medical transportation — Medicaid, Workers' Comp, ADA compliance, and starting a NEMT business.",
      },
      { property: "og:title", content: "Florida NEMT Resources & Blog" },
      { property: "og:description", content: "NEMT insights for patients, providers, and operators across Florida." },
      { property: "og:url", content: "/resources" },
    ],
    links: [{ rel: "canonical", href: "/resources" }],
  }),
  component: ResourcesPage,
});

type Post = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  read: string;
};

const posts: Post[] = [
  {
    slug: "ada-ramp-guidelines-2026",
    category: "Compliance",
    title: "ADA Ramp Guidelines Every Florida NEMT Owner Should Know in 2026",
    excerpt:
      "Launching a NEMT business in Florida? Your van must be safe, professional, and ADA-compliant — and that starts with the ramp. Here's what the Americans with Disabilities Act requires for slope, width, and securement.",
    read: "6 min read",
  },
  {
    slug: "how-to-secure-nemt-vans",
    category: "Operations",
    title: "How to Secure NEMT Vans for Your Florida Business",
    excerpt:
      "Demand for safe, reliable transportation across Florida is at an all-time high. Before you can start moving patients, here's how to source, finance, and inspect compliant NEMT vehicles.",
    read: "8 min read",
  },
  {
    slug: "right-time-to-start-nemt-florida",
    category: "Business",
    title: "Why Now Might Be the Right Time to Start a NEMT Business in Florida",
    excerpt:
      "Florida's aging population, expanded Medicaid managed-care contracts, and a wave of new Workers' Comp claims are creating real opportunity for new NEMT operators across the state.",
    read: "7 min read",
  },
  {
    slug: "navigating-slow-seasons",
    category: "Business",
    title: "Navigating Slow Seasons in NEMT — Strategies to Boost Your Business",
    excerpt:
      "Every Florida NEMT operator hits a slow stretch. Here's how to diversify your trip mix — adult day care, dialysis contracts, and private-pay long-distance work — to keep revenue steady.",
    read: "5 min read",
  },
  {
    slug: "switch-nemt-provider-florida",
    category: "For Patients",
    title: "Having Trouble With Your Insurance-Assigned NEMT Provider? Here's How to Switch.",
    excerpt:
      "Late pickups, no-shows, and rude drivers are common complaints. Florida patients have more options than most insurance plans advertise — here's how to request a new provider.",
    read: "4 min read",
  },
  {
    slug: "5-problems-workers-comp-transport",
    category: "Workers' Comp",
    title: "5 Critical Problems With Workers' Comp Transportation — and How to Solve Them",
    excerpt:
      "Florida injured workers face transportation gaps that delay recovery. From scheduling chaos to no-shows, here's a practical guide to fixing the most common issues.",
    read: "9 min read",
  },
];

const categories = ["All", "Compliance", "Operations", "Business", "For Patients", "Workers' Comp"];

function ResourcesPage() {
  const [featured, ...rest] = posts;
  return (
    <>
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.22em] mb-5">
            Resources & Insights
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95] mb-6 max-w-4xl">
            The Florida NEMT blog.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Guides, playbooks, and field notes for patients, caregivers, providers, and
            entrepreneurs working in non-emergency medical transportation across Florida.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest border border-border rounded-full bg-card"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <article className="bg-primary text-primary-foreground rounded-3xl p-10 lg:p-16 mb-10 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-3">
                Featured · {featured.category}
              </p>
              <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-4 max-w-3xl">
                {featured.title}
              </h2>
              <p className="text-primary-foreground/80 max-w-2xl">{featured.excerpt}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-accent uppercase tracking-widest">
              Read article <ArrowRight className="size-4" />
            </span>
          </article>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((p) => (
              <article
                key={p.slug}
                className="bg-card border border-border rounded-2xl p-7 flex flex-col gap-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest">
                  <span className="text-accent font-bold">{p.category}</span>
                  <span className="text-muted-foreground">{p.read}</span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight leading-tight">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{p.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary mt-2">
                  Read more <ArrowRight className="size-4" />
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-secondary/40 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-4">
            Need help finding a Florida NEMT provider?
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
