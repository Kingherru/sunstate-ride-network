import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users as UsersIcon,
  Building2,
  Building,
  Car,
  CalendarClock,
  DollarSign,
  Plug,
  Wallet,
  FileText,
  Search as SearchIcon,
  BookOpen,
  Settings,
  Palette,
  ShieldCheck,
  ClipboardList,
  History,
  ShieldAlert,
  Radar,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DOC_LABEL } from "@/lib/provider-docs";
import type { Database } from "@/integrations/supabase/types";
import { AdminThemePanel } from "@/components/AdminThemePanel";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import { RegisteredMembersList } from "@/components/admin/RegisteredMembersList";
import { AdminDispatchPanel } from "@/components/AdminDispatchPanel";
import { StaffPermissionsPanel } from "@/components/StaffPermissionsPanel";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { ExpiringCredentialsPanel } from "@/components/ExpiringCredentialsPanel";
import { ChangelogPanel } from "@/components/dashboard/ChangelogPanel";
import { SystemSettingsPanel } from "@/components/SystemSettingsPanel";
import { MonthlyPayoutReport } from "@/components/MonthlyPayoutReport";
import { PlatformWebhooksPanel } from "@/components/PlatformWebhooksPanel";
import { useCapabilities, permissionMessage } from "@/lib/permissions";
import { useUnreadCounts, useMarkTabViewed } from "@/hooks/useUnreadCounts";
import { TAB_KEYS, type TabKey } from "@/lib/unread.functions";

import { reviewProviderApplication } from "@/lib/staff.functions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — MyFloridaNemt.com" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Application = Database["public"]["Tables"]["provider_applications"]["Row"];
type DocEntry = { kind: string; path: string; filename: string; size: number };
type StatusFilter = "all" | "new" | "approved" | "denied";

type TabId =
  | "overview"
  | "users"
  | "providers"
  | "facilities"
  | "trips"
  | "reservations"
  | "dispatch"
  | "credentials"
  | "pricing"
  | "integrations"
  | "payouts"
  | "content"
  | "seo"
  | "blog"
  | "theme"
  | "staff"
  | "audit"
  | "changelog"
  | "system";

type NavItem = {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (caps: ReturnType<typeof useCapabilities>) => boolean;
};

type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard, visible: (c) => c.isOps },
    ],
  },
  {
    label: "People & Accounts",
    items: [
      { id: "users", label: "Users", icon: UsersIcon, visible: (c) => c.isAdmin },
      { id: "providers", label: "Providers", icon: Building2, visible: (c) => c.isOps },
      { id: "facilities", label: "Facilities", icon: Building, visible: (c) => c.isOps },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "trips", label: "Trips", icon: Car, visible: (c) => c.isOps },
      { id: "reservations", label: "Reservations", icon: CalendarClock, visible: (c) => c.isOps },
      { id: "dispatch", label: "Dispatch", icon: Radar, visible: (c) => c.canDispatch },
      { id: "credentials", label: "Expiring credentials", icon: ShieldAlert, visible: (c) => c.canDispatch },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "pricing", label: "Pricing", icon: DollarSign, visible: (c) => c.canConfigurePricing },
      { id: "payouts", label: "Payouts", icon: Wallet, visible: (c) => c.isOps },
      { id: "integrations", label: "Integrations", icon: Plug, visible: (c) => c.isAdmin },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "content", label: "Content management", icon: FileText, visible: (c) => c.isAdmin },
      { id: "seo", label: "SEO settings", icon: SearchIcon, visible: (c) => c.isAdmin },
      { id: "blog", label: "Blog / Resources", icon: BookOpen, visible: (c) => c.isAdmin },
    ],
  },
  {
    label: "System",
    items: [
      { id: "theme", label: "Theme & branding", icon: Palette, visible: (c) => c.canConfigurePricing },
      { id: "staff", label: "Staff permissions", icon: ShieldCheck, visible: (c) => c.canManageStaff },
      { id: "audit", label: "Audit log", icon: ClipboardList, visible: (c) => c.canViewAuditLog },
      { id: "changelog", label: "Changelog", icon: History, visible: (c) => c.isOps },
      { id: "system", label: "System settings", icon: Settings, visible: (c) => c.isAdmin },
    ],
  },
];

function AdminPage() {
  const qc = useQueryClient();
  const caps = useCapabilities();
  const [tab, setTab] = useState<TabId>("overview");

  const unread = useUnreadCounts(caps.userId ?? null);
  const markViewed = useMarkTabViewed(caps.userId ?? null);
  const adminTabKeyFor = (id: TabId): TabKey | null => {
    if (id === "reservations") return TAB_KEYS.adminReservations;
    if (id === "dispatch") return TAB_KEYS.adminDispatch;
    if (id === "trips") return TAB_KEYS.adminTrips;
    return null;
  };
  const handleAdminTab = (id: TabId) => {
    setTab(id);
    const key = adminTabKeyFor(id);
    if (key) markViewed(key);
  };
  useEffect(() => {
    const key = adminTabKeyFor(tab);
    if (key && ((unread as any)[key] ?? 0) > 0) markViewed(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, (unread as any)[adminTabKeyFor(tab) ?? ""]]);



  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (!caps.loaded) {
    return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;
  }

  if (!caps.isOps) {
    return (
      <section className="min-h-[70vh] grid place-items-center px-6 py-20">
        <div className="max-w-md text-center bg-card border border-border rounded-2xl p-8">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-3">
            Access required
          </p>
          <h1 className="text-2xl font-extrabold tracking-tighter mb-3">Staff role needed</h1>
          <p className="text-sm text-muted mb-6">
            You're signed in as <strong>{caps.email}</strong>, but your account has no staff role.
            Ask an administrator to grant access.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="text-sm font-bold underline underline-offset-4">Back home</Link>
            <button onClick={signOut} className="text-sm font-bold text-accent">Sign out</button>
          </div>
        </div>
      </section>
    );
  }

  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => i.visible(caps)) }))
    .filter((g) => g.items.length > 0);

  const activeItem =
    visibleGroups.flatMap((g) => g.items).find((i) => i.id === tab) ?? { id: "overview", label: "Overview" };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-border">
            <div className="px-2 py-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">MyFloridaNemt.com</p>
              <p className="text-sm font-extrabold tracking-tight">Admin</p>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {visibleGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const tk = adminTabKeyFor(item.id);
                      const badge = tk ? ((unread as any)[tk] ?? 0) : 0;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={tab === item.id}
                            onClick={() => handleAdminTab(item.id)}
                            tooltip={item.label}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            {badge > 0 && (
                              <span
                                aria-label={`${badge} new`}
                                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white animate-pulse"
                              >
                                {badge > 99 ? "99+" : badge}
                              </span>
                            )}
                          </SidebarMenuButton>

                        </SidebarMenuItem>
                      );
                    })}

                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={signOut} tooltip="Sign out">
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="h-14 flex items-center gap-3 border-b border-border px-4 sticky top-0 bg-background z-10">
            <SidebarTrigger />
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-extrabold tracking-tight truncate">{activeItem.label}</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
              <span className="truncate max-w-[220px]">{caps.email}</span>
              <span className="inline-flex flex-wrap gap-1">
                {caps.roles.map((r) => (
                  <span key={r} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    {r.replace("_", " ")}
                  </span>
                ))}
              </span>
            </div>
          </header>

          <main className="p-6 max-w-[1500px] w-full mx-auto">
            <TabPanel tab={tab} caps={caps} />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function TabPanel({ tab, caps }: { tab: TabId; caps: ReturnType<typeof useCapabilities> }) {
  switch (tab) {
    case "overview": return <OverviewTab />;
    case "users": return caps.isAdmin ? <AdminUsersPanel /> : <NoAccess />;
    case "providers": return <ProvidersTab caps={caps} />;
    case "dispatch": return caps.canDispatch ? <AdminDispatchPanel /> : <NoAccess />;
    case "credentials": return caps.canDispatch ? <ExpiringCredentialsPanel /> : <NoAccess />;
    case "staff": return caps.canManageStaff ? <StaffPermissionsPanel callerIsAdmin={caps.isAdmin} /> : <NoAccess />;
    case "audit": return caps.canViewAuditLog ? <AuditLogPanel /> : <NoAccess />;
    case "theme": return caps.canConfigurePricing ? <AdminThemePanel /> : <NoAccess />;
    case "changelog": return <ChangelogPanel />;
    case "facilities": return caps.isOps ? <RegisteredMembersList portal="facility" title="Facilities" /> : <NoAccess />;
    case "trips": return <ComingSoon title="Trips" description="Search, review, and export completed and in-progress trips across all providers." />;
    case "reservations": return <ComingSoon title="Reservations" description="Global view of scheduled and recurring rides awaiting a provider." />;
    case "pricing": return <ComingSoon title="Pricing" description="Configure statewide base fares, per-mile rates, and surge windows." />;
    case "integrations": return caps.isAdmin ? <PlatformWebhooksPanel /> : <NoAccess />;
    case "payouts": return caps.isAdmin ? <MonthlyPayoutReport scope="admin" title="Monthly billing & payout report — all providers" /> : <NoAccess />;
    case "content": return <ComingSoon title="Content management" description="Edit marketing pages, service-area copy, and static site content." />;
    case "seo": return <ComingSoon title="SEO settings" description="Site-wide meta defaults, robots directives, and sitemap controls." />;
    case "blog": return <ComingSoon title="Blog / Resources" description="Author, edit, and publish resource articles. Direct link: /resources." />;
    case "system": return caps.isAdmin ? <SystemSettingsPanel /> : <NoAccess />;
    default: return <OverviewTab />;
  }
}

function NoAccess() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 text-sm text-muted">
      You don't have permission to view this section.
    </div>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-8">
      <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-2">Admin</p>
      <h2 className="text-2xl font-extrabold tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted max-w-2xl">{description}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted">Coming soon</p>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-2">Internal · admin only</p>
        <h2 className="text-lg font-extrabold tracking-tight">Portal QA &amp; test access</h2>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Jump into any portal exactly as that user type would see it. Use the dashboard links if
          you're signed in as that role, or open a login page to test the sign-up flow.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <PortalTestCard label="Patient" tone="primary" description="Riders requesting Medicaid transportation." dashboardTo="/patient/dashboard" loginTo="/patient/login" />
          <PortalTestCard label="Provider" tone="accent" description="NEMT companies receiving trip leads." dashboardTo="/provider/dashboard" loginTo="/provider/login" />
          <PortalTestCard label="Facility" tone="success" description="Clinics & coordinators referring patients." dashboardTo="/facility/dashboard" loginTo="/facility/login" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link to="/dashboard" className="px-3 py-1.5 border border-border rounded-sm font-semibold hover:border-primary/40">Generic /dashboard router</Link>
          <Link to="/" className="px-3 py-1.5 border border-border rounded-sm font-semibold hover:border-primary/40">Public home</Link>
          <Link to="/auth" className="px-3 py-1.5 border border-border rounded-sm font-semibold hover:border-primary/40">Legacy /auth</Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Providers ---------------- */

function ProvidersTab({ caps }: { caps: ReturnType<typeof useCapabilities> }) {
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewProviderApplication);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const appsQ = useQuery({
    queryKey: ["admin", "provider_applications"],
    enabled: caps.isOps,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const apps = appsQ.data ?? [];

  const cities = useMemo(
    () => Array.from(new Set(apps.map((a) => a.city).filter(Boolean))).sort(),
    [apps],
  );

  const filtered = apps.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (cityFilter !== "all" && a.city !== cityFilter) return false;
    if (regionFilter !== "all" && a.region !== regionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const blob = `${a.company_name} ${a.first_name ?? ""} ${a.last_name ?? ""} ${a.email} ${a.phone} ${a.zip_code ?? ""} ${a.county ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const byRegion = useMemo(() => {
    const map = new Map<string, Application[]>();
    apps.forEach((a) => {
      const k = a.region ?? "Statewide Florida";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    });
    return map;
  }, [apps]);

  const counts = {
    total: apps.length,
    new: apps.filter((a) => a.status === "new").length,
    approved: apps.filter((a) => a.status === "approved").length,
    denied: apps.filter((a) => a.status === "denied").length,
  };

  async function updateStatus(id: string, status: "approved" | "denied", notes?: string) {
    if (!caps.canReviewProviders) {
      toast.error(permissionMessage("canReviewProviders"));
      return;
    }
    try {
      await reviewFn({ data: { id, status, notes } });
      toast.success(status === "approved" ? "Provider approved" : "Provider denied");
      qc.invalidateQueries({ queryKey: ["admin", "provider_applications"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  }

  const selected = selectedId ? apps.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      <RegisteredMembersList portal="provider" title="Registered providers" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={counts.total} />
        <Stat label="New" value={counts.new} tone="accent" />
        <Stat label="Approved" value={counts.approved} tone="success" />
        <Stat label="Denied" value={counts.denied} tone="danger" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">By region</h2>
        <div className="flex flex-wrap gap-2">
          {Array.from(byRegion.entries()).map(([region, list]) => (
            <button
              key={region}
              onClick={() => setRegionFilter(regionFilter === region ? "all" : region)}
              className={`text-xs font-semibold px-3 py-2 rounded-sm border transition ${
                regionFilter === region
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/40"
              }`}
            >
              {region} <span className="opacity-60">· {list.length}</span>
            </button>
          ))}
          {regionFilter !== "all" && (
            <button onClick={() => setRegionFilter("all")} className="text-xs font-semibold px-3 py-2 rounded-sm border border-border text-muted hover:text-foreground">Clear</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="bg-card border border-border rounded-sm px-3 py-2 text-sm">
          <option value="new">New ({counts.new})</option>
          <option value="approved">Approved ({counts.approved})</option>
          <option value="denied">Denied ({counts.denied})</option>
          <option value="all">All ({counts.total})</option>
        </select>
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-card border border-border rounded-sm px-3 py-2 text-sm">
          <option value="all">All cities</option>
          {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <input
          placeholder="Search company, name, email, ZIP, county…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] bg-card border border-border rounded-sm px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/50 border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Company / Contact</th>
                <th className="px-4 py-3 font-semibold">City / ZIP</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">Services</th>
                <th className="px-4 py-3 font-semibold">Docs</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {appsQ.isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Loading…</td></tr>
              )}
              {!appsQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No applications match filters.</td></tr>
              )}
              {filtered.map((a) => {
                const docs = (a.documents as unknown as DocEntry[]) ?? [];
                return (
                  <tr key={a.id} className="border-b border-border hover:bg-background/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{a.company_name}</div>
                      <div className="text-xs text-muted">
                        {a.first_name || a.last_name
                          ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim()
                          : a.contact_name}
                      </div>
                      <div className="text-xs text-muted">{a.email} · {a.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{a.city}</div>
                      <div className="text-xs text-muted">
                        {a.zip_code ?? "—"}{a.county ? ` · ${a.county}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{a.region ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{(a.service_types ?? []).join(", ")}</td>
                    <td className="px-4 py-3 text-xs">{docs.length}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelectedId(a.id)} className="text-xs font-bold text-primary hover:underline">
                        Review →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ReviewDrawer
          app={selected}
          readOnly={!caps.canReviewProviders}
          readOnlyReason={permissionMessage("canReviewProviders")}
          onClose={() => setSelectedId(null)}
          onApprove={(notes) => updateStatus(selected.id, "approved", notes)}
          onDeny={(notes) => updateStatus(selected.id, "denied", notes)}
        />
      )}
    </div>
  );
}

/* ---------------- Shared helpers ---------------- */

function PortalTestCard({
  label,
  description,
  dashboardTo,
  loginTo,
  tone,
}: {
  label: string;
  description: string;
  dashboardTo: string;
  loginTo: string;
  tone: "primary" | "accent" | "success";
}) {
  const accent =
    tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-emerald-600";
  return (
    <div className="border border-border rounded-xl p-4 bg-background/40 flex flex-col gap-3">
      <div>
        <div className={`text-xs font-mono font-bold uppercase tracking-widest ${accent}`}>
          {label} portal
        </div>
        <p className="text-xs text-muted mt-1">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-auto">
        <Link
          to={dashboardTo as any}
          className="text-xs font-bold px-3 py-1.5 border border-primary/40 text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition"
        >
          Open dashboard →
        </Link>
        <a
          href={loginTo}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold px-3 py-1.5 border border-border rounded-sm hover:border-primary/40"
        >
          Login page ↗
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "success" | "danger" }) {
  const color =
    tone === "accent" ? "text-accent" :
    tone === "success" ? "text-emerald-600" :
    tone === "danger" ? "text-red-600" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-accent/15 text-accent",
    approved: "bg-emerald-100 text-emerald-700",
    denied: "bg-red-100 text-red-700",
  };
  const cls = map[status] ?? "bg-muted/20 text-muted-foreground";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

function ReviewDrawer({
  app,
  onClose,
  onApprove,
  onDeny,
  readOnly = false,
  readOnlyReason,
}: {
  app: Application;
  onClose: () => void;
  onApprove: (notes?: string) => void;
  onDeny: (notes: string) => void;
  readOnly?: boolean;
  readOnlyReason?: string;
}) {
  const [notes, setNotes] = useState(app.review_notes ?? "");
  const docs = ((app.documents as unknown) as DocEntry[]) ?? [];

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage
      .from("provider-docs")
      .createSignedUrl(path, 120);
    if (error || !data) {
      toast.error("Could not open document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-2xl bg-background border-l border-border overflow-y-auto"
      >
        <div className="p-6 border-b border-border flex items-start justify-between gap-4 sticky top-0 bg-background z-10">
          <div>
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest">
              Provider review
            </p>
            <h2 className="text-2xl font-extrabold tracking-tighter mt-1">{app.company_name}</h2>
            <p className="text-xs text-muted mt-1">
              Submitted {new Date(app.created_at).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-muted hover:text-foreground">Close</button>
        </div>

        <div className="p-6 space-y-6">
          <Section title="Contact">
            <Field label="Name" value={`${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || app.contact_name || "—"} />
            <Field label="Email" value={app.email} />
            <Field label="Dispatch email" value={app.dispatch_email ?? "—"} />
            <Field label="Phone" value={app.phone} />
          </Section>

          <Section title="Location & Service Area">
            <Field label="City" value={app.city} />
            <Field label="County" value={app.county ?? "—"} />
            <Field label="ZIP" value={app.zip_code ?? "—"} />
            <Field label="Region" value={app.region ?? "—"} />
            <Field
              label="Preferred ZIP codes"
              value={(app.preferred_zip_codes ?? []).length ? (app.preferred_zip_codes ?? []).join(", ") : "—"}
            />
            <Field label="Service types" value={(app.service_types ?? []).join(", ") || "—"} />
            <Field label="Fleet size" value={app.fleet_size?.toString() ?? "—"} />
          </Section>

          <Section title="Credentials">
            <Field label="EIN" value={app.ein ?? "—"} />
            <Field label="NPI" value={app.npi ?? "—"} />
            <Field label="Driver license #" value={app.driver_license_number ?? "—"} />
            <Field label="Insurance carrier" value={app.insurance_carrier ?? "—"} />
            <Field label="Policy #" value={app.insurance_policy_number ?? "—"} />
          </Section>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
              Documents ({docs.length})
            </h3>
            <div className="space-y-2">
              {docs.length === 0 && <p className="text-sm text-muted">No documents uploaded.</p>}
              {docs.map((d) => (
                <div key={d.path} className="flex items-center justify-between gap-3 border border-border rounded-sm p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{DOC_LABEL[d.kind as keyof typeof DOC_LABEL] ?? d.kind}</p>
                    <p className="text-xs text-muted truncate">{d.filename} · {(d.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    onClick={() => openDoc(d.path)}
                    className="text-xs font-bold uppercase tracking-widest text-primary hover:underline shrink-0"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>

          {app.notes && (
            <Section title="Applicant notes">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{app.notes}</p>
            </Section>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Review notes (visible to staff)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full bg-card border border-border rounded-sm px-3 py-2 text-sm"
              placeholder="Reason for approval / denial…"
            />
          </div>

          {readOnly ? (
            <div className="pt-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              🔒 {readOnlyReason ?? "You don't have permission to approve or deny this application."}
            </div>
          ) : (
            <div className="flex gap-3 pt-2 sticky bottom-0 bg-background pb-2">
              <button
                onClick={() => {
                  if (notes.trim().length < 3) {
                    toast.error("Please provide a brief reason before denying.");
                    return;
                  }
                  onDeny(notes.trim());
                  onClose();
                }}
                className="flex-1 px-4 py-3 border border-red-600 text-red-600 font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-red-50 transition"
              >
                Deny
              </button>
              <button
                onClick={() => {
                  onApprove(notes.trim() || undefined);
                  onClose();
                }}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition"
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}
