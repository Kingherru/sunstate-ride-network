import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FLOWS = {
  customers: {
    label: "Customers & Facilities",
    steps: [
      { t: "Submit the trip details", d: "Pickup, destination, time and the level of mobility support needed." },
      { t: "Independent providers review the request", d: "Florida providers who serve the area can look at the trip." },
      { t: "Confirm and complete payment when applicable", d: "Agree on the arrangement before anything is final." },
      { t: "Manage the trip information from one place", d: "Keep details, times and updates together." },
    ],
  },
  providers: {
    label: "Providers",
    steps: [
      { t: "Join the Florida network", d: "Create your provider account." },
      { t: "Build your service profile", d: "Service types, counties, hours and vehicles." },
      { t: "Find or share opportunities", d: "Look for trips or pass along ones you can’t cover." },
      { t: "Move confirmed trips into your schedule", d: "Confirmed work lands in a clean day view." },
    ],
  },
} as const;
type Key = keyof typeof FLOWS;
const KEYS: Key[] = ["customers", "providers"];

export function HowItWorks() {
  const [active, setActive] = useState<Key>("customers");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + KEYS.length) % KEYS.length;
    setActive(KEYS[n]);
    refs.current[n]?.focus();
  };
  const flow = FLOWS[active];

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="bg-ds-subtle py-20 sm:py-28 scroll-mt-20">
      <div className="mfn-container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="ds-label text-ds-accent-active">How the network works</p>
            <h2 id="how-title" className="ds-page-title mt-2 text-ds-primary">A clearer way to request, connect and coordinate.</h2>
          </div>
          <div role="tablist" aria-label="Choose who you are" className="inline-flex rounded-ds bg-ds-surface p-1 shadow-ds">
            {KEYS.map((k, i) => (
              <button
                key={k}
                ref={(el) => { refs.current[i] = el; }}
                role="tab"
                id={`how-tab-${k}`}
                aria-selected={active === k}
                aria-controls="how-panel"
                tabIndex={active === k ? 0 : -1}
                onClick={() => setActive(k)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "ds-button-text ds-transition min-h-11 rounded-ds-sm px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus",
                  active === k ? "bg-ds-primary text-ds-on-primary" : "text-ds-primary hover:bg-ds-hover",
                )}
              >
                {FLOWS[k].label}
              </button>
            ))}
          </div>
        </div>

        <div id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${active}`} key={active} className="ds-fade-in relative mt-14">
          {/* route line (desktop horizontal) */}
          <svg aria-hidden className="pointer-events-none absolute left-0 right-0 top-6 hidden h-6 w-full md:block" preserveAspectRatio="none" viewBox="0 0 1000 24">
            <path d="M 60 12 C 250 -6, 400 30, 500 12 S 800 -6, 940 12" fill="none" stroke="var(--ds-primary)" strokeOpacity="0.35" strokeWidth="2.5" className="ds-route" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* route line (mobile vertical) */}
          <div aria-hidden className="absolute bottom-6 left-6 top-6 w-0 border-l-2 border-dashed border-ds-primary/30 md:hidden" />
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
            {flow.steps.map((s, i) => (
              <li key={s.t} className="flex gap-5 md:flex-col md:gap-4">
                <span className={cn(
                  "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold ring-8 ring-ds-subtle",
                  i === flow.steps.length - 1 ? "bg-ds-accent text-ds-on-accent" : "bg-ds-primary text-ds-on-primary",
                )}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="ds-subheading text-ds-primary">{s.t}</h3>
                  <p className="ds-body mt-1.5 text-ds-text-2">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
