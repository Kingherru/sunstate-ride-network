import { createFileRoute, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";
import { createTrip, createTripsBulk, listRegionalProviders, assignTrip, updateTripStatus, updateTripDetails, recordHipaaAck } from "@/lib/trips.functions";
import { ensureMyDisplayId } from "@/lib/system-ids.functions";
import { downloadTripPdf, normalizeCsvHeader, type TripPdfInput } from "@/lib/trip-pdf";
import type { Database } from "@/integrations/supabase/types";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { PricingPanel } from "@/components/dashboard/PricingPanel";
import { SavedPatientsPanel } from "@/components/dashboard/SavedPatientsPanel";
import { PatientProviderContactsPanel } from "@/components/dashboard/PatientProviderContactsPanel";
import { BusinessInfoPanel } from "@/components/dashboard/BusinessInfoPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { RulesPanel } from "@/components/dashboard/RulesPanel";
import { NetworkPanel } from "@/components/dashboard/NetworkPanel";
import { MessagesPanel } from "@/components/dashboard/MessagesPanel";
import { ChangelogPanel } from "@/components/dashboard/ChangelogPanel";
import { listThreads } from "@/lib/messages.functions";
import { ProviderCredentialsPanel } from "@/components/dashboard/ProviderCredentialsPanel";
import { FacilityProvidersPanel } from "@/components/dashboard/FacilityProvidersPanel";
import { ScheduleCalendarPanel } from "@/components/dashboard/ScheduleCalendarPanel";
import { getMyWorkHours, saveMyWorkHours } from "@/lib/schedule-board.functions";
import { useServerFn } from "@tanstack/react-start";
import { useTripSync } from "@/hooks/useTripSync";
import { useUnreadCounts, useMarkTabViewed } from "@/hooks/useUnreadCounts";
import { TAB_KEYS, type TabKey } from "@/lib/unread.functions";

import { PaymentStatusControl } from "@/components/dashboard/PaymentStatusControl";
import { MedicaidSubmissionCenter } from "@/components/dashboard/MedicaidSubmissionCenter";
import { TrainingPanel } from "@/components/dashboard/TrainingPanel";
import { SavedCards } from "@/components/payments/SavedCards";
import { ChangelogChip } from "@/components/ChangelogChip";

import { demoProfile, demoTrips } from "@/lib/demo-data";
import {
  PATIENT_TYPE_OPTIONS,
  PATIENT_RELATIONSHIP_OPTIONS,
  formatPatientType,
  formatPatientRelationship,
} from "@/lib/patient-relationships";
import { computeProviderOnboarding, SOFT_ACCESS_TABS } from "@/lib/provider-onboarding";
import { ProviderOnboardingChecklist } from "@/components/onboarding/ProviderOnboardingChecklist";
import { Lock } from "lucide-react";

function PaymentsTab({ portal }: { portal: PortalKind }) {
  const isFacility = portal === "facility";
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Payments</h2>
        <p className="text-sm text-muted-foreground">
          {isFacility
            ? "Add a card and assign it to a specific patient — facilities can hold cards on file for many patients."
            : "Securely save a card so you can pay for confirmed trips in one click."}
        </p>
      </div>
      <SavedCards assignToPatient={isFacility} />
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MyFloridaNemt.com" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardRouter,
});

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["member_profiles"]["Row"];

export type PortalKind = "patient" | "provider" | "facility";
type Tab = "received" | "sent" | "new" | "upload" | "requests" | "reservations" | "network" | "rules" | "contacts" | "providers" | "saved_providers" | "saved_patients" | "vehicles" | "drivers" | "pricing" | "memberships" | "payouts" | "integrations" | "payments" | "business_info" | "schedule" | "medicaid" | "training" | "messages" | "changelog" | "account" | "onboarding";

const PORTAL_TABS: Record<PortalKind, Tab[]> = {
  patient:  ["new", "sent", "saved_patients", "messages", "payments", "account"],
  provider: ["onboarding", "reservations", "schedule", "received", "sent", "new", "vehicles", "saved_patients", "medicaid", "training", "messages", "account"],
  facility: ["new", "sent", "upload", "providers", "saved_providers", "saved_patients", "messages", "payments", "account"],
};



const PORTAL_META: Record<PortalKind, { label: string; heroText: string }> = {
  patient:  { label: "Patient Dashboard",  heroText: "Request rides and track your appointments." },
  provider: { label: "Provider Dashboard", heroText: "Dispatch trips, manage drivers, and get paid." },
  facility: { label: "Facility Dashboard", heroText: "Book transportation for many patients in one place." },
};

function tabLabel(t: Tab, portal: PortalKind, counts: { received: number; sent: number }): string {
  if (t === "received") return `Referrals (${counts.received})`;
  if (t === "sent") return portal === "patient" ? `My Rides (${counts.sent})` : `Trip History (${counts.sent})`;
  if (t === "new") return portal === "patient" ? "Request a ride" : "New trip";
  if (t === "upload") return "Upload CSV";
  if (t === "requests") return "Requests";
  if (t === "reservations") return "Reservations";
  if (t === "network") return "Provider Network";
  if (t === "rules") return "Rules";
  if (t === "contacts") return portal === "facility" ? "Patients" : portal === "provider" ? "Saved Contacts" : "Contacts";
  if (t === "providers") return "Find Providers";
  if (t === "saved_providers") return "Saved Providers";
  if (t === "vehicles") return "Vehicles & Drivers";
  if (t === "drivers") return "Drivers";
  if (t === "pricing") return "Pricing";
  if (t === "memberships") return "Membership";
  if (t === "payouts") return "Payouts";
  if (t === "integrations") return "Integrations";
  if (t === "payments") return "Payments";
  if (t === "saved_patients") return "Contacts";
  if (t === "business_info") return "Business Info";
  if (t === "medicaid") return "Medicaid Submission";
  if (t === "training") return "Training & Tests";
  if (t === "schedule") return "Schedule";
  if (t === "messages") return "Messages";
  if (t === "changelog") return "Changelog";
  if (t === "onboarding") return "Onboarding";
  return "Account";
}



/** /dashboard redirects to /{portal}/dashboard based on the user's signup portal. */
function DashboardRouter() {
  const navigate = useNavigate();
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const portal = (data.user?.user_metadata?.portal as PortalKind | undefined) ?? "provider";
      navigate({ to: `/${portal}/dashboard`, replace: true } as any);
    });
  }, [navigate]);
  return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading dashboard…</div>;
}

export function DashboardPage({ portalOverride }: { portalOverride?: PortalKind } = {}) {
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const portal: PortalKind =
    portalOverride ??
    (pathname.startsWith("/patient") ? "patient"
      : pathname.startsWith("/facility") ? "facility"
      : "provider");
  const allowedTabs = PORTAL_TABS[portal];
  const meta = PORTAL_META[portal];

  const [tab, setTab] = useState<Tab>(allowedTabs[0]);
  useEffect(() => { if (tab !== "changelog" && !allowedTabs.includes(tab)) setTab(allowedTabs[0]); }, [allowedTabs, tab]);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  // Realtime cross-tab sync — Reservations ↔ Schedule ↔ Referrals ↔ Trip History
  useTripSync(userId);

  // Real-time sidebar badges: unread counts per queue tab
  const unread = useUnreadCounts(userId);
  const markViewed = useMarkTabViewed(userId);

  // Map portal + tab → tab_key we track for unread counts
  function tabKeyFor(t: Tab): TabKey | null {
    if (portal === "provider" && t === "reservations") return TAB_KEYS.providerReservations;
    if (portal === "provider" && t === "received") return TAB_KEYS.providerReferrals;
    if (portal === "facility" && t === "sent") return TAB_KEYS.facilitySent;
    if (portal === "patient" && t === "sent") return TAB_KEYS.patientSent;
    return null;
  }

  function handleTab(t: Tab) {
    setTab(t);
    const key = tabKeyFor(t);
    if (key) markViewed(key);
  }

  // Clear badge when a tab is already the current view (e.g. after realtime bump).
  useEffect(() => {
    const key = tabKeyFor(tab);
    if (key && (unread as any)[key] > 0) markViewed(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, (unread as any)[tabKeyFor(tab) ?? ""]]);



  const adminQ = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
  const isAdmin = !!adminQ.data;

  const profileQ = useQuery({
    queryKey: ["member-profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("member_profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const displayIdQ = useQuery({
    queryKey: ["my-display-id", userId],
    enabled: !!userId,
    queryFn: () => ensureMyDisplayId(),
  });

  const tripsQ = useQuery({
    queryKey: ["my-trips", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("pickup_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Provider onboarding — counts of vehicles/drivers drive soft-access unlock.
  const vehiclesQ = useQuery({
    queryKey: ["onboarding-vehicles", userId],
    enabled: !!userId && (portalOverride ?? "provider") === "provider",
    queryFn: async () => {
      const { count } = await supabase
        .from("vehicles").select("id", { count: "exact", head: true })
        .eq("owner_id", userId!);
      return count ?? 0;
    },
  });
  const driversQ = useQuery({
    queryKey: ["onboarding-drivers", userId],
    enabled: !!userId && (portalOverride ?? "provider") === "provider",
    queryFn: async () => {
      const { count } = await supabase
        .from("drivers").select("id", { count: "exact", head: true })
        .eq("owner_id", userId!);
      return count ?? 0;
    },
  });



  const realProfile = profileQ.data as (Profile & { membership_tier?: string }) | null;
  // Admin previewing a portal: synthesize a profile + sample trips so the UI is visible without onboarding.
  const profile: (Profile & { membership_tier?: string }) | null =
    realProfile ?? (isAdmin && userId && userEmail ? (demoProfile(portal, userId, userEmail) as any) : null);
  const isDemo = isAdmin && !realProfile;
  const isActive = profile?.membership_status === "active";

  // Provider soft-access: portal starts locked until business profile is complete.
  const onboarding = useMemo(
    () => computeProviderOnboarding({
      profile: realProfile,
      vehiclesCount: vehiclesQ.data ?? 0,
      driversCount: driversQ.data ?? 0,
    }),
    [realProfile, vehiclesQ.data, driversQ.data],
  );
  const isSoftAccess = portal === "provider" && !isAdmin && !!realProfile && !onboarding.complete;
  const isTabLocked = (t: Tab) =>
    isSoftAccess && !(SOFT_ACCESS_TABS as readonly string[]).includes(t);

  // Patients & facilities can always send (book); providers still require paid membership.
  const canSend = portal === "provider" ? (isActive && profile?.membership_tier === "paid") : !!profile;
  const realTrips = tripsQ.data ?? [];
  const demo = isAdmin && userId ? demoTrips(portal, userId) : { sent: [], received: [] };
  const sent = [...realTrips.filter((t) => t.created_by === userId), ...(isAdmin ? demo.sent : [])];
  const received = [...realTrips.filter((t) => t.assigned_to === userId), ...(isAdmin ? demo.received : [])];

  const upcoming = sent.filter((t) => ["scheduled","assigned","in_progress"].includes((t.status ?? "").toLowerCase())).length;
  const completed = sent.filter((t) => (t.status ?? "").toLowerCase() === "completed").length;

  const listThreadsFn = useServerFn(listThreads);
  const unreadQ = useQuery({
    queryKey: ["msg-unread-total", userId],
    enabled: !!userId,
    queryFn: async () => {
      const r = await listThreadsFn();
      return r.ok ? (r.total_unread ?? 0) : 0;
    },
    refetchInterval: 60_000,
  });
  const unreadTotal = unreadQ.data ?? 0;

  return (
    <div className="portal-scope min-h-screen flex">
      <PortalSidebar
        portal={portal}
        profile={profile}
        userEmail={userEmail}
        allowedTabs={allowedTabs}
        currentTab={tab}
        onTab={handleTab}
        counts={{ received: received.length, sent: sent.length, unread: unreadTotal }}
        unread={unread as Partial<Record<TabKey, number>>}
        tabKeyFor={tabKeyFor}

        membershipStatus={profile?.membership_status ?? "inactive"}
        onSavedName={() => qc.invalidateQueries({ queryKey: ["member-profile"] })}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="h-16 bg-card border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">{portal} / {tabLabel(tab, portal, { received: received.length, sent: sent.length })}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {displayIdQ.data?.display_id && (
              <span className="font-mono font-bold uppercase tracking-wider text-primary" title="Your permanent system ID">
                ID · {displayIdQ.data.display_id}
              </span>
            )}
            <span className="font-mono uppercase tracking-wider text-muted-foreground">Live</span>
            <span className="size-2 rounded-full bg-[oklch(0.872_0.078_65.2)] animate-pulse" />
          </div>
        </div>

        <div className="px-8 py-7 space-y-7">
        {isAdmin && (
          <div className="flex items-center justify-between gap-3 bg-[oklch(0.18_0.05_257)] text-white px-4 py-2.5 text-sm border-l-4 border-[oklch(0.872_0.078_65.2)]">
            <span className="font-bold uppercase tracking-wider text-xs">
              Admin preview · {portal} dashboard{isDemo ? " · demo data" : ""}
            </span>
            <Link to="/admin" className="font-bold text-[oklch(0.92_0.07_65)] hover:underline text-xs uppercase tracking-wider">
              ← Back to admin
            </Link>
          </div>
        )}

        {isDemo && (
          <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-2.5 text-xs text-amber-900">
            <strong>Demo data shown.</strong> Items marked “(DEMO)” are placeholders so you can see the layout — nothing is saved.
          </div>
        )}

        {!profileQ.isLoading && !profile && userId && userEmail && (
          <ProfileSetup userId={userId} userEmail={userEmail} portal={portal} onSaved={() => qc.invalidateQueries({ queryKey: ["member-profile"] })} />
        )}

        {profile && (
          <>
            {/* Hero header */}
            <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end pb-2 border-b border-border">
              <div>
                <div className="text-xs font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.04_220)] mb-2">MyFloridaNemt.com · {portal}</div>
                <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-brand">{meta.label}</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">{meta.heroText}</p>
              </div>
              <div className="grid grid-cols-3 gap-px bg-border border border-border min-w-[420px]">
                <StatCell label="Referrals" value={received.length} accent />
                <StatCell label="Upcoming" value={upcoming} />
                <StatCell label="Completed" value={completed} />
              </div>
            </div>

            {portal === "provider" && !canSend && (
              <div className="bg-[oklch(0.96_0.05_55)] border-l-4 border-[oklch(0.70_0.18_45)] p-4 text-sm">
                <p className="font-bold text-[oklch(0.35_0.12_45)] uppercase tracking-wide text-xs mb-1">Free plan</p>
                <p className="text-[oklch(0.30_0.08_45)]">
                  Receive referrals, manage reservations, vehicles, drivers &amp; trip history. Upgrade to a paid membership ($5/year) to send trips, bulk upload, and use API integrations.{" "}
                  <Link to="/membership" className="underline font-bold">Upgrade now →</Link>
                </p>
              </div>
            )}

            {/* Active panel */}
            <section className="bg-card border border-border shadow-card">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-display text-lg font-bold tracking-tight text-brand">{tabLabel(tab, portal, { received: received.length, sent: sent.length })}</h2>
              </div>
              <div className="p-6">
            {isTabLocked(tab) ? (
              <LockedTabOverlay
                onboarding={onboarding}
                onGoToOnboarding={() => handleTab("onboarding")}
              />
            ) : (<>
            {tab === "onboarding" && portal === "provider" && (
              <ProviderOnboardingChecklist
                onboarding={onboarding}
                onGoToStep={(t) => handleTab(t as Tab)}
              />
            )}
            {tab === "received" && (() => {
              const isFlNemt = (s: string | null | undefined) => {
                const v = (s ?? "").toLowerCase();
                return v === "auto" || v === "floridanemt" || v === "florida_nemt" || v === "florida-nemt" || v === "";
              };
              const flNemt = received.filter((t) => isFlNemt((t as any).source));
              const subProv = received.filter((t) => !isFlNemt((t as any).source));
              const onChanged = () => qc.invalidateQueries({ queryKey: ["my-trips"] });
              return (
                <div className="space-y-8">
                  <section>
                    <div className="mb-3">
                      <h3 className="font-display text-base font-bold tracking-tight">MyFloridaNemt.com Submissions <span className="text-muted-foreground font-normal">({flNemt.length})</span></h3>
                      <p className="text-sm text-muted-foreground">Auto-routed referrals from MyFloridaNemt.com based on your service area.</p>
                    </div>
                    {flNemt.length === 0
                      ? <div className="bg-secondary border border-border p-6 text-sm text-muted-foreground">No MyFloridaNemt.com referrals right now.</div>
                      : <TripList trips={flNemt} userId={userId!} role="recipient" onChanged={onChanged} />}
                  </section>
                  <section>
                    <div className="mb-3">
                      <h3 className="font-display text-base font-bold tracking-tight">Subscribed Provider Submissions <span className="text-muted-foreground font-normal">({subProv.length})</span></h3>
                      <p className="text-sm text-muted-foreground">Trips sent directly to you by providers and facilities in your network.</p>
                    </div>
                    {subProv.length === 0
                      ? <div className="bg-secondary border border-border p-6 text-sm text-muted-foreground">No partner submissions yet.</div>
                      : <TripList trips={subProv} userId={userId!} role="recipient" onChanged={onChanged} />}
                  </section>
                </div>
              );
            })()}
            {tab === "sent" && <TripList trips={sent} userId={userId!} role="sender" portal={portal} onChanged={() => qc.invalidateQueries({ queryKey: ["my-trips"] })} />}
            {tab === "new" && (canSend ? <NewTripForm onCreated={() => { qc.invalidateQueries({ queryKey: ["my-trips"] }); setTab("sent"); }} /> : <PaidOnly />)}
            {tab === "upload" && (canSend ? <CsvUpload onUploaded={() => { qc.invalidateQueries({ queryKey: ["my-trips"] }); setTab("sent"); }} /> : <PaidOnly />)}
            {tab === "reservations" && <ReservationsPanel userId={userId!} />}
            {tab === "schedule" && <ScheduleCalendarPanel />}
            {tab === "rules" && <RulesPanel />}
            {tab === "contacts" && <ContactsPanel />}
            {tab === "providers" && <FacilityProvidersPanel initialMode="lookup" />}
            {tab === "saved_providers" && <FacilityProvidersPanel initialMode="saved" />}
            {tab === "vehicles" && <FleetPanel />}
            {tab === "pricing" && <PricingPanel />}
            {tab === "memberships" && <MembershipsTab profile={profile} />}
            {tab === "payouts" && <PayoutsPanel userId={userId!} />}
            {tab === "integrations" && (canSend ? <IntegrationsPanel /> : <PaidOnly />)}
            {tab === "payments" && <PaymentsTab portal={portal} />}
            {tab === "saved_patients" && (portal === "patient" ? <PatientProviderContactsPanel /> : <SavedPatientsPanel />)}
            {tab === "business_info" && <BusinessInfoPanel />}
            {tab === "medicaid" && <MedicaidSubmissionCenter userId={userId!} />}
            {tab === "training" && <TrainingPanel />}
            {tab === "messages" && <MessagesPanel userId={userId!} portal={portal} />}
            {tab === "changelog" && <ChangelogPanel />}
            {tab === "account" && <AccountPanel profile={profile} portal={portal} userId={userId!} />}
            </>)}
              </div>
            </section>
          </>
        )}
        </div>
      </main>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`px-5 py-4 ${accent ? "bg-[oklch(0.20_0.05_257)] text-white" : "bg-card"}`}>
      <div className={`text-[10px] font-mono uppercase tracking-[0.18em] ${accent ? "text-[oklch(0.92_0.07_65)]" : "text-muted-foreground"}`}>{label}</div>
      <div className={`font-display text-3xl font-bold tracking-tight mt-1 ${accent ? "text-white" : "text-brand"}`}>{value}</div>
    </div>
  );
}


function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active" ? "bg-accent/15 text-accent" :
    status === "past_due" ? "bg-orange-100 text-orange-700" :
    "bg-muted text-muted-foreground";
  const label = status === "active" ? "Active member" : status === "past_due" ? "Past due" : "Not subscribed";
  return <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-sm ${cls}`}>{label}</span>;
}

/* -------- Profile Setup -------- */
function ProfileSetup({ userId, userEmail, portal, onSaved }: { userId: string; userEmail: string; portal: PortalKind; onSaved: () => void }) {
  const isPatient = portal === "patient";
  const [form, setForm] = useState({
    first_name: "", last_name: "", company_name: "", phone: "", dispatch_email: userEmail, city: "", preferred_zip_codes: "",
    date_of_birth: "", medicaid_number: "", medicaid_plan: "", npi: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    patient_type: "", patient_type_other: "",
    patient_relationship: "", patient_relationship_other: "",
  });
  const [busy, setBusy] = useState(false);

  // Prefill patient_type / patient_relationship from auth user metadata (captured at signup)
  useEffect(() => {
    if (!isPatient) return;
    void supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, any>;
      setForm((f) => ({
        ...f,
        patient_type: meta.patient_type ?? f.patient_type,
        patient_type_other: meta.patient_type_other ?? f.patient_type_other,
        patient_relationship: meta.patient_relationship ?? f.patient_relationship,
        patient_relationship_other: meta.patient_relationship_other ?? f.patient_relationship_other,
      }));
    });
  }, [isPatient]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (isPatient) {
      if (!form.patient_type) return toast.error("Please select who is managing the account");
      if (form.patient_type === "Other" && !form.patient_type_other.trim()) return toast.error("Please describe the patient type");
      if (!form.patient_relationship) return toast.error("Please select the relationship to the patient");
      if (form.patient_relationship === "Other" && !form.patient_relationship_other.trim()) return toast.error("Please describe the relationship");
    }
    setBusy(true);
    try {
      const zips = form.preferred_zip_codes.split(/[,\s]+/).map((z) => z.trim()).filter(Boolean);
      const payload: any = {
        user_id: userId,
        first_name: form.first_name,
        last_name: form.last_name,
        company_name: isPatient ? `${form.first_name} ${form.last_name}`.trim() : form.company_name,
        phone: form.phone,
        dispatch_email: form.dispatch_email,
        city: form.city,
        preferred_zip_codes: zips,
        medicaid_number: form.medicaid_number || null,
        medicaid_plan: form.medicaid_plan || null,
        npi: form.npi || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      };
      if (isPatient) {
        payload.patient_type = form.patient_type;
        payload.patient_type_other = form.patient_type === "Other" ? form.patient_type_other.trim() : null;
        payload.patient_relationship = form.patient_relationship;
        payload.patient_relationship_other =
          form.patient_relationship === "Other" ? form.patient_relationship_other.trim() : null;
      }
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      const { error } = await supabase.from("member_profiles").insert(payload);
      if (error) throw error;
      toast.success("Profile created");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl bg-card border border-border rounded-sm p-8">
      <h2 className="text-2xl font-extrabold tracking-tight mb-2">Set up your profile</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {isPatient
          ? "We'll keep your Medicaid info on file so you don't have to retype it every ride."
          : portal === "facility"
          ? "Tell us about your facility so the right providers can serve your patients."
          : "We need a few details to categorize you in the dispatch network."}
      </p>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <Field label="First name" v={form.first_name} on={(v) => setForm({ ...form, first_name: v })} required />
        <Field label="Last name" v={form.last_name} on={(v) => setForm({ ...form, last_name: v })} required />
        {!isPatient && (
          <Field label={portal === "facility" ? "Facility name" : "Company name"} v={form.company_name} on={(v) => setForm({ ...form, company_name: v })} required className="col-span-2" />
        )}
        <Field label="Phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} required />
        <Field label={isPatient ? "Contact email" : "Dispatch email"} v={form.dispatch_email} on={(v) => setForm({ ...form, dispatch_email: v })} required type="email" />
        <Field label="City" v={form.city} on={(v) => setForm({ ...form, city: v })} required placeholder="e.g. Jacksonville" />
        {!isPatient && (
          <Field label="Preferred ZIP codes" v={form.preferred_zip_codes} on={(v) => setForm({ ...form, preferred_zip_codes: v })} placeholder="32202, 32204, 32207" />
        )}
        {isPatient && (
          <>
            <SelectField
              label="Who is managing this account?"
              v={form.patient_type}
              on={(v) => setForm({ ...form, patient_type: v })}
              options={PATIENT_TYPE_OPTIONS as readonly string[]}
              required
            />
            {form.patient_type === "Other" && (
              <Field label="Specify patient type" v={form.patient_type_other} on={(v) => setForm({ ...form, patient_type_other: v })} required />
            )}
            <SelectField
              label="Relationship to patient"
              v={form.patient_relationship}
              on={(v) => setForm({ ...form, patient_relationship: v })}
              options={PATIENT_RELATIONSHIP_OPTIONS as readonly string[]}
              required
            />
            {form.patient_relationship === "Other" && (
              <Field label="Specify relationship" v={form.patient_relationship_other} on={(v) => setForm({ ...form, patient_relationship_other: v })} required />
            )}
            <Field label="Date of birth" v={form.date_of_birth} on={(v) => setForm({ ...form, date_of_birth: v })} type="date" />
            <Field label="Medicaid #" v={form.medicaid_number} on={(v) => setForm({ ...form, medicaid_number: v })} />
            <Field label="Medicaid plan" v={form.medicaid_plan} on={(v) => setForm({ ...form, medicaid_plan: v })} placeholder="e.g. Sunshine Health, Simply" className="col-span-2" />
            <Field label="Emergency contact name" v={form.emergency_contact_name} on={(v) => setForm({ ...form, emergency_contact_name: v })} />
            <Field label="Emergency contact phone" v={form.emergency_contact_phone} on={(v) => setForm({ ...form, emergency_contact_phone: v })} />
          </>
        )}
        {portal === "provider" && (
          <Field label="NPI (optional)" v={form.npi} on={(v) => setForm({ ...form, npi: v })} placeholder="10-digit National Provider Identifier" className="col-span-2" />
        )}
        <button disabled={busy} className="portal-btn-primary col-span-2 mt-2 py-3">
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}

function SelectField({ label, v, on, options, required, className = "" }: {
  label: string; v: string; on: (v: string) => void; options: readonly string[]; required?: boolean; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="portal-label">{label}{required && " *"}</span>
      <select value={v} onChange={(e) => on(e.target.value)} required={required} className="portal-input">
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Field({ label, v, on, required, type = "text", placeholder, className = "" }: {
  label: string; v: string; on: (v: string) => void; required?: boolean; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="portal-label">{label}{required && " *"}</span>
      <input
        type={type} value={v} onChange={(e) => on(e.target.value)} required={required} placeholder={placeholder}
        className="portal-input"
      />
    </label>
  );
}


/* -------- Membership Gate -------- */
function MembershipGate() {
  return (
    <div className="max-w-2xl mx-auto bg-card border border-border rounded-sm p-10 text-center">
      <h2 className="text-3xl font-extrabold tracking-tight mb-2">Activate your $5/year membership</h2>
      <p className="text-muted-foreground mb-6">
        Membership unlocks trip dispatch, CSV upload, and regional provider directory.
      </p>
      <Link to="/membership" className="portal-btn-primary px-6 py-3">
        Subscribe — $5/year
      </Link>
    </div>
  );
}

function LockedTabOverlay({
  onboarding,
  onGoToOnboarding,
}: {
  onboarding: ReturnType<typeof computeProviderOnboarding>;
  onGoToOnboarding: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto bg-card border border-border p-10 text-center">
      <div className="mx-auto h-12 w-12 grid place-items-center bg-primary/10 text-primary mb-4">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="font-display text-2xl font-bold tracking-tight mb-2">
        Locked while your account is in Soft Access
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Finish your business profile to unlock this tab. You've completed{" "}
        <strong>{onboarding.doneCount} of {onboarding.total}</strong> steps —
        {onboarding.remaining} to go.
      </p>
      <div className="mt-4 h-2 w-full max-w-xs mx-auto bg-muted overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${onboarding.percent}%` }} />
      </div>
      <button
        type="button"
        onClick={onGoToOnboarding}
        className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold uppercase tracking-wider hover:bg-primary/90"
      >
        Continue onboarding →
      </button>
      <p className="text-xs text-muted-foreground mt-4">
        Available now: <strong>New Trip</strong> · <strong>Reservations</strong> · <strong>Schedule</strong>
      </p>
    </div>
  );
}

function PaidOnly() {
  return (
    <div className="max-w-2xl bg-card border border-border rounded-sm p-8 text-center">
      <h3 className="text-xl font-extrabold tracking-tight mb-2">Paid membership required</h3>
      <p className="text-muted-foreground mb-4">This feature is available on the $5/year paid plan.</p>
      <Link to="/membership" className="portal-btn-primary px-5 py-2.5">
        Upgrade — $5/year
      </Link>
    </div>
  );
}

/* -------- New Trip Form -------- */
function NewTripForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<any>({
    patient_first_name: "", patient_last_name: "", patient_phone: "",
    patient_date_of_birth: "", medicaid_number: "", medicaid_plan: "",
    authorization_number: "", diagnosis_code: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    pickup_address: "", pickup_address_details: "", pickup_city: "", pickup_zip: "", pickup_date: "", pickup_time: "",
    appointment_time: "",
    dropoff_address: "", dropoff_city: "", dropoff_zip: "",
    transport_type: "ambulatory", round_trip: false,
    return_pickup_time: "", return_dropoff_time: "",
    service_level: "curb_to_curb",
    needs_wheelchair: false, has_passenger: false, needs_assistance_to_vehicle: false,
    needs_surgery_signin: false, needs_surgery_signout: false,
    mobility_notes: "", special_instructions: "", payer: "", trip_number: "",
  });
  const [hipaaOk, setHipaaOk] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      if (!hipaaOk) throw new Error("Please confirm HIPAA acknowledgment.");
      if (form.round_trip && !form.return_pickup_time) {
        throw new Error("Return pickup time is required for round trips.");
      }
      const ack = await recordHipaaAck({ data: { context: "send_trip" } });
      const payload = { ...form };
      // Don't send empty date string (zod regex would reject)
      if (!payload.patient_date_of_birth) delete payload.patient_date_of_birth;
      if (!payload.return_pickup_time) delete payload.return_pickup_time;
      if (!payload.return_dropoff_time) delete payload.return_dropoff_time;
      if (!payload.appointment_time) delete payload.appointment_time;
      return createTrip({ data: { ...payload, hipaa_ack_id: ack.id } });
    },
    onSuccess: () => { toast.success("Trip created"); setHipaaOk(false); onCreated(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to create trip"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="max-w-3xl bg-card border border-border rounded-sm p-6 grid grid-cols-2 gap-4">
      <h2 className="col-span-2 text-xl font-extrabold tracking-tight">New trip</h2>
      <Field label="Patient first name" v={form.patient_first_name} on={(v) => setForm({ ...form, patient_first_name: v })} required />
      <Field label="Patient last name" v={form.patient_last_name} on={(v) => setForm({ ...form, patient_last_name: v })} required />
      <Field label="Patient phone" v={form.patient_phone} on={(v) => setForm({ ...form, patient_phone: v })} />
      <Field label="Patient date of birth" v={form.patient_date_of_birth} on={(v) => setForm({ ...form, patient_date_of_birth: v })} type="date" />
      <Field label="Trip number" v={form.trip_number} on={(v) => setForm({ ...form, trip_number: v })} />
      <fieldset className="col-span-2 grid grid-cols-2 gap-3 border border-border rounded-sm p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Medicaid / CMS billing</legend>
        <Field label="Medicaid #" v={form.medicaid_number} on={(v) => setForm({ ...form, medicaid_number: v })} />
        <Field label="Medicaid plan" v={form.medicaid_plan} on={(v) => setForm({ ...form, medicaid_plan: v })} placeholder="e.g. Sunshine Health, Simply, MMA" />
        <Field label="Authorization #" v={form.authorization_number} on={(v) => setForm({ ...form, authorization_number: v })} />
        <Field label="Diagnosis code" v={form.diagnosis_code} on={(v) => setForm({ ...form, diagnosis_code: v })} placeholder="ICD-10 (optional)" />
        <Field label="Emergency contact name" v={form.emergency_contact_name} on={(v) => setForm({ ...form, emergency_contact_name: v })} />
        <Field label="Emergency contact phone" v={form.emergency_contact_phone} on={(v) => setForm({ ...form, emergency_contact_phone: v })} />
      </fieldset>
      <Field label="Pickup address" v={form.pickup_address} on={(v) => setForm({ ...form, pickup_address: v })} required className="col-span-2" />
      <Field label="Building / Doctor's office / Suite" v={form.pickup_address_details} on={(v) => setForm({ ...form, pickup_address_details: v })} className="col-span-2" placeholder="e.g. Dr. Smith — Suite 210" />
      <Field label="Pickup city" v={form.pickup_city} on={(v) => setForm({ ...form, pickup_city: v })} required />
      <Field label="Pickup ZIP" v={form.pickup_zip} on={(v) => setForm({ ...form, pickup_zip: v })} />
      <Field label="Pickup date" v={form.pickup_date} on={(v) => setForm({ ...form, pickup_date: v })} required type="date" />
      <Field label="Pickup time" v={form.pickup_time} on={(v) => setForm({ ...form, pickup_time: v })} required type="time" />
      <Field label="Appointment time" v={form.appointment_time} on={(v) => setForm({ ...form, appointment_time: v })} type="time" />
      <Field label="Dropoff address" v={form.dropoff_address} on={(v) => setForm({ ...form, dropoff_address: v })} required className="col-span-2" />
      <Field label="Dropoff city" v={form.dropoff_city} on={(v) => setForm({ ...form, dropoff_city: v })} required />
      <Field label="Dropoff ZIP" v={form.dropoff_zip} on={(v) => setForm({ ...form, dropoff_zip: v })} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="portal-label">Transportation type</span>
        <select value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })}
                className="portal-select">
          <option value="ambulatory">Ambulatory</option>
          <option value="wheelchair">Wheelchair</option>
          <option value="stretcher">Stretcher</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="portal-label">Service level</span>
        <select value={form.service_level} onChange={(e) => setForm({ ...form, service_level: e.target.value })}
                className="portal-select">
          <option value="curb_to_curb">Curb to curb</option>
          <option value="door_to_door">Door to door</option>
          <option value="bed_to_bed">Bed to bed</option>
          <option value="driveway_pickup">Pickup in driveway</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-bold mt-2 col-span-2">
        <input type="checkbox" checked={form.round_trip} onChange={(e) => setForm({ ...form, round_trip: e.target.checked })} />
        Round trip (return pickup time required)
      </label>
      {form.round_trip && (
        <>
          <Field label="Return pickup time" v={form.return_pickup_time} on={(v) => setForm({ ...form, return_pickup_time: v })} required type="time" />
          <Field label="Return dropoff time" v={form.return_dropoff_time} on={(v) => setForm({ ...form, return_dropoff_time: v })} type="time" />
        </>
      )}
      <fieldset className="col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2 border border-border rounded-sm p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Patient needs</legend>
        {[
          ["needs_wheelchair", "Needs wheelchair"],
          ["has_passenger", "Has passenger / companion"],
          ["needs_assistance_to_vehicle", "Help into vehicle"],
          ["needs_surgery_signin", "Sign-in for surgery"],
          ["needs_surgery_signout", "Sign-out from surgery"],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
      </fieldset>
      <Field label="Payer" v={form.payer} on={(v) => setForm({ ...form, payer: v })} className="col-span-2" />
      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="portal-label">Mobility notes</span>
        <textarea value={form.mobility_notes} onChange={(e) => setForm({ ...form, mobility_notes: e.target.value })}
                  className="portal-select" rows={2} />
      </label>
      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="portal-label">Special instructions</span>
        <textarea value={form.special_instructions} onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
                  className="portal-select" rows={2} />
      </label>
      <label className="col-span-2 flex items-start gap-2 text-sm bg-muted/40 border border-border rounded-sm p-3">
        <input type="checkbox" checked={hipaaOk} onChange={(e) => setHipaaOk(e.target.checked)} className="mt-0.5" required />
        <span><strong>HIPAA acknowledgment.</strong> I confirm this transmission complies with HIPAA. MyFloridaNemt.com does not access PHI included in trip details — it is visible only to me and the receiving provider.</span>
      </label>
      <button disabled={m.isPending || !hipaaOk} className="portal-btn-primary col-span-2 py-3">
        {m.isPending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}

/* -------- CSV Upload -------- */
const REQUIRED_COLS = [
  "patient_first_name", "patient_last_name",
  "pickup_address", "pickup_city", "pickup_date", "pickup_time",
  "dropoff_address", "dropoff_city",
];

function CsvUpload({ onUploaded }: { onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hipaaOk, setHipaaOk] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeCsvHeader,
      complete: (res) => {
        const rows = res.data;
        if (!rows.length) { toast.error("CSV is empty"); return; }
        const cols = Object.keys(rows[0]);
        const miss = REQUIRED_COLS.filter((c) => !cols.includes(c));
        setMissing(miss);
        setPreview(rows.slice(0, 5));
        (window as any).__csvRows = rows;
      },
    });
  }

  async function upload() {
    const rows = (window as any).__csvRows as any[] | undefined;
    if (!rows) return;
    if (!hipaaOk) { toast.error("Please confirm HIPAA acknowledgment"); return; }
    setBusy(true);
    try {
      const ack = await recordHipaaAck({ data: { context: "bulk_upload" } });
      const res = await createTripsBulk({ data: { trips: rows, hipaa_ack_id: ack.id } });
      toast.success(`Uploaded ${res.count} trips`);
      setPreview(null);
      setHipaaOk(false);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl bg-card border border-border rounded-sm p-6">
      <h2 className="text-xl font-extrabold tracking-tight mb-2">Upload trips from CSV</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Required columns: <span className="font-mono text-xs">{REQUIRED_COLS.join(", ")}</span>.
        Common variants like <span className="font-mono text-xs">first_name, pu_address, date</span> are auto-mapped.
      </p>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPick} className="mb-4 text-sm" />
      {missing.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm rounded-sm mb-3">
          Missing columns: {missing.join(", ")}
        </div>
      )}
      {preview && (
        <>
          <p className="text-xs text-muted-foreground mb-2">Preview (first 5 rows):</p>
          <div className="overflow-auto border border-border rounded-sm mb-4">
            <table className="text-xs w-full">
              <thead className="bg-muted">
                <tr>{Object.keys(preview[0]).map((k) => <th key={k} className="px-2 py-1 text-left">{k}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {Object.keys(preview[0]).map((k) => <td key={k} className="px-2 py-1">{String(r[k] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-start gap-2 text-sm bg-muted/40 border border-border rounded-sm p-3 mb-3">
            <input type="checkbox" checked={hipaaOk} onChange={(e) => setHipaaOk(e.target.checked)} className="mt-0.5" />
            <span><strong>HIPAA acknowledgment.</strong> I confirm this bulk transmission complies with HIPAA. MyFloridaNemt.com does not access PHI included in trip details.</span>
          </label>
          <button
            disabled={busy || missing.length > 0 || !hipaaOk}
            onClick={upload}
            className="portal-btn-primary px-6 py-2"
          >
            {busy ? "Uploading…" : `Upload ${(window as any).__csvRows?.length ?? 0} trips`}
          </button>
        </>
      )}
    </div>
  );
}

/* -------- Trip List + Send/Assign -------- */
function TripList({ trips, userId, role, portal, onChanged }: { trips: Trip[]; userId: string; role: "sender" | "recipient"; portal?: PortalKind; onChanged: () => void }) {
  const [assigning, setAssigning] = useState<Trip | null>(null);
  const [viewing, setViewing] = useState<Trip | null>(null);
  const [rating, setRating] = useState<Trip | null>(null);
  const qc = useQueryClient();
  const showSavedBadge = portal === "facility" && role === "sender";
  const canRate = portal === "facility" && role === "sender";
  const savedQ = useQuery({
    queryKey: ["facility-saved-ids", userId],
    queryFn: async () => {
      const mod = await import("@/lib/facility-providers.functions");
      return mod.listSavedProviderIds();
    },
    enabled: showSavedBadge,
  });
  const savedSet = new Set<string>(savedQ.data ?? []);

  async function saveProviderFromTrip(provider_user_id: string) {
    try {
      const mod = await import("@/lib/facility-providers.functions");
      await mod.saveProvider({ data: { provider_user_id } });
      toast.success("Provider saved");
      qc.invalidateQueries({ queryKey: ["facility-saved-ids"] });
      qc.invalidateQueries({ queryKey: ["facility-saved-providers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  }

  if (viewing) {
    return (
      <TripDetailView
        trip={viewing}
        userId={userId}
        role={role}
        onBack={() => setViewing(null)}
        onChanged={onChanged}
      />
    );
  }

  if (!trips.length) {
    return <div className="bg-card border border-border rounded-sm p-10 text-center text-muted-foreground">No trips yet.</div>;
  }
  return (
    <>
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Pickup → Dropoff</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Payment</th>
              {showSavedBadge && <th className="px-3 py-2 text-left">Provider</th>}
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => {
              const isSaved = !!t.assigned_to && savedSet.has(t.assigned_to);
              return (
              <tr key={t.id} className="border-t border-border align-top hover:bg-muted/40 cursor-pointer" onClick={() => setViewing(t)}>
                <td className="px-3 py-2 whitespace-nowrap">{t.pickup_date}<br /><span className="text-xs text-muted-foreground">{t.pickup_time}</span></td>
                <td className="px-3 py-2">
                  <button onClick={(e) => { e.stopPropagation(); setViewing(t); }} className="font-bold text-primary hover:underline text-left">
                    {t.patient_first_name} {t.patient_last_name}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{t.pickup_city}{t.pickup_zip ? `, ${t.pickup_zip}` : ""}</div>
                  <div className="text-muted-foreground">↓ {t.dropoff_city}{t.dropoff_zip ? `, ${t.dropoff_zip}` : ""}</div>
                </td>
                <td className="px-3 py-2"><TripStatusBadge s={t.status} /></td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <PaymentStatusControl trip={t} canEdit={role === "sender" || role === "recipient"} onChanged={onChanged} />
                </td>
                {showSavedBadge && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {!t.assigned_to ? (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    ) : isSaved ? (
                      <span className="bg-accent/15 text-accent text-[10px] font-bold uppercase px-2 py-1 rounded-sm">Saved provider</span>
                    ) : (
                      <button
                        onClick={() => saveProviderFromTrip(t.assigned_to!)}
                        className="text-[10px] font-bold uppercase bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded-sm"
                        title="New provider — click to save"
                      >
                        New provider · Save
                      </button>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setViewing(t)} className="text-xs font-bold text-primary hover:underline mr-3">View</button>
                  <button onClick={() => downloadTripPdf(t as TripPdfInput)} className="text-xs font-bold text-muted-foreground hover:underline mr-3">PDF</button>
                  {role === "sender" && t.status === "open" && (
                    <button onClick={() => setAssigning(t)} className="text-xs font-bold text-accent hover:underline mr-3">Send</button>
                  )}
                  {canRate && t.assigned_to && (t.status === "completed" || t.status === "accepted") && (
                    <button onClick={() => setRating(t)} className="text-xs font-bold bg-amber-500 text-white px-2.5 py-1 rounded-sm hover:bg-amber-600 mr-2">★ Rate</button>
                  )}
                  {role === "recipient" && ["assigned","open","pending","offered"].includes((t.status ?? "").toLowerCase()) && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            await updateTripStatus({ data: { trip_id: t.id, status: "accepted" } });
                            toast.success("Accepted");
                            onChanged();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Could not accept trip");
                          }
                        }}
                        className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-sm hover:bg-emerald-700 mr-2">✓ Accept</button>
                      <button
                        onClick={async () => {
                          try {
                            await updateTripStatus({ data: { trip_id: t.id, status: "declined" } });
                            toast.success("Declined");
                            onChanged();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Could not decline trip");
                          }
                        }}
                        className="text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-sm hover:bg-red-700">✕ Decline</button>
                    </>
                  )}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {assigning && (
        <AssignDialog trip={assigning} onClose={() => setAssigning(null)} onAssigned={() => { setAssigning(null); onChanged(); }} />
      )}
      {rating && <RateProviderModal trip={rating} onClose={() => setRating(null)} onSaved={() => { setRating(null); onChanged(); }} />}
    </>
  );
}


type EditableFields = {
  patient_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  pickup_address: string;
  pickup_address_details: string;
  pickup_city: string;
  pickup_zip: string;
  pickup_date: string;
  pickup_time: string;
  appointment_time: string;
  return_pickup_time: string;
  return_dropoff_time: string;
  dropoff_address: string;
  dropoff_city: string;
  dropoff_zip: string;
  mobility_notes: string;
  special_instructions: string;
  provider_notes: string;
  cost_total: string;
  payer: string;
};

function toFormValue(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function buildForm(t: any): EditableFields {
  return {
    patient_phone: toFormValue(t.patient_phone),
    emergency_contact_name: toFormValue(t.emergency_contact_name),
    emergency_contact_phone: toFormValue(t.emergency_contact_phone),
    pickup_address: toFormValue(t.pickup_address),
    pickup_address_details: toFormValue(t.pickup_address_details),
    pickup_city: toFormValue(t.pickup_city),
    pickup_zip: toFormValue(t.pickup_zip),
    pickup_date: toFormValue(t.pickup_date),
    pickup_time: toFormValue(t.pickup_time),
    appointment_time: toFormValue(t.appointment_time),
    return_pickup_time: toFormValue(t.return_pickup_time),
    return_dropoff_time: toFormValue(t.return_dropoff_time),
    dropoff_address: toFormValue(t.dropoff_address),
    dropoff_city: toFormValue(t.dropoff_city),
    dropoff_zip: toFormValue(t.dropoff_zip),
    mobility_notes: toFormValue(t.mobility_notes),
    special_instructions: toFormValue(t.special_instructions),
    provider_notes: toFormValue(t.provider_notes),
    cost_total: toFormValue(t.cost_total),
    payer: toFormValue(t.payer),
  };
}

function fmtMoney(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

function TripDetailView({
  trip,
  userId,
  role,
  onBack,
  onChanged,
}: {
  trip: Trip;
  userId: string;
  role: "sender" | "recipient";
  onBack: () => void;
  onChanged: () => void;
}) {
  const t: any = trip;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<null | { onProceed: () => void }>(null);
  const qc = useQueryClient();

  const isSender = t.created_by === userId || role === "sender";
  const isRecipient = t.assigned_to === userId || role === "recipient";
  const canEditAll = isSender;
  const canEditProviderFields = isRecipient || isSender;
  const canEdit = canEditAll || canEditProviderFields;

  const original = useMemo(() => buildForm(t), [t]);
  const [form, setForm] = useState<EditableFields>(original);
  useEffect(() => { setForm(original); }, [original]);

  const dirty = useMemo(
    () => (Object.keys(form) as (keyof EditableFields)[]).some((k) => form[k] !== original[k]),
    [form, original],
  );

  // Warn on browser navigation / tab close while dirty.
  useEffect(() => {
    if (!editing || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, dirty]);

  function setField<K extends keyof EditableFields>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function tryLeave(action: () => void) {
    if (editing && dirty) {
      setConfirmLeave({ onProceed: action });
    } else {
      action();
    }
  }

  async function save(afterSave?: () => void) {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      (Object.keys(form) as (keyof EditableFields)[]).forEach((k) => {
        const orig = original[k];
        if (form[k] === orig) return;
        if (!canEditAll && !(k === "provider_notes" || k === "cost_total")) return;
        if (k === "cost_total") {
          const n = form[k] === "" ? null : Number(form[k]);
          patch[k] = n == null || isNaN(n) ? null : n;
        } else {
          patch[k] = form[k];
        }
      });
      if (Object.keys(patch).length === 0) {
        toast.info("No changes to save");
        setEditing(false);
        afterSave?.();
        return;
      }
      await updateTripDetails({ data: { trip_id: t.id, patch: patch as any } });
      toast.success("Trip updated");
      setEditing(false);
      onChanged();
      qc.invalidateQueries({ queryKey: ["my-trips"] });
      afterSave?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function discardAndProceed(action: () => void) {
    setForm(original);
    setEditing(false);
    setConfirmLeave(null);
    action();
  }

  const paymentsQ = useQuery({
    queryKey: ["trip-payments", t.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select("id, amount_cents, status, environment, created_at, stripe_payment_intent_id")
        .eq("trip_id", t.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const paidCents = (paymentsQ.data ?? [])
    .filter((p) => ["succeeded", "paid", "captured"].includes(String(p.status).toLowerCase()))
    .reduce((a, p) => a + (p.amount_cents ?? 0), 0);
  const refundedCents = (paymentsQ.data ?? [])
    .filter((p) => ["refunded", "partial_refund"].includes(String(p.status).toLowerCase()))
    .reduce((a, p) => a + (p.amount_cents ?? 0), 0);
  const quoteDollars = t.cost_total != null ? Number(t.cost_total) : null;
  const paidDollars = paidCents / 100;
  const outstandingDollars = quoteDollars != null ? Math.max(0, quoteDollars - paidDollars) : null;
  const needsQuote = quoteDollars == null || quoteDollars <= 0;

  let paymentLabel = "No payments yet";
  let paymentTone = "bg-muted text-muted-foreground";
  if (refundedCents > 0) { paymentLabel = "Refunded"; paymentTone = "bg-slate-200 text-slate-700"; }
  else if (quoteDollars != null && paidDollars >= quoteDollars && quoteDollars > 0) { paymentLabel = "Paid"; paymentTone = "bg-emerald-100 text-emerald-700"; }
  else if (paidDollars > 0) { paymentLabel = "Partially paid"; paymentTone = "bg-amber-100 text-amber-700"; }
  else if (!needsQuote) { paymentLabel = "Pending"; paymentTone = "bg-amber-100 text-amber-700"; }

  const isRound = !!t.round_trip;
  const flags: string[] = [];
  if (isRound) flags.push("Round trip");
  if (t.needs_wheelchair) flags.push("Wheelchair");
  if (t.has_passenger) flags.push("Companion");
  if (t.needs_assistance_to_vehicle) flags.push("Help to vehicle");
  if (t.needs_surgery_signin) flags.push("Surgery sign-in");
  if (t.needs_surgery_signout) flags.push("Surgery sign-out");

  // Build derived timeline from available columns.
  const status = String(t.status ?? "").toLowerCase();
  type TimelineStep = { key: string; label: string; at?: string | null; state: "done" | "current" | "pending"; note?: string };
  const steps: TimelineStep[] = [];
  steps.push({ key: "requested", label: "Requested", at: t.created_at, state: "done" });
  steps.push({
    key: "confirmed",
    label: "Confirmed",
    at: t.hipaa_ack_id ? t.created_at : null,
    state: t.hipaa_ack_id ? "done" : "pending",
  });
  steps.push({
    key: "assigned",
    label: "Assigned",
    at: t.assigned_to ? t.route_computed_at ?? t.created_at : null,
    state: t.assigned_to ? "done" : status === "canceled" ? "pending" : "pending",
    note: t.assigned_to ? "Provider assigned" : "Awaiting assignment",
  });
  steps.push({
    key: "en_route",
    label: "Driver en route",
    at: t.estimated_pickup_at ?? null,
    state: t.actual_pickup_at || status === "completed" ? "done" : status === "accepted" ? "current" : "pending",
  });
  steps.push({
    key: "pickup",
    label: "Pickup",
    at: t.actual_pickup_at ?? t.estimated_pickup_at ?? null,
    state: t.actual_pickup_at ? "done" : "pending",
  });
  steps.push({
    key: "dropoff",
    label: "Drop-off",
    at: t.actual_dropoff_at ?? t.estimated_dropoff_at ?? null,
    state: t.actual_dropoff_at ? "done" : "pending",
  });
  if (status === "canceled" || status === "declined") {
    steps.push({ key: "canceled", label: "Canceled", at: null, state: "current", note: t.cancel_reason ?? undefined });
  } else {
    steps.push({
      key: "completed",
      label: "Completed",
      at: status === "completed" ? t.actual_dropoff_at ?? null : null,
      state: status === "completed" ? "done" : "pending",
    });
  }

  const H = ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-3">{children}</h4>
  );

  const Row = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
    <div className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );

  const readOnly = (v: unknown) => <div>{v == null || v === "" ? <span className="text-muted-foreground">—</span> : String(v)}</div>;

  const input = (k: keyof EditableFields, allowed: boolean, opts?: { type?: string; placeholder?: string }) =>
    editing && allowed ? (
      <input
        type={opts?.type ?? "text"}
        value={form[k]}
        placeholder={opts?.placeholder}
        onChange={(e) => setField(k, e.target.value)}
        className="w-full border border-border rounded-sm px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    ) : (
      readOnly((t as any)[k])
    );

  const textarea = (k: keyof EditableFields, allowed: boolean) =>
    editing && allowed ? (
      <textarea
        value={form[k]}
        onChange={(e) => setField(k, e.target.value)}
        rows={3}
        className="w-full border border-border rounded-sm px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    ) : (
      readOnly((t as any)[k])
    );

  return (
    <div className="bg-background">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border">
        <div className="space-y-1.5 min-w-0">
          <button
            onClick={() => tryLeave(onBack)}
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            ← Back to trips
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <TripStatusBadge s={t.status} />
            <span className={`text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm ${paymentTone}`}>
              {paymentLabel}
            </span>
            {t.display_id && (
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t.display_id}
              </span>
            )}
            {t.payer && String(t.payer).toLowerCase().includes("medicaid") && (
              <span className="text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-orange-100 text-orange-700 border border-orange-200">
                Medicaid
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            {t.patient_first_name} {t.patient_last_name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t.pickup_date}
            {t.pickup_time ? ` · Pickup ${t.pickup_time}` : ""}
            {t.appointment_time ? ` · Appt ${t.appointment_time}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadTripPdf(trip as TripPdfInput)}
            className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted"
          >
            Download PDF
          </button>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-sm hover:bg-primary/90"
            >
              Edit trip
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={() => tryLeave(() => { setForm(original); setEditing(false); })}
                disabled={saving}
                className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => save()}
                disabled={saving || !dirty}
                className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </header>

      {editing && !canEditAll && canEditProviderFields && (
        <div className="mb-4 bg-sky-50 border border-sky-200 rounded-sm px-4 py-2 text-xs text-sky-800">
          As the assigned provider, you can edit your <b>quote</b> and <b>provider notes</b>. Other changes must be made by the sender or an admin.
        </div>
      )}

      {editing && dirty && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-sm px-4 py-2 text-xs text-amber-800">
          You have unsaved changes.
        </div>
      )}

      {/* Two-column responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <H>Trip information</H>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Row label="Trip #">{readOnly(t.trip_number ?? t.display_id)}</Row>
              <Row label="Source">{readOnly(t.source)}</Row>
              <Row label="Transportation type">{readOnly(t.transport_type)}</Row>
              <Row label="Service level">{readOnly(t.service_level ? String(t.service_level).replace(/_/g, " ") : null)}</Row>
              <Row label="Trip type">{readOnly(isRound ? "Round trip" : "One-way")}</Row>
              <Row label="Authorization #">{readOnly(t.authorization_number)}</Row>
              <Row label="Patient needs" full>
                {flags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {flags.map((f) => (
                      <span key={f} className="text-[0.7rem] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30">
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No special needs indicated.</span>
                )}
              </Row>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Passenger information</H>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Row label="Name">{readOnly(`${t.patient_first_name ?? ""} ${t.patient_last_name ?? ""}`.trim())}</Row>
              <Row label="Phone">{input("patient_phone", canEditAll, { type: "tel" })}</Row>
              <Row label="Date of birth">{readOnly(t.patient_date_of_birth)}</Row>
              <Row label="Medicaid #">{readOnly(t.medicaid_number)}</Row>
              <Row label="Medicaid plan">{readOnly(t.medicaid_plan)}</Row>
              <Row label="Emergency contact">{input("emergency_contact_name", canEditAll)}</Row>
              <Row label="Emergency phone">{input("emergency_contact_phone", canEditAll, { type: "tel" })}</Row>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Locations</H>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-3">
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary">Pickup</div>
                <Row label="Address">{input("pickup_address", canEditAll)}</Row>
                <Row label="Suite / details">{input("pickup_address_details", canEditAll)}</Row>
                <div className="grid grid-cols-2 gap-4">
                  <Row label="City">{input("pickup_city", canEditAll)}</Row>
                  <Row label="ZIP">{input("pickup_zip", canEditAll)}</Row>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Row label="Date">{input("pickup_date", canEditAll, { type: "date" })}</Row>
                  <Row label="Time">{input("pickup_time", canEditAll, { type: "time" })}</Row>
                </div>
                <Row label="Appointment time">{input("appointment_time", canEditAll, { type: "time" })}</Row>
              </div>
              <div className="space-y-3">
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary">Drop-off</div>
                <Row label="Address">{input("dropoff_address", canEditAll)}</Row>
                <div className="grid grid-cols-2 gap-4">
                  <Row label="City">{input("dropoff_city", canEditAll)}</Row>
                  <Row label="ZIP">{input("dropoff_zip", canEditAll)}</Row>
                </div>
                <Row label="Distance">{readOnly(t.estimated_miles ? `${t.estimated_miles} mi` : t.actual_miles ? `${t.actual_miles} mi` : null)}</Row>
                {isRound && (
                  <div className="grid grid-cols-2 gap-4">
                    <Row label="Return pickup">{input("return_pickup_time", canEditAll, { type: "time" })}</Row>
                    <Row label="Return dropoff">{input("return_dropoff_time", canEditAll, { type: "time" })}</Row>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Notes & instructions</H>
            <div className="space-y-4">
              <Row label="Special instructions" full>{textarea("special_instructions", canEditAll)}</Row>
              <Row label="Mobility notes" full>{textarea("mobility_notes", canEditAll)}</Row>
              <Row label="Provider notes" full>{textarea("provider_notes", canEditProviderFields)}</Row>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Trip status timeline</H>
            <ol className="relative border-l-2 border-border ml-2 space-y-4">
              {steps.map((s) => {
                const dot =
                  s.state === "done"
                    ? "bg-emerald-500 border-emerald-500"
                    : s.state === "current"
                    ? "bg-amber-500 border-amber-500"
                    : "bg-background border-border";
                return (
                  <li key={s.key} className="pl-6 relative">
                    <span className={`absolute -left-[9px] top-1 inline-block w-4 h-4 rounded-full border-2 ${dot}`} />
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="text-sm font-semibold text-foreground">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{fmtDateTime(s.at ?? null)}</div>
                    </div>
                    {s.note && <div className="text-xs text-muted-foreground mt-0.5">{s.note}</div>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[0.7rem] text-muted-foreground">
              Timeline is derived from trip events. Individual user attribution is available in the audit log.
            </p>
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-8">
          <section>
            <H>Driver & assignment</H>
            <div className="space-y-3 text-sm">
              <Row label="Assigned to">{readOnly(t.assigned_to ? "Provider assigned" : "Unassigned")}</Row>
              <Row label="Region">{readOnly(t.region)}</Row>
              <Row label="Dispatch zone">{readOnly(t.dispatch_zone_id ? "Zone set" : null)}</Row>
              <Row label="Driver">{readOnly(t.driver_id ? "Driver assigned" : null)}</Row>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Pricing &amp; billing</H>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment status</span>
                <span className={`text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm ${paymentTone}`}>{paymentLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Responsible party</span>
                {editing && canEditAll ? (
                  <select
                    value={form.payer}
                    onChange={(e) => setField("payer", e.target.value)}
                    className="border border-border rounded-sm px-2 py-1 text-sm bg-background"
                  >
                    <option value="">—</option>
                    <option value="Patient">Patient</option>
                    <option value="Facility">Facility</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Medicaid">Medicaid</option>
                    <option value="Broker">Broker</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <span className="font-semibold">{t.payer ?? "—"}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated price</span>
                <span className="font-semibold">{fmtMoney(t.estimated_miles && t.cost_total == null ? null : t.cost_total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Provider quote</span>
                {editing && canEditProviderFields ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_total}
                    onChange={(e) => setField("cost_total", e.target.value)}
                    placeholder="0.00"
                    className="w-28 border border-border rounded-sm px-2 py-1 text-sm bg-background text-right"
                  />
                ) : (
                  <span className="font-semibold">{fmtMoney(quoteDollars)}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-semibold">{fmtMoney(paidDollars)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding balance</span>
                <span className="font-semibold">{outstandingDollars == null ? "—" : fmtMoney(outstandingDollars)}</span>
              </div>
              {refundedCents > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Refunded</span>
                  <span className="font-semibold">{fmtMoney(refundedCents / 100)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-semibold">{(paymentsQ.data ?? []).length ? "Card (Stripe)" : "—"}</span>
              </div>

              {needsQuote && (
                <div className="mt-2 rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  {canEditProviderFields
                    ? "Quote required — enter your quote above and save."
                    : "Awaiting manual quote from provider."}
                </div>
              )}
              {canEditProviderFields && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="w-full mt-2 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-sm hover:bg-primary/90"
                >
                  {needsQuote ? "Create quote" : "Update quote"}
                </button>
              )}

              {t.cost_breakdown?.lines?.length ? (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Line items</div>
                  {t.cost_breakdown.lines.map((l: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{l.label}</span>
                      <span>{fmtMoney(l.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {confirmLeave && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-sm max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-extrabold">Unsaved changes</h3>
            <p className="text-sm text-muted-foreground">
              You have unsaved edits to this trip. What would you like to do?
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmLeave(null)}
                className="text-sm font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => discardAndProceed(confirmLeave.onProceed)}
                className="text-sm font-bold border border-red-300 text-red-700 px-3 py-2 rounded-sm hover:bg-red-50"
              >
                Discard changes
              </button>
              <button
                disabled={saving}
                onClick={() => {
                  const proceed = confirmLeave.onProceed;
                  save(() => { setConfirmLeave(null); proceed(); });
                }}
                className="text-sm font-bold bg-emerald-600 text-white px-4 py-2 rounded-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




function RateProviderModal({ trip, onClose, onSaved }: { trip: Trip; onClose: () => void; onSaved: () => void }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const providerId = (trip as any).assigned_to as string | null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerId) return;
    setBusy(true);
    try {
      // Upsert by (rater_user_id, trip_id) — editable later
      const { data: existing } = await supabase
        .from("provider_ratings")
        .select("id")
        .eq("trip_id", trip.id)
        .maybeSingle();
      const payload: any = {
        provider_id: providerId,
        trip_id: trip.id,
        stars,
        feedback: comment || null,
      };
      const q = existing
        ? supabase.from("provider_ratings").update(payload).eq("id", existing.id)
        : supabase.from("provider_ratings").insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success("Thanks for the feedback");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save rating");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-card rounded-sm max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-extrabold">Rate this provider</h3>
        <p className="text-xs text-muted-foreground">You can edit this rating any time from trip history.</p>
        <div className="flex gap-1 text-2xl">
          {[1,2,3,4,5].map((n) => (
            <button type="button" key={n} onClick={() => setStars(n)}
                    className={n <= stars ? "text-amber-500" : "text-muted-foreground/40"}>★</button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
                  placeholder="Feedback (on-time, courteous, vehicle clean…)"
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-background" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground px-3 py-2">Cancel</button>
          <button disabled={busy} className="portal-btn-primary px-5 py-2">
            {busy ? "Saving…" : "Save rating"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TripStatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    open: "bg-muted text-foreground",
    assigned: "bg-blue-100 text-blue-800",
    accepted: "bg-accent/15 text-accent",
    declined: "bg-red-100 text-red-700",
    completed: "bg-emerald-100 text-emerald-700",
    canceled: "bg-muted text-muted-foreground line-through",
  };
  return <span className={`text-xs font-bold uppercase px-2 py-1 rounded-sm ${map[s] ?? "bg-muted"}`}>{s}</span>;
}

function AssignDialog({ trip, onClose, onAssigned }: { trip: Trip; onClose: () => void; onAssigned: () => void }) {
  const providersQ = useQuery({
    queryKey: ["regional-providers"],
    queryFn: () => listRegionalProviders(),
  });
  const [busy, setBusy] = useState(false);

  async function pick(providerEmail: string, providerName: string) {
    // Find auth user for this provider email
    setBusy(true);
    try {
      // We have provider applications but the recipient must be a member. Try matching by email.
      const { data: prof } = await supabase
        .from("member_profiles")
        .select("user_id, dispatch_email, first_name, last_name")
        .or(`dispatch_email.eq.${providerEmail}`)
        .maybeSingle();
      if (!prof) {
        toast.error(`${providerName} hasn't signed up as a member yet — they need to join to receive trips in-app.`);
        setBusy(false);
        return;
      }
      await assignTrip({ data: { trip_id: trip.id, assigned_to: prof.user_id } });
      toast.success(`Sent to ${providerName}`);
      onAssigned();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card rounded-sm max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-extrabold mb-1">Send trip to a regional provider</h3>
        <p className="text-sm text-muted-foreground mb-4">Approved providers in your region. They'll see the trip in their dashboard and can accept or decline.</p>
        {providersQ.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {providersQ.data?.length === 0 && <p className="text-muted-foreground">No approved providers in your region yet.</p>}
        <ul className="divide-y divide-border">
          {(providersQ.data ?? []).map((p: any) => (
            <li key={p.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-bold">{p.company_name}</div>
                <div className="text-xs text-muted-foreground">{p.contact_name} · {p.city} · {p.dispatch_email || p.email}</div>
              </div>
              <button disabled={busy} onClick={() => pick(p.dispatch_email || p.email, p.company_name)}
                      className="text-sm font-bold text-primary hover:underline disabled:opacity-50">
                Send →
              </button>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-4 text-sm text-muted-foreground hover:text-foreground">Close</button>
      </div>
    </div>
  );
}

/* -------- Account (tabbed) -------- */
type AccountTab = "profile" | "business" | "pricing" | "rules" | "integrations" | "payouts" | "membership" | "security";

function AccountPanel({ profile, portal, userId }: { profile: Profile; portal: PortalKind; userId: string }) {
  const [busy, setBusy] = useState(false);
  const [subTab, setSubTab] = useState<AccountTab>("profile");
  async function openPortal() {
    setBusy(true);
    try {
      const res = await createPortalSession({
        data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/dashboard` },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Could not open billing portal");
    } finally { setBusy(false); }
  }

  const isProvider = portal === "provider";
  const isFacility = portal === "facility";
  // Providers get a single consolidated "Business Information" tab that
  // includes profile fields + credentials + compliance + documents.
  // Facilities keep a separate Business Information tab. Patients see Profile only.
  const tabs: Array<[AccountTab, string]> = [
    ["profile", isProvider ? "Business Information" : "Profile"],
    ...(isFacility ? ([["business", "Business Information"]] as Array<[AccountTab, string]>) : []),
    ...(isProvider ? ([
      ["pricing", "Pricing"],
      ["rules", "Rules"],
      ["integrations", "Integrations"],
      ["payouts", "Payouts"],
    ] as Array<[AccountTab, string]>) : []),
    ["membership", "Membership"],
    ["security", "Security"],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Account</h2>
        <p className="text-sm text-muted-foreground">Manage your profile, business details, membership, and security.</p>
      </div>

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none border-b border-border">
        <div className="flex flex-nowrap gap-1 min-w-max">
          {tabs.map(([key, label]) => {
            const active = subTab === key;
            return (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-accent text-accent bg-accent/10 sm:bg-transparent"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5 sm:hover:bg-transparent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {subTab === "profile" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-sm p-6 space-y-3">
              <h3 className="text-lg font-extrabold tracking-tight">Profile</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name</span><div className="font-bold">{profile.first_name} {profile.last_name}</div></div>
                <div><span className="text-muted-foreground">Company</span><div className="font-bold">{profile.company_name}</div></div>
                <div><span className="text-muted-foreground">City</span><div className="font-bold">{profile.city}</div></div>
                <div><span className="text-muted-foreground">Region</span><div className="font-bold">{profile.region ?? "—"}</div></div>
                <div><span className="text-muted-foreground">Phone</span><div className="font-bold">{profile.phone}</div></div>
                <div><span className="text-muted-foreground">Dispatch email</span><div className="font-bold">{profile.dispatch_email}</div></div>
              </div>
            </div>
            {portal === "patient" && (
              <PatientRelationshipCard profile={profile} userId={userId} />
            )}
            {portal === "provider" && (
              <>
                <WeeklyWorkHoursCard />
                <ProviderCredentialsPanel />
                <div className="bg-card border border-border rounded-sm p-6">
                  <NetworkPanel userId={userId} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {subTab === "business" && showBusiness && (
        <BusinessInfoPanel />
      )}

      {subTab === "pricing" && isProvider && <PricingPanel />}
      {subTab === "rules" && isProvider && <RulesPanel />}
      {subTab === "integrations" && isProvider && <IntegrationsPanel />}
      {subTab === "payouts" && isProvider && <PayoutsPanel userId={userId} />}

      {subTab === "membership" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2">
            <MembershipsTab profile={profile} />
          </div>
        </div>
      )}

      {subTab === "security" && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-4 max-w-2xl">
          <h3 className="text-lg font-extrabold tracking-tight">Security & Billing</h3>
          <p className="text-sm text-muted-foreground">
            Manage your billing details, payment methods, and subscription in the secure billing portal.
          </p>
          <button onClick={openPortal} disabled={busy} className="portal-btn-primary px-5 py-2">
            {busy ? "Opening…" : "Manage billing"}
          </button>
        </div>
      )}
    </div>
  );
}


function PatientRelationshipCard({ profile, userId }: { profile: Profile; userId: string }) {
  const p = profile as any;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patient_type: p.patient_type ?? "",
    patient_type_other: p.patient_type_other ?? "",
    patient_relationship: p.patient_relationship ?? "",
    patient_relationship_other: p.patient_relationship_other ?? "",
  });

  async function save() {
    if (!form.patient_type) return toast.error("Select who is managing the account");
    if (form.patient_type === "Other" && !form.patient_type_other.trim()) return toast.error("Specify the patient type");
    if (!form.patient_relationship) return toast.error("Select the relationship to the patient");
    if (form.patient_relationship === "Other" && !form.patient_relationship_other.trim()) return toast.error("Specify the relationship");
    setBusy(true);
    try {
      const { error } = await supabase.from("member_profiles").update({
        patient_type: form.patient_type,
        patient_type_other: form.patient_type === "Other" ? form.patient_type_other.trim() : null,
        patient_relationship: form.patient_relationship,
        patient_relationship_other:
          form.patient_relationship === "Other" ? form.patient_relationship_other.trim() : null,
      }).eq("user_id", userId);
      if (error) throw error;
      toast.success("Saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["member-profile"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">Who is managing this account</h3>
          <p className="text-xs text-muted-foreground">
            Shared with dispatchers and providers so they know who to contact about the patient's trips.
          </p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-sm font-bold text-accent hover:underline">Edit</button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Patient type</span>
            <div className="font-bold">{formatPatientType(p.patient_type, p.patient_type_other)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Relationship</span>
            <div className="font-bold">{formatPatientRelationship(p.patient_relationship, p.patient_relationship_other)}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Who is managing this account?"
            v={form.patient_type}
            on={(v) => setForm({ ...form, patient_type: v })}
            options={PATIENT_TYPE_OPTIONS as readonly string[]}
            required
          />
          {form.patient_type === "Other" && (
            <Field label="Specify patient type" v={form.patient_type_other} on={(v) => setForm({ ...form, patient_type_other: v })} required />
          )}
          <SelectField
            label="Relationship to patient"
            v={form.patient_relationship}
            on={(v) => setForm({ ...form, patient_relationship: v })}
            options={PATIENT_RELATIONSHIP_OPTIONS as readonly string[]}
            required
          />
          {form.patient_relationship === "Other" && (
            <Field label="Specify relationship" v={form.patient_relationship_other} on={(v) => setForm({ ...form, patient_relationship_other: v })} required />
          )}
          <div className="col-span-2 flex gap-2">
            <button onClick={save} disabled={busy} className="portal-btn-primary px-4 py-2">
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function WeeklyWorkHoursCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyWorkHours);
  const saveFn = useServerFn(saveMyWorkHours);
  const q = useQuery({ queryKey: ["work-hours"], queryFn: () => getFn() });
  const [draft, setDraft] = useState<any>(null);
  useEffect(() => { if (q.data?.weekly && !draft) setDraft(q.data.weekly); }, [q.data, draft]);

  const m = useMutation({
    mutationFn: (weekly: any) => saveFn({ data: { weekly } }),
    onSuccess: () => { toast.success("Work hours saved"); qc.invalidateQueries({ queryKey: ["work-hours"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  if (!draft) {
    return <div className="bg-card border border-border rounded-sm p-6 text-sm text-muted-foreground">Loading work hours…</div>;
  }

  const DAYS: Array<[string, string]> = [
    ["0", "Sunday"], ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"],
    ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"],
  ];

  function update(key: string, patch: any) {
    setDraft((d: any) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">Weekly work hours</h3>
        <p className="text-xs text-muted-foreground">
          Set start and end times for each day of the week. Toggle <span className="font-bold">Closed</span> for holidays or off days —
          the schedule board hides that day. Keep it simple; you can adjust any time.
        </p>
      </div>
      <div className="space-y-2">
        {DAYS.map(([k, label]) => {
          const d = draft[k] ?? { start: "06:00", end: "20:00", closed: false };
          return (
            <div key={k} className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-3 py-1 border-b border-border/60 last:border-0">
              <div className="text-sm font-bold">{label}</div>
              <label className="text-xs">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Start</div>
                <input
                  type="time"
                  value={d.start}
                  disabled={d.closed}
                  onChange={(e) => update(k, { start: e.target.value })}
                  className="bg-background border border-border rounded-sm px-2 py-1 text-sm disabled:opacity-50"
                />
              </label>
              <label className="text-xs">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">End</div>
                <input
                  type="time"
                  value={d.end}
                  disabled={d.closed}
                  onChange={(e) => update(k, { end: e.target.value })}
                  className="bg-background border border-border rounded-sm px-2 py-1 text-sm disabled:opacity-50"
                />
              </label>
              <label className="text-xs flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => update(k, { closed: e.target.checked })}
                />
                <span className="font-bold uppercase tracking-wider text-[10px]">Closed</span>
              </label>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => m.mutate(draft)}
          disabled={m.isPending}
          className="portal-btn-primary px-5 py-2"
        >
          {m.isPending ? "Saving…" : "Save weekly hours"}
        </button>
        <button
          onClick={() => setDraft(q.data?.weekly ?? null)}
          className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  );
}



// ───────────────────────── Sidebar ─────────────────────────



function PortalSidebar(props: {
  portal: PortalKind;
  profile: Profile | null;
  userEmail: string | null;
  allowedTabs: Tab[];
  currentTab: Tab;
  onTab: (t: Tab) => void;
  counts: { received: number; sent: number; unread?: number };
  unread?: Partial<Record<TabKey, number>>;
  tabKeyFor?: (t: Tab) => TabKey | null;
  membershipStatus: string;
  onSavedName: () => void;
}) {
  const { portal, profile, userEmail, allowedTabs, currentTab, onTab, counts, unread, tabKeyFor, membershipStatus, onSavedName } = props;


  const displayName =
    portal === "patient"
      ? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Patient"
      : profile?.company_name || (portal === "facility" ? "Facility" : "Provider");

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNameDraft(displayName); }, [displayName]);

  async function saveName() {
    if (!profile || !nameDraft.trim()) return;
    setSaving(true);
    try {
      const updates: any = portal === "patient"
        ? (() => {
            const [first, ...rest] = nameDraft.trim().split(/\s+/);
            return { first_name: first ?? "", last_name: rest.join(" ") };
          })()
        : { company_name: nameDraft.trim() };
      const { error } = await supabase.from("member_profiles").update(updates).eq("user_id", profile.user_id);
      if (error) throw error;
      toast.success("Name updated");
      setEditing(false);
      onSavedName();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  return (
    <aside className="w-64 shrink-0 bg-[oklch(0.20_0.05_257)] text-white min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2 mb-5">
          <span className="size-7 bg-[oklch(0.872_0.078_65.2)] grid place-items-center font-display font-bold text-[oklch(0.18_0.05_257)] text-sm">F</span>
          <span className="font-display font-bold text-base tracking-tight uppercase">MyFloridaNemt.com</span>
        </Link>
        {editing ? (
          <div className="space-y-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full text-sm font-bold border border-white/20 bg-white/10 text-white px-2 py-1.5"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={saveName} disabled={saving}
                      className="text-xs font-bold uppercase tracking-wider bg-[oklch(0.872_0.078_65.2)] text-[oklch(0.18_0.05_257)] px-3 py-1.5 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setNameDraft(displayName); }}
                      className="text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white px-2 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group text-left w-full"
            title="Click to edit name"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.10_195)] mb-1">
              {portal} portal
            </div>
            <div className="font-display text-lg font-bold tracking-tight truncate group-hover:text-[oklch(0.92_0.07_65)] transition-colors">
              {displayName}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 opacity-0 group-hover:opacity-100 mt-0.5">Click to edit</div>
          </button>
        )}
        {portal === "provider" && (
          <div className="mt-3">
            <StatusBadge status={membershipStatus} />
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {allowedTabs.map((key) => {
          const active = currentTab === key;
          return (
            <button
              key={key}
              onClick={() => onTab(key)}
              aria-current={active ? "page" : undefined}
              className={`relative w-full text-left pl-4 pr-3 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                active
                  ? "bg-white text-[oklch(0.20_0.05_257)] shadow-sm"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[oklch(0.872_0.078_65.2)]" />}
              <span className="inline-flex items-center gap-2">
                {tabLabel(key, portal, counts)}
                {key === "messages" && (counts.unread ?? 0) > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {counts.unread}
                  </span>
                )}
                {(() => {
                  const tk = tabKeyFor ? tabKeyFor(key) : null;
                  const n = tk ? (unread?.[tk] ?? 0) : 0;
                  return n > 0 ? (
                    <span
                      aria-label={`${n} new`}
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white animate-pulse"
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                  ) : null;
                })()}
              </span>

            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-xs space-y-2">
        <div className="text-white/50 truncate font-mono text-[11px]" title={userEmail ?? ""}>{userEmail}</div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="font-bold uppercase tracking-wider text-white/70 hover:text-white text-[11px]"
        >Sign out</button>
        <ChangelogChip onClick={() => onTab("changelog")} />
      </div>
    </aside>
  );
}


// ───────────────────────── Memberships tab ─────────────────────────

function MembershipsTab({ profile }: { profile: Profile }) {
  const status = profile.membership_status ?? "inactive";
  const tier = (profile as any).membership_tier ?? "none";
  const isPaid = status === "active" && tier === "paid";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-card border border-border rounded-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold tracking-tight">Your membership</h2>
          <StatusBadge status={status} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Tier</div>
            <div className="font-bold capitalize">{tier}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-bold capitalize">{status}</div>
          </div>
        </div>
        <div className="pt-5 mt-5 border-t border-border">
          {isPaid ? (
            <p className="text-sm text-muted-foreground">
              You have full access. Manage billing from the Account tab.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Upgrade to a paid membership for $5/year to send trips, bulk upload, and use API integrations.
              </p>
              <Link
                to="/membership"
                className="text-sm font-bold text-white bg-accent px-4 py-2 rounded-sm hover:bg-accent/90 shadow-sm"
              >
                Upgrade — $5/year
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

