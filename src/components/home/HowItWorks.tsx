import { useRef, useState } from "react";
import { CalendarCheck, ClipboardList, CreditCard, FolderOpen, Network, Search, Share2, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOWS = {
  customers: {
    label: "Customers & Facilities",
    steps: [
      { i: ClipboardList, t: "Submit the trip details", d: "Pickup, destination, time and the level of mobility support needed." },
      { i: Search, t: "Independent providers review the request", d: "Florida providers who serve the area can look at the trip." },
      { i: CreditCard, t: "Confirm and complete payment when applicable", d: "Agree on the arrangement before anything is final." },
      { i: FolderOpen, t: "Manage the trip information from one place", d: "Keep details, times and updates together." },
    ],
  },
  providers: {
    label: "Providers",
    steps: [
      { i: UserPlus, t: "Join the Florida network", d: "Create your provider account." },
      { i: Network, t: "Build your service profile", d: "Service types, counties, hours and vehicles." },
      { i: Share2, t: "Find or share opportunities", d: "Look for trips or pass along ones you can’t cover." },
      { i: CalendarCheck, t: "Move confirmed trips into your schedule", d: "Confirmed work lands in a clean day view." },
    ],
  },
} as const satisfies Record<string, { label: string; steps: readonly { i: LucideIcon; t: string; d: string }[] }>;
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
    <section id="how-it-works" aria-labelledby="how-title" className="mfn-section bg-ds-subtle scroll-mt-20">
      <div className="mfn-container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="ds-label text-ds-accent-active">How the network works</p>
            <h2 id="how-title" className="ds-page-title mt-2 text-ds-primary">A clearer way to request, connect and coordinate.</h2>
          </div>
          <div role="tablist" aria-label="Choose who you are" className="inline-flex rounded-ds-sm bg-ds-surface p-1 shadow-ds">
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
                  "ds-button-text ds-transition min-h-12 rounded-ds-sm px-6 text-[1.0625rem] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
                  active === k ? "bg-ds-primary text-ds-on-primary" : "text-ds-primary hover:bg-ds-hover",
                )}
              >
                {FLOWS[k].label}
              </button>
            ))}
          </div>
        </div>

        <div id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${active}`} key={active} className="ds-fade-in relative mt-9">
          {/* route line (desktop horizontal) */}
          <div aria-hidden className="absolute left-0 right-0 top-8 hidden h-px bg-ds-border md:block" />
          {/* route line (mobile vertical) */}
          <div aria-hidden className="absolute bottom-8 left-8 top-8 w-px bg-ds-border md:hidden" />
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-10">
            {flow.steps.map((s, i) => (
              <li key={s.t} className="flex gap-5 md:flex-col md:gap-4">
                <span className={cn(
                  "relative z-10 flex size-16 shrink-0 items-center justify-center rounded-ds-sm font-heading text-2xl font-bold ring-8 ring-ds-subtle",
                  i === flow.steps.length - 1 ? "bg-ds-accent text-ds-on-accent" : "bg-ds-primary text-ds-on-primary",
                )}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="ds-subheading flex items-start gap-2 text-[1.375rem] text-ds-primary"><s.i className="mt-1 size-5 shrink-0 text-ds-accent-active" aria-hidden />{s.t}</h3>
                  <p className="ds-body-lg mt-2 text-ds-text-2">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
