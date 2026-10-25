import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Menu, X, History, LogOut, Settings, Bell, IdCard,
  LayoutDashboard, Car, CalendarDays, Truck, Users, GraduationCap, UserCircle2,
  PlusCircle, ListChecks, Upload, Search, Star, Contact2, Wallet, Network,
  ShieldCheck, MessageSquare, DollarSign, Banknote, Plug, UserCog, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";
import { useChangelogIndicator } from "@/components/portal/changelog-state";
import { usePortalQuery } from "@/components/portal/preview-data";
import { listMyNotifications } from "@/lib/notifications.functions";
import { RequestDetailProvider } from './RequestDetailOverlay';

type Indicator = "none" | "update" | "important";
const URGENT_TYPES = /cancel|urgent|alert|fail|declin|suspend|important|needs attention/i;
/** Static dot: green = ordinary unread update, red = important. Never pulses. */
function Dot({ kind, className }: { kind: Indicator; className?: string }) {
  if (kind === "none") return null;
  return (
    <span className={cn("size-2.5 rounded-full", kind === "important" ? "bg-ds-error" : "bg-ds-success", className)}>
      <span className="sr-only">{kind === "important" ? "Important update" : "New update"}</span>
    </span>
  );
}

export type NavItem = { to: string; label: string; exact?: boolean; search?: Record<string, string>; iconFor?: string };
export type ShellIdentity = { name: string; mfnId: string | null; label: string };

/** One icon per nav destination so the sidebar stays scannable. Keyed by
 *  longest-matching path prefix; unmatched items fall back to a plain dot. */
const NAV_ICONS: [string, React.ComponentType<{ className?: string }>][] = [
  ["/portal/requests/new", PlusCircle],
  ["/portal/requests", ListChecks],
  ["/portal/upload-csv", Upload],
  ["/portal/find-providers", Search],
  ["/portal/saved-providers", Star],
  ["/portal/network", Network],
  ["/portal/contacts", Contact2],
  ["/portal/payers", Wallet],
  ["/portal/notifications", Bell],
  ["/portal/trips", Car],
  ["/portal/schedule", CalendarDays],
  ["/portal/vehicles", Truck],
  ["/portal/drivers", Users],
  ["/portal/training", GraduationCap],
  ["/portal/messaging", MessageSquare],
  ["/portal/account", UserCircle2],
  ["/portal", LayoutDashboard],
  ["/admin/people", Users],
  ["/admin/requests", ListChecks],
  ["/admin/on-behalf", PlusCircle],
  ["/admin/messaging", MessageSquare],
  ["/admin/pricing", DollarSign],
  ["/admin/payouts", Banknote],
  ["/admin/integrations", Plug],
  ["/admin/notifications", Bell],
  ["/admin/admins", UserCog],
  ["/admin/security", ShieldCheck],
  ["/admin/settings", Settings],
  ["/admin", LayoutDashboard],
  ["/learn", GraduationCap],
];
function iconFor(to: string) {
  const hit = NAV_ICONS.filter(([p]) => to === p || to.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? Circle;
}

/** Quiet portal/admin frame: blue sidebar, slim blue top header, pale-gray
 *  page, white workspace. No public header/footer. */
export function PortalShell({ nav, area, identity, changelogTo, settingsTo, notificationsTo, title, children }: {
  nav: NavItem[]; area: string; identity?: ShellIdentity; changelogTo: "/portal/changelog" | "/admin/changelog";
  settingsTo?: string; notificationsTo?: string; title?: string; children: React.ReactNode;
}) {
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

  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const isActive = (i: NavItem) => i.search
    ? pathname === i.to && Object.entries(i.search).every(([k, v]) => String((search as Record<string, unknown>)?.[k] ?? "") === v)
    : (i.exact ? pathname === i.to || pathname === i.to + "/" : pathname === i.to || pathname.startsWith(i.to + "/"));
  const pageTitle = title ?? nav.find(isActive)?.label ?? area;
  const links = (
    <nav aria-label={`${area} navigation`} className="flex flex-col gap-1 px-3">
      {nav.map((i) => {
        const Icon = iconFor(i.iconFor ?? i.to);
        return (
          <Link key={i.to + JSON.stringify(i.search ?? {})} to={i.to as "/portal"} search={i.search as any} aria-current={isActive(i) ? "page" : undefined}
            className={cn("ds-button-text flex items-center gap-2.5 rounded-ds-sm px-3 py-2.5 uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
              isActive(i) ? "bg-ds-primary-hover text-ds-on-primary" : "text-ds-on-primary/85 hover:bg-ds-primary-hover hover:text-ds-on-primary")}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
  const footCls = "ds-button-text flex items-center gap-2 rounded-ds-sm px-3 py-2.5 text-left uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus";
  const unread = usePortalQuery({
    queryKey: ["notifications", "shell-unread"], enabled: !!notificationsTo, staleTime: 60_000,
    queryFn: () => listMyNotifications({ data: { filter: "unread", limit: 20, offset: 0 } }),
  });
  const unreadRows = (unread.data as { rows?: { type: string; title: string }[] } | undefined)?.rows ?? [];
  const notifIndicator: Indicator = unreadRows.length === 0 ? "none" : unreadRows.some((r) => URGENT_TYPES.test(r.type + " " + r.title)) ? "important" : "update";
  const indicator = useChangelogIndicator(changelogTo === "/admin/changelog", pathname === changelogTo);
  const footer = (
    <div className="mx-3 flex flex-col gap-1 border-t border-ds-on-primary/15 pt-3">
      {identity?.mfnId && (
        <p className="ds-support flex items-center gap-2 px-3 py-1 font-mono text-ds-on-primary/60">
          <IdCard className="size-3.5 shrink-0" aria-hidden />MFN ID: <span className="text-ds-on-primary/80">{identity.mfnId}</span>
        </p>
      )}
      <Link to={changelogTo} aria-current={pathname === changelogTo ? "page" : undefined}
        className={cn(footCls, "text-ds-accent hover:bg-ds-primary-hover")}>
        <History className="size-4 shrink-0" aria-hidden />Change log
        <Dot kind={indicator} className="ml-auto" />
      </Link>
      <button onClick={signOut} className={cn(footCls, "text-ds-accent hover:bg-ds-primary-hover")}>
        <LogOut className="size-4 shrink-0" aria-hidden />Sign out
      </button>
    </div>
  );
  const idCard = identity?.label ? (
    <p className="ds-support mx-6 mb-5 font-semibold uppercase tracking-[0.08em] text-ds-on-primary/75">{identity.label}</p>
  ) : null;

  const topHeader = (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-ds-primary px-4 sm:px-6 lg:px-10">
      <h1 className="sr-only">{pageTitle}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {notificationsTo && (
          <Link to={notificationsTo as "/portal/notifications"} aria-label="Notifications" title="Notifications"
            className="relative inline-flex size-10 items-center justify-center rounded-ds-sm text-ds-on-primary hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
            <Bell className="size-5" aria-hidden /><Dot kind={notifIndicator} className="absolute right-2 top-2" />
          </Link>
        )}
        {settingsTo && (
          <Link to={settingsTo as "/portal/account"} aria-label="Settings" title="Settings"
            className="inline-flex size-10 items-center justify-center rounded-ds-sm text-ds-on-primary hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
            <Settings className="size-5" aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );

  return (
    <div className="portal-root theme-portal min-h-screen bg-ds-bg text-ds-on-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-ds-sm focus:bg-ds-surface focus:px-4 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="portal-sidebar fixed inset-y-0 left-0 hidden w-64 flex-col bg-ds-primary py-6 lg:flex">
        <Link to="/" className="mx-6 mb-3 rounded-ds-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus"><BrandName on="blue" className="text-lg" /></Link>
        {idCard}
        <div className="min-h-0 flex-1 overflow-y-auto">{links}</div>
        <div className="mt-3">{footer}</div>
      </aside>

      {/* Phone/tablet top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-ds-primary px-3 py-2.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button ref={menuBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="portal-drawer" aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-ds-sm text-ds-on-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {notificationsTo && (
            <Link to={notificationsTo as "/portal/notifications"} aria-label="Notifications" title="Notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-ds-sm text-ds-on-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
              <Bell className="size-5" aria-hidden /><Dot kind={notifIndicator} className="absolute right-2 top-2" />
            </Link>
          )}
          {settingsTo && (
            <Link to={settingsTo as "/portal/account"} aria-label="Settings" title="Settings"
              className="inline-flex size-10 items-center justify-center rounded-ds-sm text-ds-on-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
              <Settings className="size-5" aria-hidden />
            </Link>
          )}
        </div>
      </header>
      {open && (
        <div id="portal-drawer" className="portal-drawer fixed inset-x-0 top-[57px] bottom-0 z-20 flex flex-col overflow-y-auto bg-ds-primary pb-6 pt-2 lg:hidden">
          {idCard}
          {links}
          <div className="mt-6">{footer}</div>
        </div>
      )}

      <div className="lg:ml-64">{topHeader}</div>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:ml-64 lg:px-10 lg:py-10">
        <div className="portal-enter mx-auto w-full max-w-6xl"><RequestDetailProvider>{children}</RequestDetailProvider></div>
      </main>
    </div>
  );
}

export function PageHead({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="ds-section-title uppercase text-ds-primary">{title}</h2>
        {children && <div className="ds-body mt-1 text-ds-text-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export const actionCls = "ds-button-text inline-flex min-h-12 items-center gap-2 rounded-ds-sm bg-ds-action px-6 uppercase text-ds-on-action ds-transition hover:bg-ds-action-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus";
export const panelCls = "rounded-ds bg-ds-surface shadow-[var(--ds-shadow)]";
