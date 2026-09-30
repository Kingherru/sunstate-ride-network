import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Menu, Phone, X } from "lucide-react";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { LINKS, PUBLIC_PHONE, phoneHref } from "@/lib/site-config";

const NAV = [
  { label: "Services", to: "/services" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Providers", to: "/for-providers" },
  { label: "Facilities", to: "/for-facilities" },
  { label: "Coverage", to: "/florida-coverage" },
  { label: "Training", to: "/shop" },
  { label: "Sign In", to: "/login" },
] as const;

const focus = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-primary";

/** Uppercase nav links: no background blocks, no underline, subtle hover. */
const navLink = cn("ds-button-text ds-transition inline-flex items-center rounded-ds-sm px-2.5 py-2.5 text-[0.9375rem] uppercase tracking-[0.08em] hover:opacity-80 data-[status=active]:text-ds-accent", focus);

/** Header actions: icon + text only on the blue header. No background, no border, no underline. */
function ActionBlocks({ className, full }: { className?: string; full?: boolean }) {
  const item = cn(
    "ds-button-text ds-transition inline-flex min-h-12 items-center gap-2.5 px-2 text-[1.0625rem] uppercase tracking-[0.04em] [&_svg]:size-5 [&_svg]:shrink-0",
    full && "w-full",
  );
  return (
    <div className={cn("items-center gap-5", full ? "flex flex-col items-start" : "flex", className)}>
      {PUBLIC_PHONE ? (
        <a href={phoneHref(PUBLIC_PHONE)} className={cn(item, "text-ds-on-primary hover:opacity-80", focus)} aria-label={`Call My Florida NEMT at ${PUBLIC_PHONE}`}>
          <Phone aria-hidden />{PUBLIC_PHONE}
        </a>
      ) : (
        <span className={cn(item, "text-ds-on-primary")}><Phone aria-hidden />Call Us</span>
      )}
      <a href={LINKS.book} className={cn(item, "ds-nudge text-ds-accent hover:opacity-80", focus)}>
        <CalendarPlus aria-hidden />Book a Trip
      </a>
    </div>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-ds-primary text-ds-on-primary" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <div className="mfn-container flex min-h-[76px] items-center justify-between gap-4 py-3">
        <Link to="/" className={cn("rounded-ds-sm", focus)} aria-label="My Florida NEMT home">
          <BrandName on="blue" className="text-xl sm:text-2xl" />
        </Link>
        <nav aria-label="Main" className="hidden items-center 2xl:flex">
          {NAV.map((n) => <Link key={n.to} to={n.to} className={navLink}>{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-3">
          <ActionBlocks className="ds-nudge hidden lg:flex" />
          <button
            type="button"
            className={cn("inline-flex size-11 items-center justify-center rounded-ds-sm hover:opacity-80 2xl:hidden", focus)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="ds-fade-in border-t border-ds-primary-hover px-4 pb-5 2xl:hidden">
          <ul className="mfn-container flex flex-col gap-1 pt-2">
            {NAV.map((n) => <li key={n.to}><Link to={n.to} onClick={() => setOpen(false)} className={cn(navLink, "w-full py-3")}>{n.label}</Link></li>)}
          </ul>
          <ActionBlocks full className="mfn-container mt-4 lg:hidden" />
        </nav>
      )}
    </header>
  );
}
