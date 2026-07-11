import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, User, Truck, Building2 } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";

const primaryLinks = [
  { to: "/how-it-works", label: "How It Works" },
  { to: "/service-areas", label: "Service Areas" },
  { to: "/join-our-network", label: "For Providers" },
] as const;

const servicesLinks = [
  { to: "/services", label: "All Services", desc: "Overview of our NEMT fleet" },
  { to: "/services/ambulatory", label: "Ambulatory", desc: "Walk-on rides with minimal assistance" },
  { to: "/services/wheelchair", label: "Wheelchair", desc: "ADA-compliant lift-equipped vans" },
  { to: "/services/stretcher", label: "Gurney & Stretcher", desc: "Bed-to-bed non-emergency transport" },
] as const;

const moreLinks = [
  { to: "/black-tie", label: "Black Tie" },
  { to: "/shop", label: "Training Shop" },
  { to: "/resources", label: "Resources" },
  { to: "/about", label: "About" },
] as const;

const allLinks = [...servicesLinks, ...primaryLinks, ...moreLinks] as const;


const portals = [
  { to: "/patient/login", label: "Patient Portal", desc: "Patients, families, caregivers", icon: User },
  { to: "/provider/login", label: "Provider Portal", desc: "NEMT providers & dispatchers", icon: Truck },
  { to: "/facility/login", label: "Facility Portal", desc: "Hospitals, SNFs, case managers", icon: Building2 },
] as const;

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const signInRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useDismiss(signInOpen, () => setSignInOpen(false), signInRef);
  useDismiss(moreOpen, () => setMoreOpen(false), moreRef);

  // Close menus on route change
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setMobileOpen(false);
    setSignInOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = moreLinks.some((l) => pathname.startsWith(l.to));

  return (
    <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-3">
        <div className="flex items-center gap-8 min-w-0">
          <Link to="/" className="shrink-0 flex items-center" aria-label="My Florida NEMT — home">
            <img
              src={logoHorizontal}
              alt="My Florida NEMT"
              width={1600}
              height={544}
              className="h-9 sm:h-10 w-auto"
            />
          </Link>

          <div className="hidden xl:flex items-center gap-6">
            {primaryLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground hover:text-accent transition-colors whitespace-nowrap"
                activeProps={{ className: "text-xs font-semibold uppercase tracking-[0.14em] text-accent whitespace-nowrap" }}
              >
                {l.label}
              </Link>
            ))}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${moreActive ? "text-accent" : "text-foreground hover:text-accent"}`}
              >
                More <ChevronDown className={`size-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1">
                  {moreLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      className="block px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-secondary hover:text-accent transition-colors"
                      activeProps={{ className: "block px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent bg-secondary" }}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block" ref={signInRef}>
            <button
              type="button"
              onClick={() => setSignInOpen((v) => !v)}
              aria-expanded={signInOpen}
              className="flex items-center gap-1 text-sm font-bold text-primary border border-primary/30 px-4 py-2 rounded-md hover:bg-primary/5 transition-all"
            >
              Sign In <ChevronDown className={`size-4 transition-transform ${signInOpen ? "rotate-180" : ""}`} />
            </button>
            {signInOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {portals.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    className="flex items-start gap-3 p-3 hover:bg-secondary transition-colors"
                  >
                    <p.icon className="size-5 text-accent mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">{p.label}</div>
                      <div className="text-xs text-muted">{p.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            to="/request-a-ride"
            className="hidden sm:inline-block text-sm font-bold text-primary-foreground bg-primary px-4 sm:px-5 py-2 rounded-md hover:bg-primary/90 transition-all whitespace-nowrap"
          >
            Request a Ride
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="xl:hidden p-2 -mr-2 text-foreground"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-border bg-background max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-1">
            {allLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs font-semibold uppercase tracking-[0.14em] py-2.5 hover:text-accent transition-colors"
                activeProps={{ className: "text-xs font-semibold uppercase tracking-[0.14em] py-2.5 text-accent" }}
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-border">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted mb-2">
                Sign in to your portal
              </p>
              {portals.map((p) => (
                <Link key={p.to} to={p.to} className="flex items-center gap-3 py-3">
                  <p.icon className="size-5 text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{p.label}</div>
                    <div className="text-xs text-muted">{p.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              to="/request-a-ride"
              className="mt-3 text-sm font-bold text-primary-foreground bg-primary px-5 py-3 rounded-md text-center"
            >
              Request a Ride
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
