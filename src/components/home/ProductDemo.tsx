import { useRef, useState } from "react";
import { ArrowRight, CalendarCheck, Check, FileText, MapPin, Monitor, Search, Send, Smartphone, Sparkles, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomeReveal } from "./HomeReveal";

// Fictional sample data only.
const FEATURES = [
  { id: "notes", label: "Smart Notes", icon: Sparkles, blurb: "Paste messy trip details and get an organized draft." },
  { id: "find", label: "Find Providers", icon: Search, blurb: "Look up providers by city, county, ZIP or radius." },
  { id: "share", label: "Share a Trip", icon: Send, blurb: "Send one trip to the providers you choose." },
  { id: "offers", label: "Review Offers", icon: FileText, blurb: "Review, counter or accept incoming opportunities." },
  { id: "schedule", label: "Schedule Confirmed Trips", icon: CalendarCheck, blurb: "Confirmed trips drop into a clean day view." },
  { id: "customers", label: "Customer Records", icon: UserRound, blurb: "Pick a saved rider for a faster repeat request." },
] as const;
type Id = (typeof FEATURES)[number]["id"];

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 border-b border-ds-border py-2 last:border-0">
    <span className="ds-caption">{k}</span>
    <span className="ds-label text-right text-ds-on-surface">{v}</span>
  </div>
);
const Chip = ({ children, on }: { children: React.ReactNode; on?: boolean }) => (
  <span className={cn("ds-caption inline-flex items-center gap-1 rounded-ds-sm px-2.5 py-1 !font-semibold", on ? "bg-ds-primary !text-ds-on-primary" : "bg-ds-subtle !text-ds-on-subtle")}>{children}</span>
);

function Preview({ id }: { id: Id }) {
  switch (id) {
    case "notes":
      return (
        <div className="grid gap-4 @md:grid-cols-[1fr_auto_1fr] @md:items-center">
          <div className="ds-notepad overflow-hidden rounded-ds-lg text-[0.95rem] text-ds-on-surface">
            <div className="flex items-center justify-between px-4 pt-3 text-ds-accent-active">
              <span className="ds-caption font-semibold">‹ Smart Notes</span>
              <span className="ds-caption font-semibold">Done</span>
            </div>
            <div className="px-4 pb-5 pt-2">
              <p className="ds-caption text-ds-text-2">Today · 8:42 AM</p>
              <p className="mt-1 text-[1.05rem] font-bold">Tuesday pickup</p>
              <p className="mt-2 leading-relaxed">need wc pickup tues 9:15am<br />sunrise villas bldg C → lakeside clinic suite 204<br />return ~11:30 pt uses own chair, 1 escort</p>
            </div>
          </div>
          <ArrowRight className="mx-auto size-6 rotate-90 text-ds-accent @md:rotate-0" aria-hidden />
          <div className="rounded-ds-sm bg-ds-subtle p-4">
            <p className="ds-label mb-2 text-ds-primary">Draft trip</p>
            <Row k="Service" v="Wheelchair" />
            <Row k="Pickup" v="Tue · 9:15 AM" />
            <Row k="From" v="Sunrise Villas, Bldg C" />
            <Row k="To" v="Lakeside Clinic, Ste 204" />
            <Row k="Return" v="About 11:30 AM" />
            <Row k="Notes" v="Own chair · 1 escort" />
          </div>
        </div>
      );
    case "find":
      return (
        <div>
          <div className="flex flex-wrap gap-2"><Chip on>ZIP 32803</Chip><Chip>Orange County</Chip><Chip>Within 25 mi</Chip><Chip>Wheelchair</Chip></div>
          <ul className="mt-4 divide-y divide-ds-border rounded-ds-sm border border-ds-border">
            {[["Sample Transport Co.", "Orlando · 4 mi", "Wheelchair · Stretcher"], ["Example Mobility LLC", "Winter Park · 9 mi", "Ambulatory · Wheelchair"], ["Demo Care Rides", "Kissimmee · 18 mi", "Wheelchair"]].map(([n, l, s]) => (
              <li key={n} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3"><MapPin className="size-4 text-ds-accent" aria-hidden /><div><p className="ds-label text-ds-on-surface">{n}</p><p className="ds-caption">{l}</p></div></div>
                <span className="ds-caption hidden @md:block">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "share":
      return (
        <div className="grid gap-4 @md:grid-cols-2">
          <div className="rounded-ds-sm bg-ds-sky p-4 text-ds-on-soft">
            <p className="ds-label">Trip #S-1042</p>
            <p className="ds-body mt-1">Stretcher · Thu 7:00 AM</p>
            <p className="ds-caption mt-1">Tampa → St. Petersburg</p>
          </div>
          <div className="rounded-ds-sm bg-ds-subtle p-4">
            <p className="ds-label mb-2 text-ds-primary">Share with</p>
            {[["Sample Transport Co.", true], ["Example Mobility LLC", true], ["Demo Care Rides", false]].map(([n, on]) => (
              <p key={n as string} className="ds-body flex items-center gap-2 py-1">
                <span className={cn("flex size-5 items-center justify-center rounded-sm", on ? "bg-ds-primary text-ds-on-primary" : "border border-ds-border")}>{on && <Check className="size-3.5" aria-hidden />}</span>{n}
              </p>
            ))}
            <p className="ds-button-text mt-3 inline-flex items-center gap-2 rounded-ds-sm bg-ds-action px-3 py-2 text-ds-on-action"><Send className="size-4" aria-hidden /> Share with 2 providers</p>
          </div>
        </div>
      );
    case "offers":
      return (
        <div className="rounded-ds-sm bg-ds-subtle p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="ds-label text-ds-primary">Incoming opportunity</p><p className="ds-body">Ambulatory · Mon 1:30 PM · Gainesville</p></div>
            <Chip>New</Chip>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-ds-sm bg-ds-surface p-3"><p className="ds-caption">Offered</p><p className="ds-subheading text-ds-on-subtle">$68.00</p></div>
            <div className="rounded-ds-sm bg-ds-peach p-3"><p className="ds-caption">Your counter</p><p className="ds-subheading text-ds-on-soft">$75.00</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="ds-button-text rounded-ds-sm bg-ds-primary px-3 py-2 text-ds-on-primary">Accept</span>
            <span className="ds-button-text rounded-ds-sm bg-ds-subtle px-3 py-2 text-ds-primary">Send counter</span>
            <span className="ds-button-text px-3 py-2 text-ds-text-2">Decline</span>
          </div>
        </div>
      );
    case "schedule":
      return (
        <div className="rounded-ds-sm border border-ds-border">
          <p className="ds-label border-b border-ds-border p-3 text-ds-primary">Tuesday</p>
          {[["8:00 AM", "Ambulatory · Ocala", false], ["9:15 AM", "Wheelchair · Sunrise Villas → Lakeside Clinic", true], ["1:00 PM", "Medical delivery · Lab samples", false]].map(([t, d, isNew]) => (
            <div key={t as string} className={cn("flex items-center gap-4 border-b border-ds-border p-3 last:border-0", isNew && "bg-ds-green ds-fade-in")}>
              <span className="ds-label w-20 shrink-0 text-ds-on-surface">{t}</span>
              <span className="ds-body flex-1">{d}</span>
              {isNew && <Chip on><Check className="size-3" aria-hidden /> Confirmed</Chip>}
            </div>
          ))}
        </div>
      );
    case "customers":
      return (
        <div className="grid gap-4 @md:grid-cols-2">
          <ul className="rounded-ds-sm border border-ds-border">
            {["Sample Rider A.", "Test Rider B.", "Example Rider C."].map((n, i) => (
              <li key={n} className={cn("flex items-center gap-3 border-b border-ds-border p-3 last:border-0", i === 0 && "bg-ds-sky")}>
                <Users className="size-4 text-ds-primary" aria-hidden /><span className="ds-body">{n}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-ds-sm bg-ds-subtle p-4">
            <p className="ds-label mb-2 text-ds-primary">Repeat request</p>
            <Row k="Rider" v="Sample Rider A." />
            <Row k="Usual pickup" v="Home address on file" />
            <Row k="Service" v="Wheelchair" />
            <p className="ds-caption mt-3">Pick a date and time — everything else is filled in.</p>
          </div>
        </div>
      );
  }
}

export function ProductDemo({ motion = false }: { motion?: boolean } = {}) {
  const [active, setActive] = useState<Id>("notes");
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!next) return;
    e.preventDefault();
    const n = (i + next + FEATURES.length) % FEATURES.length;
    setActive(FEATURES[n].id);
    refs.current[n]?.focus();
  };
  const current = FEATURES.find((f) => f.id === active)!;

  return (
    <section id="providers" aria-labelledby="demo-title" className="mfn-section-lg relative overflow-hidden bg-ds-bg scroll-mt-20">
      <div className="mfn-container-wide">
        <HomeReveal disabled={!motion} className="mx-auto max-w-3xl text-center">
          <p className="ds-label text-ds-accent-active">Provider tools</p>
          <h2 id="demo-title" className="ds-page-title mt-2 uppercase text-ds-primary">BUILT AROUND THE WAY NEMT PROVIDERS ACTUALLY WORK.</h2>
          <p className="ds-body-lg mx-auto mt-4 max-w-[44rem] text-ds-text-2">Review opportunities, organize trip information and stay connected from the office or on the go across desktop, tablet and mobile.</p>
        </HomeReveal>

        <HomeReveal disabled={!motion} className="mt-10"><div className="grid gap-6 lg:grid-cols-[30%_1fr] lg:items-center lg:gap-8">
          <div role="tablist" aria-label="Provider tools" aria-orientation="vertical" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {FEATURES.map((f, i) => {
              const on = f.id === active;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  ref={(el) => { refs.current[i] = el; }}
                  role="tab"
                  id={`demo-tab-${f.id}`}
                  aria-selected={on}
                  aria-controls="demo-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(f.id)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={cn(
                    "ds-transition flex min-h-14 shrink-0 items-center gap-4 rounded-ds-sm px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
                    on ? "bg-ds-primary text-ds-on-primary" : "bg-ds-subtle text-ds-primary hover:bg-ds-hover",
                  )}
                >
                  <Icon className={cn("size-5 shrink-0", on && "text-ds-accent")} aria-hidden />
                  <span className="ds-button-text whitespace-nowrap text-[1.125rem]">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* App-window composition */}
          <div>
            <div className={cn("overflow-hidden rounded-ds-lg bg-ds-primary p-2 sm:p-3", view === "mobile" && "mx-auto w-full max-w-[24rem] px-2 pb-5 pt-3")}>
              <div className="px-1 pb-2 sm:pb-3">
              <div className="flex justify-center">
                <div role="radiogroup" aria-label="Preview size" className="inline-flex rounded-ds-sm bg-ds-primary-hover p-1">
                  {([["desktop", Monitor, "Desktop view"], ["mobile", Smartphone, "Mobile view"]] as const).map(([v, Icon, l]) => (
                    <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}
                      className={cn("ds-button-text ds-transition inline-flex min-h-11 items-center gap-2 rounded-ds-sm px-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
                        view === v ? "bg-ds-surface text-ds-primary" : "text-ds-on-primary hover:bg-ds-primary-active")}>
                      <Icon className="size-5" aria-hidden />{l}
                    </button>
                  ))}
                </div>
              </div>
                <p className="ds-caption mt-2 text-center !text-ds-on-primary opacity-80">Provider workspace · sample data</p>
              </div>
              <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${active}`} className={cn("@container rounded-ds bg-ds-surface text-ds-on-surface", view === "mobile" ? "min-h-[34rem] p-4" : "min-h-[28rem] p-5 sm:p-10")}>
                <p className="ds-section-title text-ds-primary">{current.label}</p>
                <p className="ds-body-lg mb-6 text-ds-text-2">{current.blurb}</p>
                <div key={active + view} className="ds-fade-in [&_.ds-caption]:text-[0.9375rem] [&_.ds-label]:text-[1.0625rem] [&_.ds-body]:text-[1.0625rem]"><Preview id={active} /></div>
              </div>
            </div>
          </div>
        </div></HomeReveal>
      </div>
    </section>
  );
}
