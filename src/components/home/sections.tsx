import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Accessibility, ArrowLeftRight, ArrowRight, BadgePercent, BedSingle, BookOpen, Building2, CalendarPlus, CalendarX,
  ClipboardList, CreditCard, FileWarning, FolderOpen, Footprints, GraduationCap, Handshake, LayoutGrid, MapPinned,
  Network, Package, Share2, Tag, Truck, UserRound, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_IMAGES as IMG, LINKS } from "@/lib/site-config";
import { btnAction, btnBlue, btnLight, btnOnBlue, focusRing } from "./buttons";

export { btnAction as btnPrimary };

function Img({ img, className, eager }: { img: (typeof IMG)[keyof typeof IMG]; className?: string; eager?: boolean }) {
  return <img src={img.src} width={img.w} height={img.h} alt={img.alt} loading={eager ? "eager" : "lazy"} className={cn("h-full w-full object-cover", className)} />;
}

/* 1 — Hero */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-ds-primary text-ds-on-primary">
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-[55%]">
        <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full">
          <Img img={IMG.hero} eager className="object-[35%_center]" />
          {/* same-color fade: blue → transparent */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ds-primary to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-full lg:w-1/3 lg:bg-gradient-to-r" />
        </div>
      </div>
      <div className="relative mfn-container pb-12 pt-4 lg:py-28">
        <div className="max-w-2xl lg:max-w-[42%]">
          <p className="ds-label tracking-wide text-ds-accent">FLORIDA PEER-TO-PEER NEMT NETWORK</p>
          <h1 id="hero-title" className="ds-display mt-4">Florida NEMT, <span className="text-ds-accent">connected.</span></h1>
          <p className="ds-body-lg mt-5 text-[1.25rem] opacity-95 sm:text-[1.3125rem]">Request transportation or connect provider-to-provider. My Florida NEMT brings customers, facilities and independent providers together through one statewide peer network.</p>
          <p className="ds-subheading mt-4 border-l-[3px] border-ds-accent pl-4">Public booking and provider-to-provider connections—built into the same network.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.book} className={btnAction}><CalendarPlus aria-hidden />Book a Trip</a>
            <a href={LINKS.join} className={btnOnBlue}><Network aria-hidden />Join the Provider Network</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 2 — One network, two ways to connect */
function Tile({ icon: Icon, label, tone }: { icon: typeof Users; label: string; tone: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2 border-2 px-3 py-4 text-center", tone)}>
      <Icon className="size-7 text-ds-primary" aria-hidden />
      <span className="ds-label text-ds-primary">{label}</span>
    </div>
  );
}
function Connector({ both }: { both?: boolean }) {
  return (
    <div aria-hidden className="relative flex w-10 shrink-0 items-center sm:w-16">
      <span className="h-0.5 w-full bg-ds-primary" />
      <span className="absolute -right-0.5 size-2.5 rotate-45 border-r-2 border-t-2 border-ds-primary" />
      {both && <span className="absolute -left-0.5 size-2.5 -rotate-[135deg] border-r-2 border-t-2 border-ds-primary" />}
    </div>
  );
}
export function NetworkModel() {
  const facts = [
    "Independent providers remain independent.",
    "My Florida NEMT supports the connection and organization process.",
    "We are not a traditional dispatch company.",
    "Provider availability isn’t guaranteed for every request.",
  ];
  return (
    <section aria-labelledby="model-title" className="border-b border-ds-border bg-ds-subtle py-10 sm:py-14">
      <div className="mfn-container grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-center lg:gap-12">
        <div>
          <p className="ds-label text-ds-accent-active">ONE NETWORK. TWO WAYS TO CONNECT.</p>
          <h2 id="model-title" className="ds-section-title mt-2 text-ds-primary">A peer-to-peer Florida NEMT network with a public booking connection for customers and facilities.</h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {facts.map((f) => <li key={f} className="ds-body flex gap-2 text-ds-text-2"><span aria-hidden className="mt-2.5 h-0.5 w-3 shrink-0 bg-ds-accent" />{f}</li>)}
          </ul>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="border-2 border-ds-border bg-ds-surface p-5">
            <figcaption className="ds-label flex items-center gap-2 text-ds-primary"><CalendarPlus className="size-5" aria-hidden />Public booking connection</figcaption>
            <div className="mt-4 flex items-center" role="img" aria-label="Customers and facilities connect to independent providers">
              <Tile icon={Users} label="Customers & Facilities" tone="border-ds-sky-border bg-ds-sky" />
              <Connector />
              <Tile icon={Truck} label="Independent Providers" tone="border-ds-border bg-ds-subtle" />
            </div>
          </figure>
          <figure className="border-2 border-ds-border bg-ds-surface p-5">
            <figcaption className="ds-label flex items-center gap-2 text-ds-primary"><ArrowLeftRight className="size-5" aria-hidden />Provider-to-provider connection</figcaption>
            <div className="mt-4 flex items-center" role="img" aria-label="Providers connect directly with other providers">
              <Tile icon={Truck} label="Provider" tone="border-ds-peach-border bg-ds-peach" />
              <Connector both />
              <Tile icon={Truck} label="Provider" tone="border-ds-peach-border bg-ds-peach" />
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* 3 — Interactive visitor paths */
const PATHS = [
  {
    id: "customer", icon: UserRound, title: "I Need Transportation", short: "For yourself, a family member or someone in your care.", img: IMG.family, pos: "object-[center_30%]",
    body: "Request ambulatory, wheelchair or stretcher transportation. Independent Florida providers who serve the area can review your trip, and you confirm the arrangement before anything is final.",
    actions: [{ label: "Start a Trip Request", href: LINKS.book, icon: CalendarPlus, primary: true }, { label: "See How It Works", href: "#how-it-works", icon: ArrowRight }],
  },
  {
    id: "facility", icon: Building2, title: "I’m Booking for a Facility", short: "For clinics, hospitals, senior living and care teams.", img: IMG.facility, pos: "object-[center_25%]",
    body: "Organize transportation requests for patients or residents, keep recurring trip details together and connect with independent providers who cover your area.",
    actions: [{ label: "Start a Facility Request", href: LINKS.book, icon: CalendarPlus, primary: true }, { label: "See How It Works", href: "#how-it-works", icon: ArrowRight }],
  },
  {
    id: "provider", icon: Network, title: "I Provide Transportation", short: "For independent Florida NEMT providers.", img: IMG.provider, pos: "object-[center_20%]",
    body: "Connect directly with other Florida providers to find, share, review and negotiate trip opportunities—and use practical tools built around everyday NEMT work.",
    actions: [{ label: "Join the Provider Network", href: LINKS.join, icon: Network, primary: true }, { label: "See Provider Tools", href: "#providers", icon: ArrowRight }],
  },
] as const;
type PathId = (typeof PATHS)[number]["id"];

export function Paths() {
  const [active, setActive] = useState<PathId>("customer");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = (i + d + PATHS.length) % PATHS.length;
    setActive(PATHS[n].id);
    refs.current[n]?.focus();
  };
  const p = PATHS.find((x) => x.id === active)!;
  const isProvider = p.id === "provider";

  return (
    <section id="paths" aria-labelledby="paths-title" className="mfn-section bg-ds-bg scroll-mt-20">
      <div className="mfn-container">
        <h2 id="paths-title" className="ds-page-title text-center uppercase text-ds-primary lg:whitespace-nowrap">How can My Florida NEMT help you today?</h2>

        <div role="tablist" aria-label="Choose what you need" className="mt-9 grid gap-4 md:grid-cols-3">
          {PATHS.map((x, i) => {
            const on = x.id === active;
            const Icon = x.icon;
            return (
              <button
                key={x.id}
                ref={(el) => { refs.current[i] = el; }}
                role="tab"
                id={`path-tab-${x.id}`}
                aria-selected={on}
                aria-controls="path-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(x.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "ds-transition relative flex items-start gap-4 p-5 text-left sm:p-6", focusRing,
                  on
                    ? x.id === "provider" ? "border-[3px] border-ds-border-strong bg-ds-subtle text-ds-primary" : "border-[3px] border-ds-primary-border bg-ds-primary text-ds-on-primary"
                    : "border-2 border-ds-border bg-ds-surface text-ds-primary hover:bg-ds-hover",
                )}
              >
                <span className={cn("flex size-12 shrink-0 items-center justify-center border-2",
                  on && x.id !== "provider" ? "border-ds-accent text-ds-accent" : "border-ds-border-strong text-ds-primary")}>
                  <Icon className="size-7" aria-hidden />
                </span>
                <span>
                  <span className="ds-subheading block text-[1.3125rem]">{x.title}</span>
                  <span className={cn("ds-body mt-1 block", on && x.id !== "provider" ? "opacity-90" : "text-ds-text-2")}>{x.short}</span>
                </span>
                {on && <span aria-hidden className="absolute inset-x-0 -bottom-[3px] h-1.5 bg-ds-accent" />}
              </button>
            );
          })}
        </div>

        <div id="path-panel" role="tabpanel" aria-labelledby={`path-tab-${active}`} key={active} className="ds-fade-in mt-6 grid lg:grid-cols-[1fr_1.15fr]">
          <div className="aspect-[16/10] lg:aspect-auto lg:min-h-[26rem]"><Img img={p.img} className={p.pos} /></div>
          <div className={cn("flex flex-col justify-center p-6 sm:p-8 lg:p-12", isProvider ? "bg-ds-subtle text-ds-primary" : "bg-ds-primary text-ds-on-primary")}>
            <p.icon className={cn("size-8", "text-ds-accent")} aria-hidden />
            <h3 className="ds-section-title mt-3">{p.title}</h3>
            <p className={cn("ds-body-lg mt-3 max-w-[40rem]", isProvider ? "text-ds-on-subtle" : "opacity-95")}>{p.body}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {p.actions.map((a) => (
                <a key={a.label} href={a.href}
                  className={"primary" in a ? (isProvider ? btnBlue : btnAction) : isProvider ? btnLight : btnOnBlue}>
                  <a.icon aria-hidden />{a.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Services */
const SERVICES = [
  { n: "Ambulatory", icon: Footprints, d: "For riders who can walk with little or no help, with door-to-door support when needed.", tone: "bg-ds-sky border-ds-sky-border" },
  { n: "Wheelchair", icon: Accessibility, d: "Ramp- or lift-equipped vehicles for riders who travel in their own or a provided wheelchair.", tone: "bg-ds-green border-ds-green-border" },
  { n: "Stretcher or gurney", icon: BedSingle, d: "For riders who need to lie down during the trip and don’t need emergency care.", tone: "bg-ds-sand border-ds-sand-border" },
  { n: "Medical delivery", icon: Package, d: "Time-sensitive pickups and drop-offs of medical items, supplies and samples.", tone: "bg-ds-peach border-ds-peach-border" },
];
export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="mfn-section bg-ds-bg scroll-mt-20">
      <div className="mfn-container grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="ds-label text-ds-accent-active">Services</p>
          <h2 id="services-title" className="ds-page-title mt-2 text-ds-primary">Transportation needs are different. The starting point should be simple.</h2>
          <p className="ds-body-lg mfn-read mt-4 text-ds-text-2">Request these services from independent Florida providers. Each trip is carried out by the provider who accepts it.</p>
          <div className="mt-8 aspect-[16/10] overflow-hidden"><Img img={IMG.stretcher} /></div>
        </div>
        <div className="flex flex-col justify-center">
          <ul className="grid gap-4">
            {SERVICES.map((s) => (
              <li key={s.n} className="flex gap-5 border-2 border-ds-border p-5 sm:p-6">
                <span className={cn("flex size-14 shrink-0 items-center justify-center border-2 text-ds-primary", s.tone)}><s.icon className="size-8" aria-hidden /></span>
                <div>
                  <h3 className="ds-subheading text-[1.375rem] text-ds-primary">{s.n}</h3>
                  <p className="ds-body-lg mt-1 text-ds-text-2">{s.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6"><a href={LINKS.book} className={btnAction}><CalendarPlus aria-hidden />Book a Trip</a></div>
        </div>
      </div>
    </section>
  );
}

/* Founder story */
const PAINS = [
  { icon: MapPinned, t: "Finding reliable provider connections in other cities was hard." },
  { icon: FileWarning, t: "Trip information arrived incomplete or scattered." },
  { icon: Share2, t: "Good opportunities needed a way to be shared between providers." },
  { icon: Handshake, t: "Referrals shouldn’t require another complicated dispatch platform." },
  { icon: FolderOpen, t: "Customer and trip details needed a faster way to stay organized." },
];
export function Founder() {
  return (
    <section id="about" aria-labelledby="about-title" className="bg-ds-bg scroll-mt-20">
      <div className="grid lg:grid-cols-[44fr_56fr]">
        <div className="aspect-[4/3] lg:aspect-auto lg:min-h-full"><Img img={IMG.founder} className="object-[60%_center]" /></div>
        <div className="mfn-section flex items-center bg-ds-sand px-[var(--mfn-gutter)] text-ds-on-soft lg:px-14 xl:px-20">
          <div className="max-w-[46rem]">
            <p className="ds-label text-ds-accent-active">Our story</p>
            <h2 id="about-title" className="ds-page-title mt-2 text-ds-primary">Created from inside the NEMT business.</h2>
            <p className="ds-body-lg mt-4 text-[1.25rem]">My Florida NEMT was started by a working Florida NEMT provider who dealt with the same everyday problems other providers face.</p>
            <ul className="mt-6 grid gap-3">
              {PAINS.map((p) => (
                <li key={p.t} className="ds-body-lg flex items-center gap-4 border-2 border-ds-sand-border bg-ds-surface px-4 py-3">
                  <p.icon className="size-6 shrink-0 text-ds-primary" aria-hidden />{p.t}
                </li>
              ))}
            </ul>
            <p className="ds-subheading mt-6 border-l-[3px] border-ds-accent pl-4 text-ds-primary">My Florida NEMT is being built to make those everyday connections and details easier to manage.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Membership */
export function Membership() {
  const included = [
    { icon: LayoutGrid, t: "Core provider-network tools included" },
    { icon: CalendarX, t: "Cancel anytime" },
  ];
  const fees = [
    { icon: BadgePercent, t: "2% platform fee on completed trips received through the network" },
    { icon: CreditCard, t: "Payment-processing fees may apply when payments are processed through the platform" },
    { icon: Tag, t: "Optional paid lead tools may be offered separately" },
    { icon: GraduationCap, t: "Training classes are purchased separately" },
  ];
  const Item = ({ icon: Icon, t }: { icon: typeof Tag; t: string }) => (
    <li className="ds-body-lg flex gap-3 border-2 border-ds-primary-hover bg-ds-primary-hover p-4 text-[1.0625rem]"><Icon className="mt-0.5 size-6 shrink-0 text-ds-accent" aria-hidden />{t}</li>
  );
  return (
    <section id="membership" aria-labelledby="member-title" className="mfn-section bg-ds-primary text-ds-on-primary scroll-mt-20">
      <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
        <div>
          <p className="ds-label flex items-center gap-2 text-ds-accent"><Network className="size-5" aria-hidden />Provider membership</p>
          <p className="mt-4 font-heading text-6xl font-bold uppercase leading-none sm:text-7xl">30 days <span className="text-ds-accent">free</span></p>
          <h2 id="member-title" className="ds-section-title mt-5">Try the complete provider network free for 30 days.</h2>
          <p className="mt-5 inline-flex items-baseline gap-2 border-2 border-ds-on-primary/30 px-4 py-2"><span className="font-heading text-3xl font-bold">$10/month</span><span className="ds-body-lg opacity-90">after the 30-day trial</span></p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.join} className={btnAction}><Network aria-hidden />Start 30 Days Free</a>
            <a href="#providers" className={btnOnBlue}><ArrowRight aria-hidden />See Provider Benefits</a>
          </div>
        </div>
        <div className="grid gap-6">
          <div>
            <h3 className="ds-subheading">Included</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{included.map((i) => <Item key={i.t} {...i} />)}</ul>
          </div>
          <div>
            <h3 className="ds-subheading">Fees, stated plainly</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{fees.map((i) => <Item key={i.t} {...i} />)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Training & resources */
export function Training() {
  const res = [
    { icon: ClipboardList, t: "Provider operations class", d: "Day-to-day practices for running NEMT trips well.", tone: "bg-ds-sky border-ds-sky-border" },
    { icon: BookOpen, t: "Florida NEMT business resource", d: "Practical guidance for starting and growing a Florida NEMT business.", tone: "bg-ds-green border-ds-green-border" },
    { icon: Package, t: "Customer & facility transportation guide", d: "What to know before requesting a non-emergency trip.", tone: "bg-ds-peach border-ds-peach-border" },
  ];
  return (
    <section id="resources" aria-labelledby="training-title" className="mfn-section bg-ds-subtle scroll-mt-20">
      <div className="mfn-container">
        <div id="training" className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <div>
            <p className="ds-label flex items-center gap-2 text-ds-accent-active"><GraduationCap className="size-5" aria-hidden />Training & resources</p>
            <h2 className="ds-page-title mt-2 text-ds-primary" id="training-title">Build stronger NEMT knowledge.</h2>
            <p className="ds-body-lg mfn-read mt-4 text-[1.25rem] text-ds-text-2">Provider training and practical resources are available separately from network membership.</p>
            <p className="ds-subheading mt-5 text-ds-on-subtle">Training classes are $50 each unless a specific course displays a different approved price.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/shop" className={btnBlue}><GraduationCap aria-hidden /> Explore Training</Link>
              <a href="#resources-list" className={btnLight}><BookOpen aria-hidden />View Resources</a>
            </div>
          </div>
          <div id="resources-list" className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            {res.map((r) => (
              <div key={r.t} className={cn("border-2 p-6 text-ds-on-soft sm:p-7", r.tone)}>
                <r.icon className="size-7 text-ds-primary" aria-hidden />
                <h3 className="ds-subheading mt-4 text-[1.375rem] text-ds-primary">{r.t}</h3>
                <p className="ds-body-lg mt-2">{r.d}</p>
              </div>
            ))}
            <Link to="/shop" className={cn("group flex flex-col justify-between border-2 border-ds-primary-border bg-ds-primary p-6 text-ds-on-primary ds-transition hover:bg-ds-primary-hover sm:p-7", focusRing)}>
              <div>
                <p className="ds-label flex items-center gap-2 text-ds-accent"><GraduationCap className="size-5" aria-hidden />Training Shop</p>
                <p className="ds-subheading mt-2 text-[1.375rem]">Browse available classes</p>
              </div>
              <p className="mt-6 flex items-end justify-between"><span><span className="font-heading text-5xl font-bold">$50</span> <span className="ds-body-lg opacity-90">per class</span></span><ArrowRight className="size-7 text-ds-accent" aria-hidden /></p>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
