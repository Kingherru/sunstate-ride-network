import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Menu, Phone, X } from "lucide-react";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { LINKS, PUBLIC_PHONE, phoneHref } from "@/lib/site-config";

const NAV = [
  { label: "Services", href: "/#services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "For Providers", href: "/#providers" },
  { label: "Resources", href: "/#resources" },
];

const focus = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-primary";

/** Uppercase nav links: no background blocks, no underline, subtle hover. */
const navLink = "ds-button-text ds-transition inline-flex items-center px-3 py-2.5 text-[0.9375rem] uppercase tracking-[0.08em] hover:opacity-80";

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
    <header className="sticky top-0 z-50 bg-ds-primary text-ds-on-primary">
      <div className="mfn-container flex min-h-[76px] items-center justify-between gap-4 py-3">
        <Link to="/" className={cn("rounded-ds-sm", focus)} aria-label="My Florida NEMT home">
          <BrandName on="blue" className="text-xl sm:text-2xl" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {NAV.slice(0, 3).map((n) => <a key={n.label} href={n.href} className={navLink}>{n.label}</a>)}
          <Link to="/shop" className={navLink}>Training</Link>
          <a href={NAV[3].href} className={navLink}>{NAV[3].label}</a>
          <Link to="/login" className={navLink}>Sign In</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ActionBlocks className="ds-nudge hidden lg:flex" />
          <button
            type="button"
            className={cn("inline-flex size-11 items-center justify-center rounded-ds-sm hover:opacity-80 xl:hidden", focus)}
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
        <nav id="mobile-menu" aria-label="Mobile" className="ds-fade-in border-t border-ds-primary-hover px-4 pb-5 xl:hidden">
          <ul className="flex flex-col gap-1 pt-2">
            {NAV.slice(0, 3).map((n) => <li key={n.label}><a href={n.href} onClick={() => setOpen(false)} className={cn(navLink, "w-full py-3")}>{n.label}</a></li>)}
            <li><Link to="/shop" onClick={() => setOpen(false)} className={cn(navLink, "w-full py-3")}>Training</Link></li>
            <li><a href={NAV[3].href} onClick={() => setOpen(false)} className={cn(navLink, "w-full py-3")}>{NAV[3].label}</a></li>
            <li><Link to="/login" onClick={() => setOpen(false)} className={cn(navLink, "w-full py-3")}>Sign In</Link></li>
          </ul>
          <ActionBlocks full className="mt-4 lg:hidden" />
        </nav>
      )}
    </header>
  );
}
