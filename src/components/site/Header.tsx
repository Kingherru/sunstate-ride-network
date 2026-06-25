import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { to: "/services", label: "Services" },
  { to: "/service-areas", label: "Service Areas" },
  { to: "/providers", label: "Providers" },
  { to: "/membership", label: "Membership" },
  { to: "/training", label: "Training" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-18 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-extrabold text-xl tracking-tighter text-primary uppercase">
            FloridaNEMT
          </Link>
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium hover:text-accent transition-colors"
                activeProps={{ className: "text-sm font-medium text-accent" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <a
            href="tel:8005550199"
            className="hidden sm:inline-block font-mono text-sm font-bold tracking-tight text-primary bg-primary/5 px-3 py-1.5 rounded-sm ring-1 ring-primary/10"
          >
            (800) 555-0199
          </a>
          <Link
            to="/auth"
            className="hidden md:inline-block text-sm font-bold text-primary border border-primary/30 px-4 py-2 rounded-sm hover:bg-primary/5 transition-all"
          >
            Provider Sign In
          </Link>
          <Link
            to="/request-a-ride"
            className="hidden sm:inline-block text-sm font-bold text-primary-foreground bg-primary px-5 py-2 rounded-sm hover:bg-primary/90 transition-all"
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
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-sm font-medium py-2 hover:text-accent transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="text-sm font-bold text-primary border border-primary/30 px-5 py-3 rounded-sm text-center"
            >
              Provider Sign In
            </Link>
            <Link
              to="/request-a-ride"
              onClick={() => setOpen(false)}
              className="text-sm font-bold text-primary-foreground bg-primary px-5 py-3 rounded-sm text-center"
            >
              Request a Ride
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
