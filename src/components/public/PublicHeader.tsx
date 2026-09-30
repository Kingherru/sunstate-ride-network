import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Phone, X } from "lucide-react";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { LINKS, PUBLIC_PHONE, phoneHref } from "@/lib/site-config";

const NAV = [
  { label: "Services", href: "/#services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "For Providers", href: "/#providers" },
  { label: "Resources", href: "/#resources" },
];

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-primary";

function PhoneArea({ className }: { className?: string }) {
  const inner = (
    <>
      <Phone className="size-4" aria-hidden />
      <span>{PUBLIC_PHONE || "Call Us"}</span>
    </>
  );
  const cls = cn("ds-button-text inline-flex items-center gap-2 rounded-ds-sm px-2 py-2", className);
  return PUBLIC_PHONE ? (
    <a href={phoneHref(PUBLIC_PHONE)} className={cn(cls, "ds-transition hover:bg-ds-primary-hover", focus)} aria-label={`Call My Florida NEMT at ${PUBLIC_PHONE}`}>{inner}</a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const linkCls = cn("ds-transition rounded-ds-sm px-2 py-2 hover:bg-ds-primary-hover", focus);
  return (
    <header className="sticky top-0 z-50 bg-ds-primary text-ds-on-primary">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className={cn("rounded-ds-sm", focus)} aria-label="My Florida NEMT home">
          <BrandName on="blue" className="text-lg sm:text-xl" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 ds-body xl:flex">
          {NAV.slice(0, 3).map((n) => <a key={n.label} href={n.href} className={linkCls}>{n.label}</a>)}
          <Link to="/shop" className={linkCls}>Training</Link>
          <a href={NAV[3].href} className={linkCls}>{NAV[3].label}</a>
          <Link to="/login" className={linkCls}>Sign In</Link>
        </nav>
        <div className="flex items-center gap-2">
          <PhoneArea className="ds-nudge hidden lg:inline-flex" />
          <a href={LINKS.book} className={cn("ds-nudge ds-button-text ds-transition inline-flex min-h-11 items-center rounded-ds-sm bg-ds-accent px-4 text-ds-on-accent hover:bg-ds-accent-hover", focus)}>
            Book a Trip
          </a>
          <button
            type="button"
            className={cn("inline-flex size-11 items-center justify-center rounded-ds-sm hover:bg-ds-primary-hover xl:hidden", focus)}
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
          <ul className="flex flex-col ds-body-lg">
            {NAV.slice(0, 3).map((n) => <li key={n.label}><a href={n.href} onClick={() => setOpen(false)} className={cn(linkCls, "block py-3")}>{n.label}</a></li>)}
            <li><Link to="/shop" className={cn(linkCls, "block py-3")}>Training</Link></li>
            <li><a href={NAV[3].href} onClick={() => setOpen(false)} className={cn(linkCls, "block py-3")}>{NAV[3].label}</a></li>
            <li><Link to="/login" className={cn(linkCls, "block py-3")}>Sign In</Link></li>
          </ul>
          <PhoneArea className="mt-3" />
        </nav>
      )}
    </header>
  );
}
