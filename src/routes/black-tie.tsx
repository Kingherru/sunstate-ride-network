import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/black-tie")({
  head: () => ({
    meta: [
      { title: "Black Tie Transportation — Luxury Chauffeured Service | My Florida NEMT" },
      {
        name: "description",
        content:
          "Premium chauffeured transportation across Florida — black SUVs, executive sedans, luxury sprinters, party buses, motor coaches, and limousines for weddings, corporate events, airport transfers, and private occasions.",
      },
      { property: "og:title", content: "Black Tie Transportation — My Florida NEMT" },
      {
        property: "og:description",
        content: "Luxury chauffeured transportation in Florida for weddings, corporate events, airport transfers, and private occasions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/black-tie" }],
  }),
  component: BlackTiePage,
});

const FLEET = [
  {
    name: "Executive Black SUV",
    seats: "1–6 passengers",
    blurb: "Cadillac Escalade & Chevrolet Suburban. The default for airport transfers and executive travel.",
    tag: "Airport · Executive",
  },
  {
    name: "Executive Sedan",
    seats: "1–3 passengers",
    blurb: "Mercedes-Benz S-Class and BMW 7 Series. Quiet, discreet, luxurious.",
    tag: "Executive",
  },
  {
    name: "Luxury Sprinter Van",
    seats: "1–14 passengers",
    blurb: "Mercedes Sprinter with leather captain seats, USB power, and privacy glass.",
    tag: "Group · Corporate",
  },
  {
    name: "Executive Shuttle Van",
    seats: "1–15 passengers",
    blurb: "Refined shuttle for conventions, hotels, and multi-stop group transfers.",
    tag: "Shuttle",
  },
  {
    name: "Stretch Limousine",
    seats: "6–10 passengers",
    blurb: "Classic white or black stretch — weddings, prom, anniversaries, milestone birthdays.",
    tag: "Wedding · Prom",
  },
  {
    name: "Party Bus",
    seats: "14–40 passengers",
    blurb: "Full lounge seating, sound system, mood lighting, bar. The night out on wheels.",
    tag: "Night Out",
  },
  {
    name: "Mini Coach",
    seats: "20–30 passengers",
    blurb: "Comfortable mid-size coach for weddings, executive groups, and day trips.",
    tag: "Group Travel",
  },
  {
    name: "Motor Coach & Charter Bus",
    seats: "40–56 passengers",
    blurb: "Full-size motor coach with reclining seats, restroom, luggage bay. Long-distance ready.",
    tag: "Charter · Convention",
  },
];

const OCCASIONS = [
  { title: "Airport Transfers", body: "Meet-and-greet at MCO, TPA, MIA, FLL, RSW, PBI, JAX. Flight-tracked pickups." },
  { title: "Weddings", body: "Bridal party, guest shuttles, grand exit. Coordinated with your planner, on the minute." },
  { title: "Corporate & Conventions", body: "Roadshows, board arrivals, convention shuttles for OCCC and Miami Beach Convention Center." },
  { title: "Proms & Milestones", body: "Chaperoned, parent-approved, insured. Photo stops included." },
  { title: "Private Events", body: "Concerts, sporting events, nights out, restaurant hopping, wine country day trips." },
  { title: "Group Travel", body: "Church groups, family reunions, funerals, senior outings — from 6 to 56 passengers." },
];

function BlackTiePage() {
  return (
    <div className="bg-black text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#c8a24a]">
                My Florida NEMT · Black Tie Division
              </span>
              <span className="h-px w-16 bg-[#c8a24a]/40" />
            </div>
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95]">
              Black Tie
              <br />
              <span className="text-[#c8a24a]">Transportation.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-2xl leading-relaxed">
              Chauffeured luxury across Florida. From executive black SUVs to full-size motor coaches — discreet, on-time, and dressed for the occasion.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-[#c8a24a] text-black font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-sm hover:bg-[#d9b660] transition-colors"
              >
                Request a Quote
              </Link>
              <a
                href="tel:+18445551234"
                className="inline-flex items-center gap-2 border border-white/30 text-white font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-sm hover:bg-white/5 transition-colors"
              >
                Speak with Concierge
              </a>
            </div>
            <dl className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
              {[
                ["24/7", "Concierge dispatch"],
                ["100%", "Insured & vetted"],
                ["1–56", "Passengers per vehicle"],
                ["FL", "Statewide coverage"],
              ].map(([n, l]) => (
                <div key={l as string}>
                  <dt className="font-display text-3xl font-extrabold tracking-tighter text-[#c8a24a]">{n}</dt>
                  <dd className="mt-1 text-[11px] font-mono uppercase tracking-widest text-white/60">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Fleet */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#c8a24a] mb-3">The Fleet</div>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tighter">
              Vehicles for every arrival.
            </h2>
          </div>
          <p className="text-sm text-white/60 max-w-md">
            Every Black Tie vehicle is late-model, professionally detailed, and driven by a licensed, insured, background-checked chauffeur.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
          {FLEET.map((v) => (
            <article key={v.name} className="bg-black p-8 flex flex-col justify-between min-h-[220px] hover:bg-white/[0.02] transition-colors">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#c8a24a] mb-3">{v.tag}</div>
                <h3 className="font-display text-xl font-extrabold tracking-tight leading-tight">{v.name}</h3>
                <p className="mt-3 text-sm text-white/70 leading-relaxed">{v.blurb}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 text-[11px] font-mono uppercase tracking-widest text-white/50">
                {v.seats}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Occasions */}
      <section className="border-t border-white/10 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#c8a24a] mb-3">Occasions</div>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tighter mb-14 max-w-3xl">
            Dressed for whatever's on your calendar.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {OCCASIONS.map((o) => (
              <div key={o.title} className="border-l-2 border-[#c8a24a]/60 pl-5">
                <h3 className="font-display text-lg font-bold tracking-tight">{o.title}</h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#c8a24a] mb-6">Reservations</div>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tighter">
            Tell us the occasion.
            <br />
            We'll handle the rest.
          </h2>
          <p className="mt-6 text-white/70 max-w-xl mx-auto">
            Quotes returned within one business hour. Peak-season events (weddings, holidays, F1, Ultra) should be booked 3–6 weeks in advance.
          </p>
          <p className="mt-3 text-xs font-mono uppercase tracking-widest text-[#c8a24a]/80">
            All vehicles and reservations are subject to availability.
          </p>
          <div className="mt-10 flex justify-center flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-[#c8a24a] text-black font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-sm hover:bg-[#d9b660] transition-colors"
            >
              Request a Quote
            </Link>
            <Link
              to="/request-a-ride"
              className="inline-flex items-center gap-2 border border-white/30 text-white font-bold text-sm uppercase tracking-widest px-6 py-3 rounded-sm hover:bg-white/5 transition-colors"
            >
              Standard NEMT Booking
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
