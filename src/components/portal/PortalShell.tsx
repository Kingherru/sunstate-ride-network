import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X, History, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { useChangelogIndicator } from "@/components/portal/changelog-state";

export type NavItem = { to: string; label: string; exact?: boolean };
export type ShellIdentity = { name: string; mfnId: string | null; label: string; badge?: string };

/** Quiet portal/admin frame: blue sidebar, pale-gray page, white workspace. No public header/footer. */
export function PortalShell({ nav, area, identity, changelogTo, children }: { nav: NavItem[]; area: string; identity?: ShellIdentity; changelogTo: "/portal/changelog" | "/admin/changelog"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); menuBtn.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const isActive = (i: NavItem) => (i.exact ? pathname === i.to || pathname === i.to + "/" : pathname === i.to || pathname.startsWith(i.to + "/"));
  const links = (
    <nav aria-label={`${area} navigation`} className="flex flex-col gap-1 px-3">
      {nav.map((i) => (
        <Link key={i.to} to={i.to as "/portal"} aria-current={isActive(i) ? "page" : undefined}
          className={cn("ds-button-text rounded-ds-sm px-3 py-2.5 uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
            isActive(i) ? "bg-ds-primary-hover text-ds-on-primary" : "text-ds-on-primary/85 hover:bg-ds-primary-hover hover:text-ds-on-primary")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
  const footCls = "ds-button-text flex items-center gap-2 rounded-ds-sm px-3 py-2.5 text-left uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus";
  const indicator = useChangelogIndicator(changelogTo === "/admin/changelog", pathname === changelogTo);
  const footer = (
    <div className="mx-3 flex flex-col gap-1 border-t border-ds-on-primary/15 pt-3">
      <Link to={changelogTo} aria-current={pathname === changelogTo ? "page" : undefined}
        className={cn(footCls, pathname === changelogTo ? "bg-ds-primary-hover text-ds-on-primary" : "text-ds-on-primary/85 hover:bg-ds-primary-hover hover:text-ds-on-primary")}>
        <History className="size-4" aria-hidden />Change log
        {indicator !== "none" && (
          <span className={cn("ml-auto size-2.5 rounded-full", indicator === "important" ? "bg-ds-error motion-safe:animate-[mfn-wiggle_0.5s_ease-in-out_1]" : "bg-ds-success-soft ring-1 ring-ds-success")}>
            <span className="sr-only">{indicator === "important" ? "Important update" : "New update"}</span>
          </span>
        )}
      </Link>
      <button onClick={signOut} className={cn(footCls, "text-ds-on-primary/85 hover:bg-ds-primary-hover hover:text-ds-on-primary")}>
        <LogOut className="size-4" aria-hidden />Sign out
      </button>
    </div>
  );
  const idCard = identity && (
    <div className="mx-6 mb-6">
      <p className="ds-body truncate font-semibold text-ds-on-primary" title={identity.name}>{identity.name}</p>
      <p className="ds-support text-ds-on-primary/75">{identity.label}</p>
      {identity.badge && <p className="ds-support mt-1 font-semibold uppercase tracking-[0.08em] text-ds-accent">{identity.badge}</p>}
      {identity.mfnId && <p className="ds-support mt-1 font-mono text-ds-on-primary/75">MFN ID: <span className="text-ds-on-primary">{identity.mfnId}</span></p>}
    </div>
  );

  return (
    <div className="theme-portal min-h-screen bg-ds-bg text-ds-on-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-ds-sm focus:bg-ds-surface focus:px-4 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-ds-primary py-6 lg:flex">
        <Link to="/" className="mx-6 mb-1 rounded-ds-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus"><BrandName on="blue" className="text-lg" /></Link>
        <p className="ds-support mx-6 mb-4 uppercase tracking-[0.08em] text-ds-on-primary/70">{area}</p>
        {idCard}
        <div className="min-h-0 flex-1 overflow-y-auto">{links}</div>
        <div className="mt-3">{footer}</div>
      </aside>

      {/* Phone/tablet top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ds-primary px-4 py-3 lg:hidden">
        <Link to="/" className="rounded-ds-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus"><BrandName on="blue" className="text-base" /></Link>
        <button ref={menuBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="portal-drawer" aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex size-11 items-center justify-center rounded-ds-sm text-ds-on-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </header>
      {open && (
        <div id="portal-drawer" className="portal-drawer fixed inset-x-0 top-[68px] bottom-0 z-20 flex flex-col overflow-y-auto bg-ds-primary pb-6 pt-2 lg:hidden">
          <p className="ds-support mx-6 mb-3 uppercase tracking-[0.08em] text-ds-on-primary/70">{area}</p>
          {idCard}
          {links}
          <div className="mt-6">{footer}</div>
        </div>
      )}

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:ml-64 lg:px-10 lg:py-10">
        <div className="portal-enter mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHead({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="ds-section-title uppercase text-ds-primary">{title}</h1>
        {children && <div className="ds-body mt-1 text-ds-text-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export const actionCls = "ds-button-text inline-flex min-h-12 items-center rounded-ds-sm bg-ds-action px-6 uppercase text-ds-on-action ds-transition hover:bg-ds-action-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus";
export const panelCls = "rounded-ds bg-ds-surface shadow-[var(--ds-shadow)]";
