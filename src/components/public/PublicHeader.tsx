import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, LogIn, Menu, Phone, UserRound, X } from "lucide-react";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { BOOKING_ROUTE, PUBLIC_PHONE, PUBLIC_PHONE_TEL, PUBLIC_PHONE_VALID } from "@/lib/site-config";
import {PublicRegionSelect} from './PublicRegionSelect';
import {DsButton} from '@/components/ds/controls';

const NAV = [
  { label: "Services", to: "/services" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "Providers", to: "/for-providers" },
  { label: "Facilities", to: "/for-facilities" },
  { label: "Coverage", to: "/florida-coverage" },
  { label: "Find Support", to: "/find-support" },
  { label: "Training", to: "/training" },
] as const;

const focus = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-primary";

/** Uppercase nav links: no background blocks, no underline, subtle hover. */
const navLink = cn("ds-button-text ds-transition inline-flex min-h-11 items-center whitespace-nowrap rounded-ds-sm px-1 py-2.5 text-xs uppercase 2xl:px-2 2xl:text-[0.8125rem] hover:text-ds-accent focus-visible:text-ds-accent data-[status=active]:text-ds-accent", focus);

/** Header actions: icon + text only on the blue header. No background, no border, no underline. */
function ActionBlocks({ className, full, onNavigate }: { className?: string; full?: boolean; onNavigate?:()=>void }) {
  const item = cn(
    "ds-button-text ds-transition inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-xs uppercase 2xl:text-[0.9375rem] [&_svg]:hidden 2xl:[&_svg]:inline [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
    full && "w-full",
  );
  return (
    <div className={cn("public-header-actions items-center gap-1 2xl:gap-3", full ? "flex flex-col items-start" : "flex", className)}>
      <Link to="/login" onClick={onNavigate} className={cn(item, "text-ds-on-primary hover:text-ds-accent focus-visible:text-ds-accent", focus)}><LogIn aria-hidden />Sign In</Link>
      {!full&&<span aria-hidden className="text-ds-accent 2xl:hidden">–</span>}
      {PUBLIC_PHONE_VALID ? (
        <a href={PUBLIC_PHONE_TEL} onClick={onNavigate} className={cn(item, "text-ds-on-primary hover:text-ds-accent focus-visible:text-ds-accent", focus)} aria-label={`Call MY FLORIDA NEMT at ${PUBLIC_PHONE}`}>
          <Phone aria-hidden />Call Us
        </a>
      ) : (
        <span className={cn(item, "text-ds-on-primary")}><Phone aria-hidden />Call Us</span>
      )}
      {!full&&<span aria-hidden className="text-ds-accent 2xl:hidden">–</span>}
      <a href={BOOKING_ROUTE} onClick={onNavigate} className={cn(item, "text-ds-accent hover:text-ds-on-primary focus-visible:text-ds-on-primary", focus)}>
        <CalendarPlus aria-hidden />Book a Trip
      </a>
    </div>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header sticky top-0 z-50 bg-ds-primary ds-glass-blue border-b border-ds-primary-hover text-ds-on-primary" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <div className="public-header-inner mx-auto grid min-h-[76px] max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 min-[1200px]:flex min-[1200px]:justify-between 2xl:px-6">
        <Link to="/" onClick={()=>setOpen(false)} className={cn("min-w-0 shrink-0 rounded-ds-sm", focus)} aria-label="MY FLORIDA NEMT home">
          <BrandName on="blue" className="public-brand text-lg sm:text-xl 2xl:text-2xl" />
        </Link>
        <nav aria-label="Main" className="hidden min-w-0 items-center min-[1200px]:flex">
          <PublicRegionSelect/>
          {NAV.map((n) => <Link key={n.to} to={n.to} className={navLink}>{n.label}</Link>)}
        </nav>
        <div className="public-mobile-actions flex shrink-0 items-center gap-3">
          <ActionBlocks className="hidden min-[1200px]:flex" />
          <DsButton
            variant="ghost"
            type="button"
            className={cn("public-menu-control size-11 shrink-0 p-0 text-ds-on-primary hover:translate-y-0 hover:bg-transparent hover:text-ds-accent focus-visible:text-ds-accent min-[1200px]:hidden", focus)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </DsButton>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="absolute inset-x-0 top-full max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-ds-primary-hover bg-ds-primary px-4 pb-5 min-[1200px]:hidden">
          <div aria-label="Primary actions" className="mfn-container grid min-w-0 grid-cols-2 gap-3 pb-3 pt-4">
            <a href={BOOKING_ROUTE} onClick={()=>setOpen(false)} className={cn("ds-button-text col-span-2 flex min-h-14 items-center justify-center gap-3 whitespace-nowrap rounded-ds-sm bg-ds-accent px-4 py-3 uppercase text-ds-on-accent hover:bg-ds-accent-hover", focus)}><CalendarPlus className="size-5 shrink-0" aria-hidden />Book a Trip</a>
            <a href={PUBLIC_PHONE_TEL} onClick={()=>setOpen(false)} aria-label={`Call MY FLORIDA NEMT at ${PUBLIC_PHONE}`} className={cn("ds-button-text flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-ds-sm bg-ds-surface px-3 py-3 uppercase text-ds-primary", focus)}><Phone className="size-5 shrink-0" aria-hidden />Call Us</a>
            <Link to="/login" onClick={()=>setOpen(false)} className={cn("ds-button-text flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-ds-sm border border-ds-on-primary px-3 py-3 uppercase text-ds-on-primary hover:text-ds-accent", focus)}><UserRound className="size-5 shrink-0" aria-hidden />Sign In</Link>
          </div>
          <ul className="mfn-container flex flex-col gap-1 pt-2">
            {NAV.map((n) => <li key={n.to}><Link to={n.to} onClick={() => setOpen(false)} className={cn(navLink, "w-full py-3")}>{n.label}</Link></li>)}
          </ul>
        </nav>
      )}
    </header>
  );
}
