import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ChevronDown, User, Truck, Building2 } from "lucide-react";

const navLinks = [
  { to: "/services", label: "Services" },
  { to: "/service-areas", label: "Service Areas" },
  { to: "/providers", label: "For Providers" },
  { to: "/training", label: "Training" },
  { to: "/about", label: "About" },
] as const;

const portals = [
  { to: "/patient/login", label: "Patient Portal", desc: "Patients, families, caregivers", icon: User },
  { to: "/provider/login", label: "Provider Portal", desc: "NEMT providers & dispatchers", icon: Truck },
  { to: "/facility/login", label: "Facility Portal", desc: "Hospitals, SNFs, case managers", icon: Building2 },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-3">
        <div className="flex items-center gap-8 min-w-0">
          <Link to="/" className="font-extrabold text-lg sm:text-xl tracking-tighter text-primary uppercase shrink-0">
            Florida NEMT
          </Link>
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground hover:text-accent transition-colors"
                activeProps={{ className: "text-xs font-semibold uppercase tracking-[0.14em] text-accent" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setSignInOpen((v) => !v)}
              onBlur={() => setTimeout(() => setSignInOpen(false), 150)}
              className="flex items-center gap-1 text-sm font-bold text-primary border border-primary/30 px-4 py-2 rounded-md hover:bg-primary/5 transition-all"
            >
              Sign In <ChevronDown className="size-4" />
            </button>
            {signInOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {portals.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSignInOpen(false)}
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
            className="hidden sm:inline-block text-sm font-bold text-primary-foreground bg-primary px-4 sm:px-5 py-2 rounded-md hover:bg-primary/90 transition-all"
          >
            Request a Ride
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden p-2 -mr-2 text-foreground"
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-2">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold uppercase tracking-[0.14em] py-2 hover:text-accent transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-border">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted mb-2">
                Sign in to your portal
              </p>
              {portals.map((p) => (
                <Link
                  key={p.to}
                  to={p.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 py-3"
                >
                  <p.icon className="size-5 text-accent" />
                  <div>
                    <div className="text-sm font-bold">{p.label}</div>
                    <div className="text-xs text-muted">{p.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              to="/request-a-ride"
              onClick={() => setOpen(false)}
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
