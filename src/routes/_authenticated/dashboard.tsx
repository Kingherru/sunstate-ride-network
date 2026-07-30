import { createFileRoute, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cancelMyMembership } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { createTrip, createTripsBulk, listRegionalProviders, assignTrip, updateTripStatus, updateTripDetails, recordHipaaAck } from "@/lib/trips.functions";
import { ensureMyDisplayId } from "@/lib/system-ids.functions";
import { downloadTripPdf, normalizeCsvHeader, type TripPdfInput } from "@/lib/trip-pdf";
import type { Database } from "@/integrations/supabase/types";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";
import { PricingPanel } from "@/components/dashboard/PricingPanel";
import { SavedPatientsPanel } from "@/components/dashboard/SavedPatientsPanel";
import { PatientProviderContactsPanel } from "@/components/dashboard/PatientProviderContactsPanel";

import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { ProviderBalancePanel } from "@/components/dashboard/ProviderBalancePanel";
import { ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { TripHistoryPanel } from "@/components/dashboard/TripHistoryPanel";
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
import { useUnreadCounts, useMarkTabViewed, severityFor } from "@/hooks/useUnreadCounts";
import { TAB_KEYS, type TabKey } from "@/lib/unread.functions";

import { PaymentStatusControl } from "@/components/dashboard/PaymentStatusControl";
import { MedicaidSubmissionCenter } from "@/components/dashboard/MedicaidSubmissionCenter";
import { TrainingPanel } from "@/components/dashboard/TrainingPanel";
import { SavedCards } from "@/components/payments/SavedCards";
import { PayersPanel } from "@/components/dashboard/PayersPanel";
import { ProviderReviewsPanel } from "@/components/dashboard/ProviderReviewsPanel";
import { SendFeedbackPanel } from "@/components/dashboard/SendFeedbackPanel";
import { listMyPayers } from "@/lib/payers.functions";
import { AddressAutocomplete, type AddressSelection } from "@/components/forms/AddressAutocomplete";
import { PriceEstimate } from "@/components/pricing/PriceEstimate";
import { TripLegsPreview, type LegInput } from "@/components/trips/TripLegsPreview";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { TimePickerField, TimeSelect } from "@/components/ui/time-picker-field";
import { TripFinancialBreakdown } from "@/components/pricing/TripFinancialBreakdown";
import { ReferralReviewModal } from "@/components/dashboard/ReferralReviewModal";

import { ChangelogChip } from "@/components/ChangelogChip";


import {
  PATIENT_TYPE_OPTIONS,
  PATIENT_RELATIONSHIP_OPTIONS,
  formatPatientType,
  formatPatientRelationship,
} from "@/lib/patient-relationships";
import { computeProviderOnboarding, SOFT_ACCESS_TABS } from "@/lib/provider-onboarding";
import { ProviderOnboardingChecklist } from "@/components/onboarding/ProviderOnboardingChecklist";
import { Lock, Bell as BellIcon } from "lucide-react";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { listMyNotifications } from "@/lib/notifications.functions";

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

function PayersTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Payers</h2>
        <p className="text-sm text-muted-foreground">
          Third parties who pay for trips. Each saved card is scoped to a single payer and can only be charged when that payer is assigned to a trip.
        </p>
      </div>
      <PayersPanel />
    </div>
  );
}

/**
 * Merged Contacts + Payers tab. Contacts is the first sub-tab, Payers the
 * second. Payers only appears for portals that already had payers access
 * (provider, facility) — patients don't manage payers and see Contacts only.
 */
function ContactsAndPayersPanel({ portal, initialSubTab = "contacts" }: { portal: PortalKind; initialSubTab?: "contacts" | "payers" }) {
  const showPayers = portal === "provider" || portal === "facility";
  type Sub = "contacts" | "payers";
  const [subTab, setSubTab] = useState<Sub>(initialSubTab === "payers" && showPayers ? "payers" : "contacts");
  const subs: Array<[Sub, string]> = [
    ["contacts", "Contacts"],
    ...(showPayers ? ([["payers", "Payers"]] as Array<[Sub, string]>) : []),
  ];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">{showPayers ? "Contacts & Payers" : "Contacts"}</h2>
        <p className="text-sm text-muted-foreground">
          {showPayers ? "Manage saved contacts and the third parties who pay for trips." : "Manage your saved contacts."}
        </p>
      </div>
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none border-b border-border">
        <div className="flex flex-nowrap gap-1 min-w-max">
          {subs.map(([key, label]) => {
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
      {subTab === "contacts" && (
        portal === "patient" ? <PatientProviderContactsPanel /> : <SavedPatientsPanel />
      )}
      {subTab === "payers" && showPayers && <PayersPanel />}
    </div>
  );
}




export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — My Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardRouter,
});

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["member_profiles"]["Row"];

export type PortalKind = "patient" | "provider" | "facility";
type Tab = "received" | "sent" | "new" | "upload" | "requests" | "reservations" | "trips" | "network" | "rules" | "contacts" | "providers" | "saved_providers" | "saved_patients" | "vehicles" | "drivers" | "driver_earnings" | "pricing" | "memberships" | "payouts" | "integrations" | "payments" | "payers" | "reviews" | "feedback" | "business_info" | "schedule" | "medicaid" | "training" | "messages" | "notifications" | "changelog" | "account" | "onboarding";
type TripsSubtab = "new" | "reservations" | "history";

const PORTAL_TABS: Record<PortalKind, Tab[]> = {
  patient:  ["new", "sent", "saved_patients", "feedback", "messages", "notifications", "payments", "account"],
  provider: ["onboarding", "trips", "schedule", "received", "vehicles", "saved_patients", "reviews", "medicaid", "training", "messages", "notifications", "account"],
  facility: ["new", "sent", "upload", "providers", "saved_providers", "saved_patients", "feedback", "messages", "notifications", "payments", "account"],
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
  if (t === "trips") return "Trips";
  if (t === "network") return "Provider Network";
  if (t === "rules") return "Rules";
  if (t === "contacts") return portal === "facility" ? "Patients" : portal === "provider" ? "Saved Contacts" : "Contacts";
  if (t === "providers") return "Find Providers";
  if (t === "saved_providers") return "Saved Providers";
  if (t === "vehicles") return "Vehicles & Drivers";
  if (t === "drivers") return "Drivers";
  if (t === "driver_earnings") return "Driver Earnings";
  if (t === "pricing") return "Pricing";
  if (t === "memberships") return "Membership";
  if (t === "payouts") return "Payouts";
  if (t === "integrations") return "Integrations";
  if (t === "payments") return "Payments";
  if (t === "payers") return "Payers";
  if (t === "reviews") return "Reviews";
  if (t === "feedback") return "Send Feedback";

  if (t === "saved_patients") return portal === "patient" ? "Contacts" : "Contacts & Payers";
  if (t === "business_info") return "Business Info";
  if (t === "medicaid") return "Medicaid Submission";
  if (t === "training") return "Training & Tests";
  if (t === "schedule") return "Schedule";
  if (t === "messages") return "Messages";
  if (t === "notifications") return "Notifications";
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
  const baseAllowedTabs = PORTAL_TABS[portal];
  const meta = PORTAL_META[portal];

  const [tab, setTab] = useState<Tab>(baseAllowedTabs[0]);
  const [tripsSubtab, setTripsSubtab] = useState<TripsSubtab>("new");
  const [duplicateSource, setDuplicateSource] = useState<Trip | null>(null);
  function startDuplicate(t: Trip) {
    setDuplicateSource(t);
    if (portal === "provider") {
      setTripsSubtab("new");
      handleTab("trips");
    } else {
      handleTab("new");
    }
  }

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
    if (portal === "provider" && t === "trips" && tripsSubtab === "reservations") return TAB_KEYS.providerReservations;
    if (portal === "provider" && t === "received") return TAB_KEYS.providerReferrals;
    if (portal === "provider" && t === "payments") return TAB_KEYS.providerPayments;
    if (portal === "provider" && t === "payouts") return TAB_KEYS.providerPayouts;
    if (portal === "provider" && t === "memberships") return TAB_KEYS.providerMembership;
    if (portal === "provider" && t === "business_info") return TAB_KEYS.providerCompliance;
    if (portal === "provider" && t === "drivers") return TAB_KEYS.providerDrivers;
    if (portal === "provider" && t === "vehicles") return TAB_KEYS.providerVehicles;
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
  }, [tab, tripsSubtab, (unread as any)[tabKeyFor(tab) ?? ""]]);



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

  // Provider compliance status (Approved / Caution / Review / Denied).
  const providerAppId = (profileQ.data as any)?.provider_application_id ?? null;
  const complianceQ = useQuery({
    queryKey: ["provider-compliance", providerAppId],
    enabled: !!providerAppId && (portalOverride ?? "provider") === "provider",
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_applications")
        .select("compliance_status, compliance_notes, compliance_review_started_at")
        .eq("id", providerAppId!)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });



  const realProfile = profileQ.data as (Profile & { membership_tier?: string }) | null;
  const profile: (Profile & { membership_tier?: string }) | null = realProfile;
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
  // A provider whose application has been approved (linked via
  // provider_application_id on their profile) skips the onboarding wall
  // entirely — they get the normal provider experience immediately.
  const isApprovedProvider =
    portal === "provider" && !!realProfile && !!(realProfile as any).provider_application_id;
  // Soft-access only applies while onboarding is still in progress.
  // Once onboarding is complete, membership rules alone gate paid features.
  const isSoftAccess =
    portal === "provider" && !isAdmin && !!realProfile && !onboarding.complete && !isApprovedProvider;
  const isTabLocked = (t: Tab) =>
    isSoftAccess && !(SOFT_ACCESS_TABS as readonly string[]).includes(t);

  // Hide the Onboarding tab once the provider has either completed onboarding
  // or been approved — regardless of membership status.
  const onboardingDone = isApprovedProvider || onboarding.complete;
  const allowedTabs = useMemo<Tab[]>(
    () => (onboardingDone ? baseAllowedTabs.filter((t) => t !== "onboarding") : baseAllowedTabs),
    [baseAllowedTabs, onboardingDone],
  );
  useEffect(() => {
    if (tab !== "changelog" && !allowedTabs.includes(tab)) setTab(allowedTabs[0]);
  }, [allowedTabs, tab]);

  // All signed-in users — including Free Plan providers — can create trips.
  // Membership only gates premium tools (e.g. Integrations) and receiving
  // referrals / opportunities. Referral acceptance / assignment is enforced
  // server-side by is_approved_provider.
  const canSend = !!userId;
  const canUsePaidTools = profile?.membership_status === "active" && (profile as any)?.membership_tier === "paid";


  const realTrips = tripsQ.data ?? [];
  const sent = realTrips.filter((t) => t.created_by === userId);
  // Referrals tab: trips assigned to me, plus pending referrals awaiting my
  // accept/decline (auto-routed by service area or sent by another provider).
  const received = realTrips.filter(
    (t) =>
      t.assigned_to === userId ||
      ((t as any).referral_target_id === userId &&
        String((t as any).referral_status ?? "").toLowerCase() === "pending"),
  );



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
              Admin preview · {portal} dashboard
            </span>
            <Link to="/admin" className="font-bold text-[oklch(0.92_0.07_65)] hover:underline text-xs uppercase tracking-wider">
              ← Back to admin
            </Link>
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
                <div className="text-xs font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.04_220)] mb-2">My Florida NEMT · {portal}</div>
                <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-brand">{meta.label}</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">{meta.heroText}</p>
              </div>
              <div className="grid grid-cols-3 gap-px bg-border border border-border min-w-[420px]">
                <StatCell label="Referrals" value={received.length} accent />
                <StatCell label="Upcoming" value={upcoming} />
                <StatCell label="Completed" value={completed} />
              </div>
            </div>

            {portal === "provider" && isSoftAccess && (
              <div className="bg-[oklch(0.96_0.05_55)] border-l-4 border-[oklch(0.70_0.18_45)] p-4 text-sm">
                <p className="font-bold text-[oklch(0.35_0.12_45)] uppercase tracking-wide text-xs mb-1">Soft Access</p>
                <p className="text-[oklch(0.30_0.08_45)] mb-2">
                  Your account is on <strong>Soft Access</strong> while you finish onboarding and approval. You can use the platform to run your own business — full-network features unlock once you're an approved provider.
                </p>
                <div className="grid md:grid-cols-2 gap-3 text-[oklch(0.30_0.08_45)]">
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wide mb-1">You can</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li>Create new trips for your own patients</li>
                      <li>View your registration &amp; profile information</li>
                      <li>Manage Vehicles &amp; Drivers</li>
                      <li>Update Account tabs and required information</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wide mb-1">Not until approved</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li>Receive or view referrals from the network</li>
                      <li>Access the Provider Network or collect contacts</li>
                      <li>Accept Medicaid-funded trips</li>
                      <li>Any feature that requires full-membership / approved-provider status</li>
                    </ul>
                  </div>
                </div>
                <p className="mt-2 text-xs">
                  Finish the onboarding checklist to move to full access.{" "}
                  <Link to="/membership" className="underline font-bold">Membership details →</Link>
                </p>
              </div>
            )}


            {portal === "provider" && complianceQ.data && complianceQ.data.compliance_status && complianceQ.data.compliance_status !== "approved" && (() => {
              const s = complianceQ.data.compliance_status as string;
              const notes = complianceQ.data.compliance_notes as string | null;
              const startedAt = complianceQ.data.compliance_review_started_at as string | null;
              const isDenied = s === "denied";
              const tone = isDenied
                ? "bg-red-50 border-red-500 text-red-800"
                : "bg-amber-50 border-amber-500 text-amber-800";
              const label = s === "caution" ? "Compliance · Caution" : s === "review" ? "Compliance · 48-Hour Review" : "Compliance · Denied";
              return (
                <div className={`border-l-4 p-4 text-sm ${tone}`}>
                  <p className="font-bold uppercase tracking-wide text-xs mb-1">{label}</p>
                  <p>
                    {isDenied
                      ? "Your account has been denied. Please contact your Dispatch Zone Manager or Admin."
                      : "Your account is active with a compliance flag. Medicaid trips are paused until your status returns to Approved. Please work with your Dispatch Zone Manager to resolve the items below."}
                  </p>
                  {notes && <p className="mt-2 whitespace-pre-wrap"><strong>Notes:</strong> {notes}</p>}
                  {s === "review" && startedAt && (
                    <p className="mt-2 text-xs opacity-80">Review started {new Date(startedAt).toLocaleString()}.</p>
                  )}
                </div>
              );
            })()}



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
              const onChanged = () => {
                // Keep Provider / Dispatch / Admin views in sync after a referral decision.
                for (const k of ["my-trips", "reservations-by-state", "admin-reservations", "admin-trips", "incoming-requests", "unread-counts", "disp"]) {
                  qc.invalidateQueries({ queryKey: [k] });
                }
              };

              return (
                <div className="space-y-8">
                  <section>
                    <div className="mb-3">
                      <h3 className="font-display text-base font-bold tracking-tight">My Florida NEMT Submissions <span className="text-muted-foreground font-normal">({flNemt.length})</span></h3>
                      <p className="text-sm text-muted-foreground">Auto-routed referrals from My Florida NEMT based on your service area.</p>
                    </div>
                    {flNemt.length === 0
                      ? <div className="bg-secondary border border-border p-6 text-sm text-muted-foreground">No My Florida NEMT referrals right now.</div>
                      : <TripList trips={flNemt} userId={userId!} role="recipient" onChanged={onChanged} onDuplicate={startDuplicate} />}
                  </section>
                  <section>
                    <div className="mb-3">
                      <h3 className="font-display text-base font-bold tracking-tight">Subscribed Provider Submissions <span className="text-muted-foreground font-normal">({subProv.length})</span></h3>
                      <p className="text-sm text-muted-foreground">Trips sent directly to you by providers and facilities in your network.</p>
                    </div>
                    {subProv.length === 0
                      ? <div className="bg-secondary border border-border p-6 text-sm text-muted-foreground">No partner submissions yet.</div>
                      : <TripList trips={subProv} userId={userId!} role="recipient" onChanged={onChanged} onDuplicate={startDuplicate} />}
                  </section>
                </div>
              );
            })()}
            {tab === "sent" && <TripList trips={sent} userId={userId!} role="sender" portal={portal} onChanged={() => qc.invalidateQueries({ queryKey: ["my-trips"] })} onDuplicate={startDuplicate} />}
            {tab === "new" && (canSend ? <NewTripForm portal={portal} userId={userId} initialTrip={duplicateSource} onCreated={() => { qc.invalidateQueries({ queryKey: ["my-trips"] }); setDuplicateSource(null); setTab("sent"); }} /> : <PaidOnly />)}
            {tab === "upload" && (canSend ? <CsvUpload onUploaded={() => { qc.invalidateQueries({ queryKey: ["my-trips"] }); setTab("sent"); }} /> : <PaidOnly />)}
            {tab === "reservations" && <ReservationsPanel userId={userId!} scope={portal === "provider" ? "provider" : "requester"} />}
            {tab === "trips" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-border">
                  <button
                    type="button"
                    onClick={() => setTripsSubtab("new")}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tripsSubtab === "new" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {portal === "patient" ? "Request a ride" : "New trip"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTripsSubtab("reservations"); const key = tabKeyFor("trips"); if (key) markViewed(key); }}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tripsSubtab === "reservations" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    Reservations
                    {(unread as any)[TAB_KEYS.providerReservations] > 0 && tripsSubtab !== "reservations" && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {(unread as any)[TAB_KEYS.providerReservations]}
                      </span>
                    )}
                  </button>
                  {portal === "provider" && (
                    <button
                      type="button"
                      onClick={() => setTripsSubtab("history")}
                      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tripsSubtab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      Trip History
                    </button>
                  )}
                </div>
                {tripsSubtab === "new" && (canSend ? <NewTripForm portal={portal} userId={userId} initialTrip={duplicateSource} onCreated={() => {
                  qc.invalidateQueries({ queryKey: ["my-trips"] });
                  qc.invalidateQueries({ queryKey: ["reservations-by-state"] });
                  qc.invalidateQueries({ queryKey: ["unread-counts"] });
                  setDuplicateSource(null);
                  setTripsSubtab("reservations");
                }} /> : <PaidOnly />)}
                {tripsSubtab === "reservations" && <ReservationsPanel userId={userId!} scope={portal === "provider" ? "provider" : "requester"} />}
                {tripsSubtab === "history" && portal === "provider" && <TripHistoryPanel userId={userId!} />}
              </div>
            )}
            {tab === "schedule" && <ScheduleCalendarPanel />}
            {tab === "rules" && <RulesPanel />}
            {tab === "contacts" && <ContactsPanel />}
            {tab === "providers" && <FacilityProvidersPanel initialMode="lookup" />}
            {tab === "saved_providers" && <FacilityProvidersPanel initialMode="saved" />}
            {tab === "vehicles" && (
              <div className="space-y-8">
                <FleetPanel />
                <DriverEarningsPanel />
              </div>
            )}
            {tab === "pricing" && <PricingPanel />}
            {tab === "memberships" && <MembershipsTab profile={profile} />}
            {tab === "payouts" && (
              <div className="space-y-8">
                <ProviderBalancePanel />
                <PayoutsPanel userId={userId!} />
              </div>
            )}
            {tab === "integrations" && (canUsePaidTools ? <IntegrationsPanel /> : <PaidOnly />)}
            {tab === "payments" && <PaymentsTab portal={portal} />}
            {tab === "payers" && <ContactsAndPayersPanel portal={portal} initialSubTab="payers" />}
            {tab === "reviews" && <ProviderReviewsPanel />}
            {tab === "feedback" && <SendFeedbackPanel />}

            {tab === "saved_patients" && <ContactsAndPayersPanel portal={portal} />}
            {/* business_info tab removed — merged into Account > Profile for providers */}
            {tab === "medicaid" && <MedicaidSubmissionCenter userId={userId!} />}
            {tab === "training" && <TrainingPanel />}
            {tab === "messages" && <MessagesPanel userId={userId!} portal={portal} />}
            {tab === "notifications" && <NotificationsPanel />}
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
      const { error } = await supabase
        .from("member_profiles")
        .upsert(payload, { onConflict: "user_id" });
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

function Field({ label, v, on, required, type = "text", placeholder, className = "", error, name }: {
  label: string; v: string; on: (v: string) => void; required?: boolean; type?: string; placeholder?: string; className?: string; error?: string; name?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="portal-label">{label}{required && " *"}</span>
      <input
        data-field={name}
        type={type} value={v} onChange={(e) => on(e.target.value)} required={required} placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`portal-input ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}


/* -------- Membership Gate -------- */
function MembershipGate() {
  return (
    <div className="max-w-2xl mx-auto bg-card border border-border rounded-sm p-10 text-center">
      <h2 className="text-3xl font-extrabold tracking-tight mb-2">Activate your membership</h2>
      <p className="text-muted-foreground mb-6">
        Membership unlocks trip dispatch, CSV upload, and regional provider directory.
        Choose $10/mo or $100/yr (save $20).
      </p>
      <Link to="/membership" className="portal-btn-primary px-6 py-3">
        Subscribe — $10/mo or $100/yr
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
      <p className="text-muted-foreground mb-4">This feature is available on the paid plan — $10/mo or $100/yr.</p>
      <Link to="/membership" className="portal-btn-primary px-5 py-2.5">
        Upgrade — $10/mo or $100/yr
      </Link>
    </div>
  );
}

/* -------- New Trip Form -------- */
function NewTripForm({ onCreated, initialTrip, initialDraft, portal, userId }: { onCreated: () => void; initialTrip?: any; initialDraft?: { id: string; payload: Record<string, any> } | null; portal: PortalKind; userId?: string | null }) {
  const seed = initialDraft?.payload ?? initialTrip ?? {};
  const resuming = !!initialDraft;
  const [form, setForm] = useState<any>({
    trip_kind: seed.trip_kind ?? "passenger",
    patient_first_name: seed.patient_first_name ?? "",
    patient_last_name: seed.patient_last_name ?? "",
    patient_phone: seed.patient_phone ?? "",
    patient_email: seed.patient_email ?? "",
    patient_date_of_birth: seed.patient_date_of_birth ?? "",
    is_medicaid_patient: !!seed.is_medicaid_patient,
    medicaid_number: seed.medicaid_number ?? "",
    medicaid_plan: seed.medicaid_plan ?? "",
    authorization_number: seed.authorization_number ?? "",
    diagnosis_code: seed.diagnosis_code ?? "",
    emergency_contact_name: seed.emergency_contact_name ?? "",
    emergency_contact_phone: seed.emergency_contact_phone ?? "",
    pickup_address: seed.pickup_address ?? "",
    pickup_address_details: seed.pickup_address_details ?? "",
    pickup_city: seed.pickup_city ?? "",
    pickup_zip: seed.pickup_zip ?? "",
    // Date/time intentionally blank so user picks a new schedule.
    pickup_date: resuming ? seed.pickup_date ?? "" : "",
    pickup_time: resuming ? seed.pickup_time ?? "" : "",
    appointment_time: resuming ? seed.appointment_time ?? "" : "",
    dropoff_address: seed.dropoff_address ?? "",
    dropoff_city: seed.dropoff_city ?? "",
    dropoff_zip: seed.dropoff_zip ?? "",
    transport_type: seed.transport_type ?? "ambulatory",
    round_trip: !!seed.round_trip,
    return_pickup_time: resuming ? seed.return_pickup_time ?? "" : "",
    return_dropoff_time: resuming ? seed.return_dropoff_time ?? "" : "",
    return_date: resuming ? seed.return_date ?? "" : "",
    return_pickup_building: seed.return_pickup_building ?? "",
    return_pickup_doctor: seed.return_pickup_doctor ?? "",
    return_pickup_suite: seed.return_pickup_suite ?? "",
    service_level: seed.service_level ?? "curb_to_curb",
    needs_wheelchair: !!seed.needs_wheelchair,
    has_passenger: !!seed.has_passenger,
    needs_assistance_to_vehicle: !!seed.needs_assistance_to_vehicle,
    needs_surgery_signin: !!seed.needs_surgery_signin,
    needs_surgery_signout: !!seed.needs_surgery_signout,
    mobility_notes: seed.mobility_notes ?? "",
    special_instructions: seed.special_instructions ?? "",
    payer: seed.payer ?? "",
    payer_id: seed.payer_id ?? "",
    
    // Medical Delivery fields (only used when trip_kind === 'medical_delivery')
    delivery_item_type: seed.delivery_item_type ?? "prescription",
    delivery_item_description: seed.delivery_item_description ?? "",
    delivery_weight_lbs: seed.delivery_weight_lbs ?? "",
    delivery_temperature_sensitive: !!seed.delivery_temperature_sensitive,
    delivery_hazmat: !!seed.delivery_hazmat,
    delivery_signature_required: !!seed.delivery_signature_required,
    delivery_rush: !!seed.delivery_rush,
    delivery_recipient_name: seed.delivery_recipient_name ?? "",
    delivery_recipient_phone: seed.delivery_recipient_phone ?? "",
  });
  const isDelivery = form.trip_kind === "medical_delivery";

  // ---- Draft autosave -------------------------------------------------
  // Everything typed here is saved as an unsubmitted draft so nothing is lost.
  // Providers find drafts under Reservations; patients/facilities under Saved Trips.
  const qcDraft = useQueryClient();
  const saveDraftFn = useServerFn(saveTripDraft);
  const markDraftSubmitted = useServerFn(markTripDraftSubmitted);
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const draftIdRef = useRef<string | null>(initialDraft?.id ?? null);
  const submittedRef = useRef(false);
  useEffect(() => { draftIdRef.current = draftId; }, [draftId]);

  const draftHasContent =
    !!(form.patient_first_name || form.patient_last_name || form.patient_phone ||
       form.pickup_address || form.dropoff_address || form.pickup_date);

  const persistDraft = useCallback(async (autosaved: boolean) => {
    setSavingDraft(true);
    try {
      const res = await saveDraftFn({ data: { draft_id: draftIdRef.current, payload: form, autosaved } });
      draftIdRef.current = res.id;
      setDraftId(res.id);
      setDraftSavedAt(new Date());
      qcDraft.invalidateQueries({ queryKey: ["trip-drafts"] });
      return res.id;
    } finally {
      setSavingDraft(false);
    }
  }, [form, saveDraftFn, qcDraft]);

  useEffect(() => {
    if (!draftHasContent || submittedRef.current) return;
    const t = setTimeout(() => { persistDraft(true).catch(() => {}); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, draftHasContent]);

  // HIPAA acknowledgment is now managed in Settings (Business info). The
  // server auto-resolves the caller's latest acknowledgment on submit, so
  // this form no longer prompts for it every time.
  const [returnDateManual, setReturnDateManual] = useState(false);
  // Location metadata from Google Places for live mileage/quote.
  const [pickupMeta, setPickupMeta] = useState<{ zip: string; lat: number | null; lng: number | null }>({ zip: form.pickup_zip ?? "", lat: null, lng: null });
  const [dropoffMeta, setDropoffMeta] = useState<{ zip: string; lat: number | null; lng: number | null }>({ zip: form.dropoff_zip ?? "", lat: null, lng: null });
  const estimatedMiles = haversineMiles(pickupMeta.lat, pickupMeta.lng, dropoffMeta.lat, dropoffMeta.lng);
  const canPickPayer = true;
  const canManagePayers = portal === "facility" || portal === "provider";
  const payersQ = useQuery({
    queryKey: ["my-payers-picker"],
    queryFn: () => listMyPayers(),
    enabled: canManagePayers,
    staleTime: 60_000,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validateClient(payload: any): Record<string, string> {
    const errs: Record<string, string> = {};
    const req = (k: string, label: string) => {
      if (!payload[k] || String(payload[k]).trim() === "") errs[k] = `${label} is required.`;
    };
    req("patient_first_name", isDelivery ? "Sender first name" : "Patient first name");
    req("patient_last_name", isDelivery ? "Sender last name" : "Patient last name");
    req("pickup_address", "Pickup address");
    req("pickup_city", "Pickup city");
    req("pickup_date", "Pickup date");
    req("pickup_time", "Pickup time");
    req("dropoff_address", "Dropoff address");
    req("dropoff_city", "Dropoff city");
    if (payload.round_trip) {
      req("return_date", "Return date");
      req("return_pickup_time", "Return pickup time");
    }
    if (payload.patient_email && !/^\S+@\S+\.\S+$/.test(String(payload.patient_email))) {
      errs.patient_email = "Please enter a valid email address.";
    }
    return errs;
  }

  const m = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.round_trip && !payload.return_date) payload.return_date = payload.pickup_date;
      if (!payload.round_trip) payload.return_date = null;
      const clientErrs = validateClient(payload);
      if (Object.keys(clientErrs).length > 0) {
        setFieldErrors(clientErrs);
        const first = Object.keys(clientErrs)[0];
        // Focus the first invalid field
        setTimeout(() => {
          const el = document.querySelector(`[data-field="${first}"]`) as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.focus?.();
        }, 0);
        throw new Error(clientErrs[first]);
      }
      setFieldErrors({});
      if (!payload.patient_date_of_birth) delete payload.patient_date_of_birth;
      if (!payload.patient_email) delete payload.patient_email;
      if (!payload.return_pickup_time) delete payload.return_pickup_time;
      if (!payload.return_dropoff_time) delete payload.return_dropoff_time;
      if (!payload.return_date) delete payload.return_date;
      if (!payload.appointment_time) delete payload.appointment_time;
      if (!payload.payer_id) delete payload.payer_id;
      if (payload.trip_kind !== "medical_delivery") {
        delete payload.delivery_item_type;
        delete payload.delivery_item_description;
        delete payload.delivery_weight_lbs;
        delete payload.delivery_temperature_sensitive;
        delete payload.delivery_hazmat;
        delete payload.delivery_signature_required;
        delete payload.delivery_rush;
        delete payload.delivery_recipient_name;
        delete payload.delivery_recipient_phone;
      } else {
        if (payload.delivery_weight_lbs === "" || payload.delivery_weight_lbs === null) {
          delete payload.delivery_weight_lbs;
        }
      }
      return createTrip({ data: payload });
    },
    onSuccess: () => { toast.success("Trip created"); setFieldErrors({}); onCreated(); },
    onError: async (e: any) => {
      const { humanizeError } = await import("@/lib/friendly-errors");
      const friendly = humanizeError(e);
      if (friendly.fields && Object.keys(friendly.fields).length > 0) {
        setFieldErrors(friendly.fields);
        const first = Object.keys(friendly.fields)[0];
        setTimeout(() => {
          const el = document.querySelector(`[data-field="${first}"]`) as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      }
      toast.error(friendly.message);
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="max-w-3xl bg-card border border-border rounded-sm p-6 grid grid-cols-2 gap-4">
      <h2 className="col-span-2 text-xl font-extrabold tracking-tight">{initialTrip ? "Duplicate trip" : "New trip"}</h2>
      {initialTrip && (
        <div className="col-span-2 -mt-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Duplicated from trip {initialTrip.display_id ?? initialTrip.id}. Set a new <strong>pickup date and time</strong>, review the details, and save to create a brand-new trip. The original trip will not be changed.
        </div>
      )}

      {/* Trip kind selector — passenger transport vs medical delivery */}
      <fieldset className="col-span-2 grid grid-cols-2 gap-2 border border-border rounded-sm p-2">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">What are you sending?</legend>
        {[
          { key: "passenger", label: "Patient / Passenger", sub: "Non-emergency medical transport" },
          { key: "medical_delivery", label: "Medical Delivery", sub: "Prescriptions, samples, DME, supplies" },
        ].map((opt) => {
          const active = form.trip_kind === opt.key;
          return (
            <button
              type="button"
              key={opt.key}
              onClick={() => setForm({ ...form, trip_kind: opt.key })}
              className={`text-left rounded-sm border-2 px-3 py-2 transition-colors ${
                active ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
              }`}
              aria-pressed={active}
            >
              <div className="text-sm font-bold">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.sub}</div>
            </button>
          );
        })}
      </fieldset>

      <Field name="patient_first_name" error={fieldErrors.patient_first_name} label={isDelivery ? "Sender / requestor first name" : "Patient first name"} v={form.patient_first_name} on={(v) => setForm({ ...form, patient_first_name: v })} required />
      <Field name="patient_last_name" error={fieldErrors.patient_last_name} label={isDelivery ? "Sender / requestor last name" : "Patient last name"} v={form.patient_last_name} on={(v) => setForm({ ...form, patient_last_name: v })} required />
      <Field name="patient_phone" error={fieldErrors.patient_phone} label={isDelivery ? "Sender phone" : "Patient phone"} v={form.patient_phone} on={(v) => setForm({ ...form, patient_phone: v })} />
      <Field name="patient_email" error={fieldErrors.patient_email} label={isDelivery ? "Sender email" : "Patient email"} v={form.patient_email} on={(v) => setForm({ ...form, patient_email: v })} type="email" />
      {!isDelivery && (
        <Field name="patient_date_of_birth" error={fieldErrors.patient_date_of_birth} label="Patient date of birth" v={form.patient_date_of_birth} on={(v) => setForm({ ...form, patient_date_of_birth: v })} type="date" />
      )}
      

      {isDelivery ? (
        <fieldset className="col-span-2 grid grid-cols-2 gap-3 border border-border rounded-sm p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery details</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="portal-label">Item type</span>
            <select value={form.delivery_item_type} onChange={(e) => setForm({ ...form, delivery_item_type: e.target.value })} className="portal-select">
              <option value="prescription">Prescription</option>
              <option value="lab_sample">Lab / specimen sample</option>
              <option value="medical_supplies">Medical supplies</option>
              <option value="equipment">Equipment</option>
              <option value="dme">Durable medical equipment (DME)</option>
              <option value="other">Other healthcare item</option>
            </select>
          </label>
          <Field label="Weight (lbs)" v={form.delivery_weight_lbs} on={(v) => setForm({ ...form, delivery_weight_lbs: v })} type="number" placeholder="Optional" />
          <Field label="Item description" v={form.delivery_item_description} on={(v) => setForm({ ...form, delivery_item_description: v })} placeholder="e.g. 2 sealed lab specimens on ice" className="col-span-2" />
          <Field label="Recipient name" v={form.delivery_recipient_name} on={(v) => setForm({ ...form, delivery_recipient_name: v })} placeholder="Who receives it at drop-off" />
          <Field label="Recipient phone" v={form.delivery_recipient_phone} on={(v) => setForm({ ...form, delivery_recipient_phone: v })} />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.delivery_temperature_sensitive} onChange={(e) => setForm({ ...form, delivery_temperature_sensitive: e.target.checked })} />
            Temperature-sensitive / cold-chain
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.delivery_signature_required} onChange={(e) => setForm({ ...form, delivery_signature_required: e.target.checked })} />
            Signature required at delivery
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.delivery_hazmat} onChange={(e) => setForm({ ...form, delivery_hazmat: e.target.checked })} />
            Hazmat / biohazard
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.delivery_rush} onChange={(e) => setForm({ ...form, delivery_rush: e.target.checked })} />
            Rush / priority
          </label>
        </fieldset>
      ) : (
        <fieldset className="col-span-2 grid grid-cols-2 gap-3 border border-border rounded-sm p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">Billing &amp; contacts</legend>
          <label className="col-span-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <input
              type="checkbox"
              checked={!!form.is_medicaid_patient}
              onChange={(e) => {
                const on = e.target.checked;
                setForm({
                  ...form,
                  is_medicaid_patient: on,
                  ...(on ? {} : { medicaid_number: "", medicaid_plan: "", authorization_number: "", diagnosis_code: "" }),
                });
              }}
            />
            Medicaid patient
          </label>
          {form.is_medicaid_patient && (<>
          <Field label="Medicaid #" v={form.medicaid_number} on={(v) => setForm({ ...form, medicaid_number: v })} />
          <Field label="Medicaid plan" v={form.medicaid_plan} on={(v) => setForm({ ...form, medicaid_plan: v })} placeholder="e.g. Sunshine Health, Simply, MMA" />
          <Field label="Authorization #" v={form.authorization_number} on={(v) => setForm({ ...form, authorization_number: v })} />
          <Field label="Diagnosis code" v={form.diagnosis_code} on={(v) => setForm({ ...form, diagnosis_code: v })} placeholder="ICD-10 (optional)" />
          </>)}
          <Field label="Emergency contact name" v={form.emergency_contact_name} on={(v) => setForm({ ...form, emergency_contact_name: v })} />
          <Field label="Emergency contact phone" v={form.emergency_contact_phone} on={(v) => setForm({ ...form, emergency_contact_phone: v })} />
        </fieldset>
      )}


      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="portal-label">Pickup address</span>
        <AddressAutocomplete
          value={form.pickup_address}
          onChange={(v: string) => setForm((f: any) => ({ ...f, pickup_address: v }))}
          onSelect={(sel: AddressSelection) => {
            setForm((f: any) => ({
              ...f,
              pickup_address: sel.address,
              pickup_city: sel.city || f.pickup_city,
              pickup_zip: sel.zip || f.pickup_zip,
            }));
            setPickupMeta({ zip: sel.zip, lat: sel.lat, lng: sel.lng });
          }}
          className="portal-select"
          required
        />
      </label>
      <Field label="Building / Doctor's office / Suite" v={form.pickup_address_details} on={(v) => setForm({ ...form, pickup_address_details: v })} className="col-span-2" placeholder="e.g. Dr. Smith — Suite 210" />
      <Field name="pickup_city" error={fieldErrors.pickup_city} label="Pickup city" v={form.pickup_city} on={(v) => setForm({ ...form, pickup_city: v })} required />
      <Field name="pickup_zip" error={fieldErrors.pickup_zip} label="Pickup ZIP" v={form.pickup_zip} on={(v) => setForm({ ...form, pickup_zip: v })} />
      <DatePickerField
        label="Pickup date"
        value={form.pickup_date}
        onChange={(v) => setForm({
          ...form,
          pickup_date: v,
          return_date: form.round_trip && !returnDateManual ? v : form.return_date,
        })}
        required
        booking
      />
      <TimePickerField
        label="Pickup time"
        value={form.pickup_time}
        pickupDate={form.pickup_date}
        enforceLeadTime
        required
        onChange={(v) => setForm({
          ...form, pickup_time: v,
          return_pickup_time: form.round_trip && !form.return_pickup_time ? v : form.return_pickup_time,
        })}
      />
      <TimePickerField label="Appointment time" value={form.appointment_time} onChange={(v) => setForm({ ...form, appointment_time: v })} />

      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="portal-label">Dropoff address</span>
        <AddressAutocomplete
          value={form.dropoff_address}
          onChange={(v: string) => setForm((f: any) => ({ ...f, dropoff_address: v }))}
          onSelect={(sel: AddressSelection) => {
            setForm((f: any) => ({
              ...f,
              dropoff_address: sel.address,
              dropoff_city: sel.city || f.dropoff_city,
              dropoff_zip: sel.zip || f.dropoff_zip,
            }));
            setDropoffMeta({ zip: sel.zip, lat: sel.lat, lng: sel.lng });
          }}
          className="portal-select"
          required
        />
      </label>
      <Field name="dropoff_city" error={fieldErrors.dropoff_city} label="Dropoff city" v={form.dropoff_city} on={(v) => setForm({ ...form, dropoff_city: v })} required />
      <Field name="dropoff_zip" error={fieldErrors.dropoff_zip} label="Dropoff ZIP" v={form.dropoff_zip} on={(v) => setForm({ ...form, dropoff_zip: v })} />
      {!isDelivery && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="portal-label">Transportation type</span>
          <select value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })}
                  className="portal-select">
            <option value="ambulatory">Ambulatory</option>
            <option value="wheelchair">Wheelchair</option>
            <option value="stretcher">Stretcher</option>
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="portal-label">Service level</span>
        <select value={form.service_level} onChange={(e) => setForm({ ...form, service_level: e.target.value })}
                className="portal-select">
          {isDelivery ? (
            <>
              <option value="curb_to_curb">Curb to curb (hand-off outside)</option>
              <option value="door_to_door">Door to door (hand-off at door)</option>
            </>
          ) : (
            <>
              <option value="curb_to_curb">Curb to curb</option>
              <option value="door_to_door">Door to door</option>
              <option value="bed_to_bed">Bed to bed</option>
              <option value="driveway_pickup">Pickup in driveway</option>
            </>
          )}
        </select>
      </label>
      {!isDelivery && (
        <>
          <label className="flex items-center gap-2 text-sm font-bold mt-2 col-span-2">
            <input type="checkbox" checked={form.round_trip} onChange={(e) => {
              const on = e.target.checked;
              setForm({
                ...form,
                round_trip: on,
                return_pickup_time: on && !form.return_pickup_time ? form.pickup_time : form.return_pickup_time,
                return_date: on ? (returnDateManual && form.return_date ? form.return_date : form.pickup_date) : "",
              });
              if (!on) setReturnDateManual(false);
            }} />
            Round trip (return date &amp; pickup time required)
          </label>
          {form.round_trip && (
            <>
              <DatePickerField
                label="Return date"
                value={form.return_date}
                onChange={(v) => { setReturnDateManual(true); setForm({ ...form, return_date: v }); }}
                required
                booking
              />
              <TimePickerField label="Return pickup time" value={form.return_pickup_time} pickupDate={form.return_date || form.pickup_date} enforceLeadTime onChange={(v) => setForm({ ...form, return_pickup_time: v })} required />
              <TimePickerField label="Return dropoff time" value={form.return_dropoff_time} onChange={(v) => setForm({ ...form, return_dropoff_time: v })} />
              <Field label="Return pickup building" v={form.return_pickup_building} on={(v) => setForm({ ...form, return_pickup_building: v })} placeholder="e.g. Medical Arts Building B" />
              <Field label="Return pickup doctor / office" v={form.return_pickup_doctor} on={(v) => setForm({ ...form, return_pickup_doctor: v })} placeholder="e.g. Dr. Smith" />
              <Field label="Return pickup suite" v={form.return_pickup_suite} on={(v) => setForm({ ...form, return_pickup_suite: v })} placeholder="e.g. Suite 210" />
              <div className="col-span-2 -mt-1 text-[11px] text-muted-foreground">
                Defaults to your pickup date. Change it if the patient returns on a different day (e.g. after surgery).
              </div>
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
        </>
      )}

      {canPickPayer && (
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="portal-label">Payer (who pays for this trip)</span>
          <select
            value={form.payer_id || (form.payer === "Medicaid" ? "medicaid" : "self")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "self") { setForm({ ...form, payer_id: "", payer: "Self Payer" }); return; }
              if (v === "medicaid") { setForm({ ...form, payer_id: "", payer: "Medicaid", is_medicaid_patient: true }); return; }
              const p = (payersQ.data ?? []).find((x: any) => x.id === v);
              setForm({ ...form, payer_id: v, payer: p?.name ?? "" });
            }}
            className="portal-select"
          >
            <option value="self">Self Payer (no third-party payer)</option>
            {form.is_medicaid_patient && <option value="medicaid">Medicaid</option>}
            {(payersQ.data ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}{p.email ? ` — ${p.email}` : ""}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            Only cards saved to the selected payer will be usable when this trip is charged.
            {canManagePayers && (<>
              {" "}
              <Link to="/dashboard" search={{ tab: "payers" } as any} className="underline">Manage payers</Link>.
            </>)}
          </span>
        </label>
      )}
      {!isDelivery && (
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="portal-label">Mobility notes</span>
          <textarea value={form.mobility_notes} onChange={(e) => setForm({ ...form, mobility_notes: e.target.value })}
                    className="portal-select" rows={2} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="portal-label">{isDelivery ? "Delivery instructions" : "Special instructions"}</span>
        <textarea value={form.special_instructions} onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
                  className="portal-select" rows={2} placeholder={isDelivery ? "Access notes, dock instructions, cold-chain requirements, etc." : ""} />
      </label>

      {!isDelivery && (() => {
        const pickup = [form.pickup_address, form.pickup_city].filter(Boolean).join(", ");
        const dropoff = [form.dropoff_address, form.dropoff_city].filter(Boolean).join(", ");
        const legs: LegInput[] = [
          { label: "Pickup", from: pickup, to: dropoff, date: form.pickup_date, time: form.pickup_time },
        ];
        if (form.round_trip) {
          const rdate = form.return_date || form.pickup_date;
          legs.push({
            label: "Return",
            from: dropoff,
            to: pickup,
            date: rdate,
            time: form.return_pickup_time || form.pickup_time,
            inheritedDate: !form.return_date || form.return_date === form.pickup_date,
            inheritedTime: !form.return_pickup_time,
          });
        }
        return <div className="col-span-2"><TripLegsPreview legs={legs} /></div>;
      })()}

      <div className="col-span-2 space-y-3">
        <PriceEstimate
          pickupZip={pickupMeta.zip || form.pickup_zip || ""}
          miles={estimatedMiles}
          transportType={(form.transport_type === "stretcher" ? "gurney" : form.transport_type) as "ambulatory" | "wheelchair" | "gurney"}
          providerId={portal === "provider" ? (userId ?? undefined) : undefined}
          legs={form.round_trip ? 2 : 1}
          tripTypeLabel={form.round_trip ? "Round trip" : "One-way"}
        />
        {portal === "provider" && (
          <TripFinancialBreakdown
            pickupZip={pickupMeta.zip || form.pickup_zip || ""}
            miles={estimatedMiles}
            transportType={(form.transport_type === "stretcher" ? "gurney" : form.transport_type) as "ambulatory" | "wheelchair" | "gurney"}
            senderUserId={userId ?? undefined}
            legs={form.round_trip ? 2 : 1}
            tripTypeLabel={form.round_trip ? "Round trip" : "One-way"}
          />
        )}
      </div>

      <p className="col-span-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-sm p-2">
        HIPAA acknowledgment is stored once in <strong>Settings → Business info</strong> and applied automatically to every trip you create.
      </p>
      <button disabled={m.isPending} className="portal-btn-primary col-span-2 py-3">
        {m.isPending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}

function haversineMiles(lat1: number | null, lng1: number | null, lat2: number | null, lng2: number | null): number {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 0;
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(a))).toFixed(2);
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
    setBusy(true);
    try {
      // HIPAA ack is resolved server-side from Settings.
      const res = await createTripsBulk({ data: { trips: rows } });
      toast.success(`Uploaded ${res.count} trips`);
      setPreview(null);
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
          <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-sm p-2 mb-3">
            HIPAA acknowledgment is stored once in <strong>Settings → Business info</strong> and applied automatically to bulk uploads.
          </p>
          <button
            disabled={busy || missing.length > 0}
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
function TripList({ trips, userId, role, portal, onChanged, onDuplicate }: { trips: Trip[]; userId: string; role: "sender" | "recipient"; portal?: PortalKind; onChanged: () => void; onDuplicate?: (t: Trip) => void }) {
  const [assigning, setAssigning] = useState<Trip | null>(null);
  const [viewing, setViewing] = useState<Trip | null>(null);
  const [rating, setRating] = useState<Trip | null>(null);
  const [reviewing, setReviewing] = useState<Trip | null>(null);
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
        portal={portal}
        onBack={() => setViewing(null)}
        onChanged={onChanged}
        onDuplicate={onDuplicate}
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
                  {onDuplicate && (
                    <button onClick={() => onDuplicate(t)} className="text-xs font-bold text-primary hover:underline mr-3" title="Create a new trip prefilled from this one">Duplicate</button>
                  )}
                  {role === "sender" && t.status === "open" && (
                    <button onClick={() => setAssigning(t)} className="text-xs font-bold text-accent hover:underline mr-3">Send</button>
                  )}
                  {canRate && t.assigned_to && (t.status === "completed" || t.status === "accepted") && (
                    <button onClick={() => setRating(t)} className="text-xs font-bold bg-amber-500 text-white px-2.5 py-1 rounded-sm hover:bg-amber-600 mr-2">★ Rate</button>
                  )}
                  {role === "recipient" && (
                    String((t as any).referral_status ?? "").toLowerCase() === "pending" ||
                    ["assigned","open","pending","offered"].includes((t.status ?? "").toLowerCase())
                  ) && (

                    <button
                      onClick={() => setReviewing(t)}
                      className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-sm hover:bg-emerald-700"
                    >
                      Review &amp; respond
                    </button>
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
      {reviewing && <ReferralReviewModal trip={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); onChanged(); }} />}
    </>
  );
}


type EditableFields = {
  patient_phone: string;
  patient_email: string;
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
  return_date: string;
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
    patient_email: toFormValue(t.patient_email),
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
    return_date: toFormValue(t.return_date),
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
  portal,
  onBack,
  onChanged,
  onDuplicate,
}: {
  trip: Trip;
  userId: string;
  role: "sender" | "recipient";
  portal?: PortalKind;
  onBack: () => void;
  onChanged: () => void;
  onDuplicate?: (t: Trip) => void;
}) {
  const t: any = trip;
  const [editing, setEditing] = useState(false);
  const detailPayersQ = useQuery({
    queryKey: ["my-payers-picker"],
    queryFn: () => listMyPayers(),
    enabled: portal === "facility" || portal === "provider",
    staleTime: 60_000,
  });
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<null | { onProceed: () => void }>(null);
  const qc = useQueryClient();

  const isSender = t.created_by === userId || role === "sender";
  const isRecipient = t.assigned_to === userId || role === "recipient";
  const isProviderPortal = portal === "provider";
  const canEditAll = isSender;
  // Only providers can edit the quote/cost. Patients & facilities are read-only on pricing.
  const canEditQuote = isRecipient && isProviderPortal;
  const canEditProviderFields = canEditQuote;
  const canEdit = canEditAll || canEditQuote;

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
        // Provider recipients may only edit provider_notes and cost_total (their quote).
        if (!canEditAll && !((k === "provider_notes" || k === "cost_total") && canEditQuote)) return;
        // Requesters (patients / facilities) never edit cost_total — pricing is auto-estimated
        // and finalized by the provider quote workflow.
        if (k === "cost_total" && !canEditQuote) return;
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

  // Quote lifecycle: estimate -> quote_required -> quoted -> approved -> paid
  type QuoteStage = { key: string; label: string; tone: string };
  let quoteStage: QuoteStage;
  if (refundedCents > 0) quoteStage = { key: "refunded", label: "Refunded", tone: "bg-slate-200 text-slate-700 border-slate-300" };
  else if (quoteDollars != null && paidDollars >= quoteDollars && quoteDollars > 0)
    quoteStage = { key: "paid", label: "Paid", tone: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  else if (!needsQuote && (t as any).quote_approved_at)
    quoteStage = { key: "approved", label: "Approved", tone: "bg-blue-100 text-blue-800 border-blue-300" };
  else if (!needsQuote)
    quoteStage = { key: "quoted", label: "Quoted", tone: "bg-primary/15 text-primary border-primary/40" };
  else if (t.assigned_to)
    quoteStage = { key: "required", label: "Quote required", tone: "bg-amber-100 text-amber-800 border-amber-300" };
  else
    quoteStage = { key: "estimate", label: "Estimate only", tone: "bg-zinc-100 text-zinc-700 border-zinc-300" };

  const isRound = !!t.round_trip;
  const isDelivery = (t as any).trip_kind === "medical_delivery";
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
    editing && allowed && opts?.type === "time" ? (
      <TimeSelect
        value={String(form[k] ?? "")}
        onChange={(v) => setField(k, v)}
        className="text-sm"
      />
    ) : editing && allowed ? (
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
      {/* Back link — full-width, prominent */}
      <button
        onClick={() => tryLeave(onBack)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <span aria-hidden="true">←</span> Back to trips
      </button>

      <header className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 min-w-0">
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
              {(t as any).trip_kind === "medical_delivery" && (
                <span className="text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-sky-100 text-sky-800 border border-sky-200">
                  Delivery
                </span>
              )}

            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
              {t.patient_first_name} {t.patient_last_name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.pickup_date}
              {t.pickup_time ? ` · Pickup ${t.pickup_time}` : ""}
              {t.appointment_time ? ` · Appt ${t.appointment_time}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end lg:shrink-0">
            <button
              onClick={() => downloadTripPdf(trip as TripPdfInput)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold border-2 border-border bg-background text-foreground px-4 py-2.5 rounded-md hover:bg-muted hover:border-foreground/40 transition-colors"
            >
              Download PDF
            </button>
            {onDuplicate && !editing && (
              <button
                onClick={() => onDuplicate(trip)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold border-2 border-border bg-background text-foreground px-4 py-2.5 rounded-md hover:bg-muted hover:border-foreground/40 transition-colors"
                title="Create a new trip prefilled from this one"
              >
                Duplicate trip
              </button>
            )}
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-md hover:bg-primary/90 shadow-sm transition-colors"
              >
                Edit trip
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={() => tryLeave(() => { setForm(original); setEditing(false); })}
                  disabled={saving}
                  className="text-sm font-semibold border-2 border-border bg-background text-foreground px-4 py-2.5 rounded-md hover:bg-muted disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => save()}
                  disabled={saving || !dirty}
                  className="text-sm font-semibold bg-emerald-600 text-white px-5 py-2.5 rounded-md hover:bg-emerald-700 disabled:opacity-60 shadow-sm"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            )}
          </div>
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
            <H>{isDelivery ? "Delivery information" : "Trip information"}</H>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Row label={isDelivery ? "Reference #" : "Trip #"}>{readOnly(t.trip_number ?? t.display_id)}</Row>
              <Row label="Source">{readOnly(t.source)}</Row>
              {!isDelivery && (
                <>
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
                </>
              )}
              {isDelivery && (
                <>
                  <Row label="Item type">{readOnly((t as any).delivery_item_type ? String((t as any).delivery_item_type).replace(/_/g, " ") : null)}</Row>
                  <Row label="Weight">{readOnly((t as any).delivery_weight_lbs ? `${(t as any).delivery_weight_lbs} lbs` : null)}</Row>
                  <Row label="Service level">{readOnly(t.service_level ? String(t.service_level).replace(/_/g, " ") : null)}</Row>
                  <Row label="Recipient">{readOnly((t as any).delivery_recipient_name)}</Row>
                  <Row label="Recipient phone">{readOnly((t as any).delivery_recipient_phone)}</Row>
                  <Row label="Item description" full>{readOnly((t as any).delivery_item_description)}</Row>
                  <Row label="Handling flags" full>
                    {(() => {
                      const dflags: string[] = [];
                      if ((t as any).delivery_temperature_sensitive) dflags.push("Cold chain");
                      if ((t as any).delivery_signature_required) dflags.push("Signature required");
                      if ((t as any).delivery_hazmat) dflags.push("Hazmat / biohazard");
                      if ((t as any).delivery_rush) dflags.push("Rush");
                      return dflags.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {dflags.map((f) => (
                            <span key={f} className="text-[0.7rem] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-muted-foreground">No special handling.</span>;
                    })()}
                  </Row>
                </>
              )}
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>{isDelivery ? "Sender & recipient" : "Passenger information"}</H>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Row label={isDelivery ? "Sender name" : "Name"}>{readOnly(`${t.patient_first_name ?? ""} ${t.patient_last_name ?? ""}`.trim())}</Row>
              <Row label={isDelivery ? "Sender phone" : "Phone"}>{input("patient_phone", canEditAll, { type: "tel" })}</Row>
              <Row label={isDelivery ? "Sender email" : "Email"}>{input("patient_email", canEditAll, { type: "email" })}</Row>
              {!isDelivery && (
                <>
                  <Row label="Date of birth">{readOnly(t.patient_date_of_birth)}</Row>
                  {t.is_medicaid_patient && (
                    <>
                      <Row label="Medicaid #">{readOnly(t.medicaid_number)}</Row>
                      <Row label="Medicaid plan">{readOnly(t.medicaid_plan)}</Row>
                    </>
                  )}
                  <Row label="Emergency contact">{input("emergency_contact_name", canEditAll)}</Row>
                  <Row label="Emergency phone">{input("emergency_contact_phone", canEditAll, { type: "tel" })}</Row>
                </>
              )}
              {isDelivery && (
                <>
                  <Row label="Recipient name">{readOnly((t as any).delivery_recipient_name)}</Row>
                  <Row label="Recipient phone">{readOnly((t as any).delivery_recipient_phone)}</Row>
                </>
              )}
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
                {!isDelivery && <Row label="Appointment time">{input("appointment_time", canEditAll, { type: "time" })}</Row>}
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
                    <Row label="Return date">{input("return_date", canEditAll, { type: "date" })}</Row>
                    <Row label="Return pickup">{input("return_pickup_time", canEditAll, { type: "time" })}</Row>
                    <Row label="Return dropoff">{input("return_dropoff_time", canEditAll, { type: "time" })}</Row>
                    <Row label="Return building">{readOnly(t.return_pickup_building)}</Row>
                    <Row label="Return doctor / office">{readOnly(t.return_pickup_doctor)}</Row>
                    <Row label="Return suite">{readOnly(t.return_pickup_suite)}</Row>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Notes & instructions</H>
            <div className="space-y-4">
              <Row label={isDelivery ? "Delivery instructions" : "Special instructions"} full>{textarea("special_instructions", canEditAll)}</Row>
              {!isDelivery && <Row label="Mobility notes" full>{textarea("mobility_notes", canEditAll)}</Row>}
              <Row label="Provider notes" full>{textarea("provider_notes", canEditProviderFields)}</Row>
            </div>
          </section>

          <div className="border-t border-border" />

          <section>
            <H>Trip status timeline</H>
            <ol className="space-y-3">
              {steps.map((s, idx) => {
                const isDone = s.state === "done";
                const isCurrent = s.state === "current";
                const dot = isDone
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isCurrent
                  ? "bg-amber-500 border-amber-500 text-white ring-4 ring-amber-500/20"
                  : "bg-background border-border text-muted-foreground";
                const rowBg = isCurrent
                  ? "bg-amber-50 border-amber-200"
                  : isDone
                  ? "bg-emerald-50/40 border-emerald-100"
                  : "bg-muted/30 border-border";
                return (
                  <li key={s.key} className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${rowBg}`}>
                    <span className={`shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[0.7rem] font-bold ${dot}`}>
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="text-sm font-semibold text-foreground">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(s.at ?? null)}</div>
                      </div>
                      {s.note && <div className="text-xs text-muted-foreground mt-0.5">{s.note}</div>}
                    </div>
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

          <section className="rounded-lg border-2 border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <H>Pricing &amp; billing</H>
              <span className={`text-[0.65rem] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${quoteStage.tone}`}>
                {quoteStage.label}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment status</span>
                <span className={`text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm ${paymentTone}`}>{paymentLabel}</span>
              </div>
              {portal !== "patient" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Responsible party</span>
                  {editing && canEditAll ? (
                    <select
                      value={form.payer}
                      onChange={(e) => setField("payer", e.target.value)}
                      className="border border-border rounded-sm px-2 py-1 text-sm bg-background"
                    >
                      <option value="Self Payer">Self Payer</option>
                      {t.is_medicaid_patient && <option value="Medicaid">Medicaid</option>}
                      {(detailPayersQ.data ?? []).map((p: any) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                      {form.payer &&
                        form.payer !== "Self Payer" &&
                        form.payer !== "Medicaid" &&
                        !(detailPayersQ.data ?? []).some((p: any) => p.name === form.payer) && (
                          <option value={form.payer}>{form.payer}</option>
                        )}
                    </select>
                  ) : (
                    <span className="font-semibold">{t.payer ?? "—"}</span>
                  )}
                </div>
              )}
              {(() => {
                const estCents = (t.estimated_cost_cents as number | null) ??
                  (t.cost_total != null ? Math.round(Number(t.cost_total) * 100) : null);
                const estDollars = estCents != null ? estCents / 100 : null;
                const miles = Number(t.actual_miles ?? t.estimated_miles ?? 0);
                const isShort = miles > 0 && miles < 50;
                const capDollars = estDollars != null && isShort ? estDollars * 1.5 : null;
                const enteredDollars = Number(form.cost_total) || 0;
                const overCap = capDollars != null && enteredDollars > capDollars;
                const softWarn = estDollars != null && enteredDollars > estDollars * 1.2;
                return (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-muted-foreground">Estimated price {miles > 0 ? `· ${miles.toFixed(1)} mi` : ""}</div>
                        <div className="text-[0.65rem] text-muted-foreground italic">
                          Auto-calculated. Patients &amp; facilities cannot edit this.
                        </div>
                      </div>
                      <span className="font-semibold">{fmtMoney(estDollars)}</span>
                    </div>

                    {/* Provider Quote — highlighted */}
                    <div className={`rounded-md border-2 px-3 py-3 ${needsQuote ? "border-amber-300 bg-amber-50" : "border-primary/30 bg-primary/5"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-foreground">Provider quote</span>
                        {editing && canEditProviderFields ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-foreground">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.cost_total}
                              onChange={(e) => setField("cost_total", e.target.value)}
                              placeholder="0.00"
                              className="w-28 border-2 border-primary/40 rounded-md px-2 py-1.5 text-base font-bold bg-background text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                        ) : (
                          <span className="text-lg font-extrabold text-foreground">{fmtMoney(quoteDollars)}</span>
                        )}
                      </div>
                      {canEditProviderFields && editing && capDollars != null && (
                        <p className={`mt-2 text-xs ${overCap ? "text-red-700 font-semibold" : "text-muted-foreground"}`}>
                          Trips under 50 mi are capped at {fmtMoney(capDollars)} (150% of the estimate).
                          {overCap ? " Quote exceeds the cap and will require dispatch approval." : ""}
                        </p>
                      )}
                      {canEditProviderFields && editing && !overCap && softWarn && (
                        <p className="mt-2 text-xs text-amber-800">
                          This quote is significantly above the average estimate and may not be accepted.
                        </p>
                      )}
                      {needsQuote && (
                        <p className="mt-2 text-xs text-amber-800">
                          {canEditProviderFields
                            ? "Quote required — enter your quote above and save."
                            : "Awaiting manual quote from provider."}
                        </p>
                      )}
                      {!canEditProviderFields && !needsQuote && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Only the assigned provider can submit or adjust the quote.
                        </p>
                      )}
                      {canEditProviderFields && !editing && (
                        <button
                          onClick={() => setEditing(true)}
                          className="w-full mt-3 text-sm font-semibold bg-primary text-primary-foreground px-3 py-2 rounded-md hover:bg-primary/90 shadow-sm"
                        >
                          {needsQuote ? "Create quote" : "Update quote"}
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}

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
      const { data: userData } = await supabase.auth.getUser();
      const raterId = userData.user?.id;
      if (!raterId) throw new Error("Not signed in");
      const payload: any = {
        provider_id: providerId,
        trip_id: trip.id,
        rater_id: raterId,
        overall: stars,
        comment: comment || null,
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
                    className={n <= stars ? "text-amber-500" : "text-muted-foreground"}>★</button>
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

/* -------- Account Security (change password + sign-out-everywhere) -------- */
function AccountSecurityPanel() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [busySignOut, setBusySignOut] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters.");
    if (pw !== pw2) return toast.error("Passwords do not match.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated.");
      setPw(""); setPw2("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update password.");
    } finally { setBusy(false); }
  }

  async function signOutEverywhere() {
    setBusySignOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Signed out on all devices.");
      window.location.href = "/auth";
    } catch (e: any) {
      toast.error(e?.message ?? "Could not sign out everywhere.");
      setBusySignOut(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={changePassword} className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">Change password</h3>
          <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold block">New password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8}
            className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-background" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold block">Confirm new password</label>
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8}
            className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-background" />
        </div>
        <button type="submit" disabled={busy} className="portal-btn-primary px-5 py-2">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>

      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">Sign out everywhere</h3>
          <p className="text-sm text-muted-foreground">
            Ends every active session on every device. You'll need to sign in again on this device too.
          </p>
        </div>
        <button onClick={signOutEverywhere} disabled={busySignOut}
          className="portal-btn-secondary px-5 py-2">
          {busySignOut ? "Signing out…" : "Sign out on all devices"}
        </button>
      </div>
    </div>
  );
}

/* -------- Account (tabbed) -------- */
type AccountTab = "profile" | "business" | "pricing" | "compliance" | "rules" | "integrations" | "payouts" | "membership" | "security";

function AccountPanel({ profile, portal, userId }: { profile: Profile; portal: PortalKind; userId: string }) {
  const [subTab, setSubTab] = useState<AccountTab>("profile");

  const isProvider = portal === "provider";
  const isFacility = portal === "facility";
  const isPatient = portal === "patient";
  const profileTabLabel =
    isProvider ? "Business Information"
    : isFacility ? "Facility Information"
    : "Your Information";
  const tabs: Array<[AccountTab, string]> = [
    ["profile", profileTabLabel],
    ...(isProvider ? ([
      ["pricing", "Pricing"],
      ["compliance", "Compliance Certificates"],
      ["rules", "Rules"],
      ["integrations", "Integrations"],
      ["payouts", "Payouts"],
    ] as Array<[AccountTab, string]>) : []),
    ...(isProvider ? ([["membership", "Membership"]] as Array<[AccountTab, string]>) : []),
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
        <div className="space-y-6">
          <BusinessInfoCard profile={profile} userId={userId} portal={portal} />
          {isPatient && (
            <PatientRelationshipCard profile={profile} userId={userId} />
          )}
          {isProvider && (
            <>
              <WeeklyWorkHoursCard />
              <PricingPreferenceCard />
              <ReferralFeeCard profile={profile} userId={userId} />
              <div className="bg-card border border-border rounded-sm p-6">
                <NetworkPanel userId={userId} />
              </div>
            </>
          )}
        </div>
      )}


      {subTab === "pricing" && isProvider && <PricingPanel />}
      {subTab === "compliance" && isProvider && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">Compliance Certificates</h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Business License, insurance, background checks, and other credentials with expiration tracking.
              Medicaid is intentionally not listed here — providers only need to enter a Medicaid Provider Number
              under the Medicaid section, no certificate upload is required.
            </p>
          </div>
          <ProviderCredentialsPanel />
        </div>
      )}
      {subTab === "rules" && isProvider && <RulesPanel />}
      {subTab === "integrations" && isProvider && <IntegrationsPanel />}
      {subTab === "payouts" && isProvider && (
        <div className="space-y-8">
          <ProviderBalancePanel />
          <PayoutsPanel userId={userId} />
        </div>
      )}

      {subTab === "membership" && isProvider && (
        <MembershipsTab profile={profile} />
      )}

      {subTab === "security" && (
        <AccountSecurityPanel />
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
                  step={300}
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
                  step={300}
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

function NotificationBellButton({ onOpen }: { onOpen: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotifications);
  const q = useQuery({
    queryKey: ["notifications-bell-unread"],
    queryFn: () => listFn({ data: { filter: "unread", limit: 1, offset: 0 } }),
    refetchInterval: 60_000,
  });
  useEffect(() => {
    let uid: string | null = null;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data }) => {
      uid = data.user?.id ?? null;
      if (!uid) return;
      ch = supabase
        .channel(`notif-bell-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["notifications-bell-unread"] }),
        )
        .subscribe();
    });
    return () => {
      if (ch) void supabase.removeChannel(ch);
    };
  }, [qc]);
  const count = q.data?.total ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
    >
      <BellIcon className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}






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
        <div className="flex items-center justify-between mb-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="size-7 bg-[oklch(0.872_0.078_65.2)] grid place-items-center font-display font-bold text-[oklch(0.18_0.05_257)] text-sm">F</span>
            <span className="font-display font-bold text-base tracking-tight uppercase">My Florida NEMT</span>
          </Link>
          <NotificationBellButton onOpen={() => onTab("notifications" as Tab)} />

        </div>
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
            <div className="text-[10px] uppercase tracking-wider text-white/80 opacity-0 group-hover:opacity-100 mt-0.5">Click to edit</div>
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
                  if (!tk || n <= 0) return null;
                  const sev = severityFor(tk);
                  const color =
                    sev === "green" ? "bg-emerald-600"
                    : sev === "yellow" ? "bg-amber-500"
                    : "bg-red-600";
                  return (
                    <span
                      aria-label={`${n} new`}
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white animate-pulse ${color}`}
                    >
                      {n > 99 ? "99+" : n}
                    </span>
                  );
                })()}
              </span>

            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-xs space-y-2">
        <div className="text-white/85 truncate font-mono text-[11px]" title={userEmail ?? ""}>{userEmail}</div>
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

const CANCEL_REASON_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "cost", label: "Too expensive" },
  { code: "not_enough_trips", label: "Not receiving enough trips" },
  { code: "no_longer_needed", label: "No longer need the service" },
  { code: "technical_issues", label: "Technical issues" },
  { code: "switching_services", label: "Switching to another service" },
  { code: "other", label: "Other" },
];

function MembershipsTab({ profile }: { profile: Profile }) {
  const status = profile.membership_status ?? "inactive";
  const tier = (profile as any).membership_tier ?? "none";
  const isPaid = status === "active" && tier === "paid";
  const periodEnd = (profile as any).current_period_end as string | null | undefined;
  const [showCancel, setShowCancel] = useState(false);

  return (
    <div className="w-full space-y-6">
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
          {periodEnd && (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Current period ends</div>
              <div className="font-bold">{new Date(periodEnd).toLocaleDateString()}</div>
            </div>
          )}
        </div>
        {isPaid && (
          <>
            <p className="text-sm text-muted-foreground pt-5 mt-5 border-t border-border">
              You have full access to trip dispatch, CSV upload, and API integrations.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="text-sm font-bold text-destructive underline underline-offset-4 hover:no-underline"
              >
                Cancel membership
              </button>
            </div>
          </>
        )}
      </div>

      {!isPaid && (
        <div className="bg-card border border-border rounded-sm p-6">
          <h3 className="text-lg font-extrabold tracking-tight mb-1">Choose your plan</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Upgrade to send trips, bulk upload, and use API integrations. Cancel anytime.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              to="/membership"
              className="block border-2 border-border rounded-sm p-5 hover:border-accent transition-colors"
            >
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly</div>
              <div className="text-3xl font-extrabold text-primary mt-1">$10<span className="text-base font-normal text-muted-foreground">/mo</span></div>
              <div className="text-xs text-muted-foreground mt-2">Billed every month. Cancel anytime.</div>
            </Link>
            <Link
              to="/membership"
              className="block border-2 border-accent bg-accent/5 rounded-sm p-5 relative"
            >
              <div className="absolute -top-2 right-3 bg-accent text-white text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-sm">Save $20</div>
              <div className="text-xs font-bold uppercase tracking-widest text-accent">Yearly</div>
              <div className="text-3xl font-extrabold text-primary mt-1">$100<span className="text-base font-normal text-muted-foreground">/yr</span></div>
              <div className="text-xs text-muted-foreground mt-2">Best value. Two months free.</div>
            </Link>
          </div>
          <Link
            to="/membership"
            className="inline-block mt-5 text-sm font-bold text-white bg-accent px-5 py-2.5 rounded-sm hover:bg-accent/90 shadow-sm"
          >
            Continue to checkout →
          </Link>
        </div>
      )}

      {showCancel && (
        <CancelMembershipDialog
          periodEnd={periodEnd ?? null}
          onClose={() => setShowCancel(false)}
        />
      )}
    </div>
  );
}

function CancelMembershipDialog({
  periodEnd,
  onClose,
}: {
  periodEnd: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelMyMembership);
  const [step, setStep] = useState<"reason" | "confirm" | "done">("reason");
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [effectiveAt, setEffectiveAt] = useState<string | null>(periodEnd);

  const endLabel = effectiveAt
    ? new Date(effectiveAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "the end of your current billing period";

  async function submit() {
    if (!reason) return;
    setBusy(true);
    try {
      const res = await cancelFn({
        data: {
          environment: getStripeEnvironment(),
          reason_code: reason,
          comment: comment.trim() || undefined,
        },
      });
      if ("error" in res) throw new Error(res.error);
      setEffectiveAt(res.effective_at);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["member-profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Could not cancel membership");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card w-full sm:max-w-lg rounded-t-lg sm:rounded-sm border border-border p-6 max-h-[90vh] overflow-y-auto">
        {step === "reason" && (
          <>
            <h3 className="text-lg font-extrabold tracking-tight">Cancel your membership</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We'd love to know why you're leaving. Your feedback helps us improve.
            </p>
            <fieldset className="mt-5 space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Reason for canceling *
              </legend>
              {CANCEL_REASON_OPTIONS.map((opt) => (
                <label
                  key={opt.code}
                  className={`flex items-start gap-3 border rounded-sm p-3 cursor-pointer transition-colors ${
                    reason === opt.code ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={opt.code}
                    checked={reason === opt.code}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              ))}
            </fieldset>
            <label className="block mt-4">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                Additional comments (optional)
              </span>
              <textarea
                className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-background min-h-[80px]"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                placeholder="Tell us more about your experience…"
                maxLength={1000}
              />
              <div className="text-[11px] text-muted-foreground mt-1">{comment.length}/1000</div>
            </label>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-bold px-4 py-2.5 rounded-sm border border-border hover:bg-muted"
              >
                Keep membership
              </button>
              <button
                type="button"
                disabled={!reason}
                onClick={() => setStep("confirm")}
                className="text-sm font-bold px-4 py-2.5 rounded-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <h3 className="text-lg font-extrabold tracking-tight">Confirm cancellation</h3>
            <div className="mt-4 border border-border rounded-sm p-4 bg-muted/40 text-sm space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">You'll lose access to</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Receiving referrals from other providers and the MyFloridaNemt network</li>
                  <li>Medicaid-funded trip assignments</li>
                  <li>Bulk CSV upload and API integrations</li>
                  <li>Provider network contacts</li>
                </ul>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">You'll keep</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Full access until <span className="font-bold">{endLabel}</span></li>
                  <li>Your account, drivers, vehicles, and trip history</li>
                  <li>The ability to resubscribe at any time</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              You will not be billed again. Your membership will remain active until {endLabel}.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setStep("reason")}
                className="text-sm font-bold px-4 py-2.5 rounded-sm border border-border hover:bg-muted"
                disabled={busy}
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="text-sm font-bold px-4 py-2.5 rounded-sm bg-destructive text-white disabled:opacity-60 hover:bg-destructive/90"
              >
                {busy ? "Canceling…" : "Yes, cancel membership"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <h3 className="text-lg font-extrabold tracking-tight">Membership canceled</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your membership will end on <span className="font-bold text-foreground">{endLabel}</span>. You'll continue
              to have full access until then. Thanks for the feedback — we hope to see you again.
            </p>
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-bold px-4 py-2.5 rounded-sm bg-primary text-white hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ───────────────────────── Business Info (editable, single source of truth for all portals) ─────────────────────────

function BusinessInfoCard({ profile, userId, portal }: { profile: Profile; userId: string; portal: PortalKind }) {
  const qc = useQueryClient();
  const p = profile as any;
  const isProvider = portal === "provider";
  const isFacility = portal === "facility";
  const isPatient = portal === "patient";

  const [form, setForm] = useState({
    company_name: p.company_name ?? "",
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    phone: p.phone ?? "",
    dispatch_email: p.dispatch_email ?? "",
    business_address: p.business_address ?? "",
    city: p.city ?? "",
    region: p.region ?? "FL",
    postal_code: p.postal_code ?? "",
    preferred_zip_codes: (Array.isArray(p.preferred_zip_codes) ? p.preferred_zip_codes : []).join(", "),
  });
  const [busy, setBusy] = useState(false);

  const nameLabel = isFacility ? "Facility name *" : isProvider ? "Company name *" : "Full name *";
  const emailLabel = isProvider ? "Dispatch email *" : "Business email *";
  const title = isFacility ? "Facility Information" : isProvider ? "Business Information" : "Your Information";
  const subtitle = isPatient
    ? "Providers you're connected with can use this to contact you about your rides."
    : "Single source of truth for your business. Providers you're connected with can use this to reach you.";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nameVal = isPatient
      ? `${form.first_name.trim()} ${form.last_name.trim()}`.trim()
      : form.company_name.trim();
    if (!nameVal) return toast.error(isPatient ? "Name is required" : isFacility ? "Facility name is required" : "Company name is required");
    if (!form.phone.trim()) return toast.error("Phone is required");
    if (!form.dispatch_email.trim()) return toast.error("Email is required");
    setBusy(true);
    try {
      const zips = form.preferred_zip_codes
        .split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean);
      let dispatch_zone_id: string | null = null;
      if (form.postal_code.trim()) {
        const { data: zoneMatch } = await supabase
          .from("dispatch_zone_zips").select("zone_id").eq("zip", form.postal_code.trim()).maybeSingle();
        dispatch_zone_id = (zoneMatch?.zone_id as string | null) ?? null;
      }
      const patch: Record<string, any> = {
        phone: form.phone.trim(),
        dispatch_email: form.dispatch_email.trim(),
        business_address: form.business_address.trim() || null,
        city: form.city.trim() || null,
        region: (form.region.trim() || "FL"),
        postal_code: form.postal_code.trim() || null,
        dispatch_zone_id,
      };
      if (isPatient) {
        patch.first_name = form.first_name.trim() || null;
        patch.last_name = form.last_name.trim() || null;
        patch.company_name = nameVal;
      } else {
        patch.company_name = nameVal;
      }
      if (!isPatient) patch.preferred_zip_codes = zips;

      const { error } = await supabase.from("member_profiles").update(patch as any).eq("user_id", userId);
      if (error) throw error;
      toast.success(isFacility ? "Facility information saved" : isPatient ? "Contact information saved" : "Business information saved");
      qc.invalidateQueries({ queryKey: ["member-profile"] });
      qc.invalidateQueries({ queryKey: ["my-provider-onboarding"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally { setBusy(false); }
  }

  const inputCls = "w-full border border-border rounded-sm px-3 py-2 text-sm bg-background";
  const labelCls = "text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1";

  return (
    <form onSubmit={save} className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {isPatient ? (
          <>
            <label><span className={labelCls}>First name *</span>
              <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </label>
            <label><span className={labelCls}>Last name *</span>
              <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </label>
          </>
        ) : (
          <label className="sm:col-span-2"><span className={labelCls}>{nameLabel}</span>
            <input className={inputCls} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
          </label>
        )}
        <label><span className={labelCls}>Phone *</span>
          <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </label>
        <label><span className={labelCls}>{emailLabel}</span>
          <input type="email" className={inputCls} value={form.dispatch_email} onChange={(e) => setForm({ ...form, dispatch_email: e.target.value })} required />
        </label>
        <label className="sm:col-span-2"><span className={labelCls}>{isPatient ? "Address" : "Business address"}</span>
          <input className={inputCls} value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} placeholder="123 Main St, Suite 200" />
        </label>
        <label><span className={labelCls}>City</span>
          <input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label><span className={labelCls}>State</span>
          <input className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="FL" />
        </label>
        <label><span className={labelCls}>ZIP code</span>
          <input className={inputCls} value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="e.g. 33101" />
        </label>
        {!isPatient && (
          <label><span className={labelCls}>Service ZIP codes (comma or space separated)</span>
            <input className={inputCls} value={form.preferred_zip_codes} onChange={(e) => setForm({ ...form, preferred_zip_codes: e.target.value })} placeholder="33101, 33102, 33103" />
          </label>
        )}
      </div>
      <button type="submit" disabled={busy} className="portal-btn-primary px-5 py-2">
        {busy ? "Saving…" : isFacility ? "Save facility information" : isPatient ? "Save contact information" : "Save business information"}
      </button>
    </form>
  );
}

function PricingPreferenceCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-pricing-mode"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { pricing_mode: "recommended" as const };
      const { data } = await supabase
        .from("provider_pricing")
        .select("pricing_mode")
        .eq("owner_id", uid)
        .maybeSingle();
      const mode = (data as any)?.pricing_mode;
      return { pricing_mode: (mode === "custom" ? "custom" : "recommended") as "custom" | "recommended" };
    },
    staleTime: 30_000,
  });
  const mode = q.data?.pricing_mode ?? "recommended";
  const [busy, setBusy] = useState(false);

  async function setMode(next: "recommended" | "custom") {
    if (next === mode || busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("provider_pricing")
        .upsert({ owner_id: uid, pricing_mode: next } as any, { onConflict: "owner_id" });
      if (error) throw error;
      toast.success(
        next === "custom"
          ? "Quotes will now use your custom pricing"
          : "Quotes will now use My Florida NEMT recommended pricing",
      );
      qc.invalidateQueries({ queryKey: ["my-pricing-mode"] });
      qc.invalidateQueries({ queryKey: ["price-estimate"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update pricing preference");
    } finally {
      setBusy(false);
    }
  }

  const Option = ({
    value,
    title,
    desc,
  }: { value: "recommended" | "custom"; title: string; desc: string }) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => setMode(value)}
        disabled={busy}
        className={`text-left border rounded-sm p-4 transition-colors ${
          active
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border bg-background hover:border-primary/40"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-block size-3 rounded-full border ${
              active ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}
          />
          <span className="font-bold text-sm">{title}</span>
          {active && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
      </button>
    );
  };

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">Quote Pricing Source</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Choose which pricing your quotes use throughout the platform. You can switch at any time.
          A value of <strong>$0.00</strong> in your custom pricing is treated as intentional and will
          be shown as $0.00 on the quote — it won't fall back to the recommended rate.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Option
          value="recommended"
          title="Use My Florida NEMT Recommended Pricing"
          desc="Quotes are calculated from the platform's recommended rates for the trip's service area."
        />
        <Option
          value="custom"
          title="Use My Custom Pricing"
          desc="Quotes are calculated from the rates you publish in the Pricing tab (pickup, mileage, wait, add-ons, delivery)."
        />
      </div>
      {mode === "custom" && (
        <div className="text-[11px] text-muted-foreground border-l-2 border-primary pl-3">
          Tip: review your rates in <strong>Settings → Pricing</strong> so every line on your quote
          reflects what you want to charge.
        </div>
      )}
    </div>
  );
}

function ReferralFeeCard({ profile, userId }: { profile: Profile; userId: string }) {
  const qc = useQueryClient();
  const p = profile as any;
  const [feeType, setFeeType] = useState<"flat" | "percent" | "">(
    p.referral_fee_type === "flat" || p.referral_fee_type === "percent" ? p.referral_fee_type : ""
  );
  const [amount, setAmount] = useState<string>(
    p.referral_fee_amount != null ? String(p.referral_fee_amount) : ""
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const hasFee = feeType && amount.trim() !== "";
      const numeric = hasFee ? Number(amount) : null;
      if (hasFee && (!Number.isFinite(numeric!) || numeric! < 0)) {
        toast.error("Enter a valid non-negative amount");
        return;
      }
      if (hasFee && feeType === "percent" && numeric! > 100) {
        toast.error("Percentage cannot exceed 100");
        return;
      }
      const { error } = await supabase.from("member_profiles").update({
        referral_fee_type: hasFee ? feeType : null,
        referral_fee_amount: hasFee ? numeric : null,
      } as any).eq("user_id", userId);
      if (error) throw error;
      toast.success("Referral fee saved");
      qc.invalidateQueries({ queryKey: ["member-profile"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setBusy(false); }
  }

  async function clearFee() {
    setFeeType("");
    setAmount("");
    setBusy(true);
    try {
      const { error } = await supabase.from("member_profiles").update({
        referral_fee_type: null, referral_fee_amount: null,
      } as any).eq("user_id", userId);
      if (error) throw error;
      toast.success("Referral fee cleared");
      qc.invalidateQueries({ queryKey: ["member-profile"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to clear");
    } finally { setBusy(false); }
  }

  const inputCls = "w-full h-10 px-3 border border-border bg-background text-sm rounded-sm";
  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">Referral Fee Settings</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Optional. Set a default referral fee you'd like to receive when you send a trip through
          My Florida NEMT or refer it to another connected transportation provider. Leave blank if
          you don't want to charge a referral fee. You can update this at any time.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Fee type</label>
          <select
            className={inputCls}
            value={feeType}
            onChange={(e) => setFeeType(e.target.value as "flat" | "percent" | "")}
          >
            <option value="">No referral fee</option>
            <option value="flat">Flat dollar amount ($)</option>
            <option value="percent">Percentage of trip (%)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            {feeType === "percent" ? "Percentage" : "Amount"}
          </label>
          <div className="relative">
            {feeType === "flat" && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            )}
            <input
              type="number"
              min="0"
              step={feeType === "percent" ? "0.1" : "0.01"}
              max={feeType === "percent" ? 100 : undefined}
              disabled={!feeType}
              className={`${inputCls} ${feeType === "flat" ? "pl-7" : ""} ${feeType === "percent" ? "pr-8" : ""}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={feeType === "percent" ? "e.g. 10" : feeType === "flat" ? "e.g. 25.00" : "Select a fee type first"}
            />
            {feeType === "percent" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="portal-btn-primary px-5 py-2"
        >
          {busy ? "Saving…" : "Save referral fee"}
        </button>
        {(p.referral_fee_type || p.referral_fee_amount != null) && (
          <button
            type="button"
            onClick={clearFee}
            disabled={busy}
            className="portal-btn-secondary px-5 py-2"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}



