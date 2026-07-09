import { createFileRoute, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";
import { createTrip, createTripsBulk, listRegionalProviders, assignTrip, updateTripStatus, recordHipaaAck } from "@/lib/trips.functions";
import { ensureMyDisplayId } from "@/lib/system-ids.functions";
import { downloadTripPdf, normalizeCsvHeader, type TripPdfInput } from "@/lib/trip-pdf";
import type { Database } from "@/integrations/supabase/types";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { PricingPanel } from "@/components/dashboard/PricingPanel";
import { SavedPatientsPanel } from "@/components/dashboard/SavedPatientsPanel";
import { BusinessInfoPanel } from "@/components/dashboard/BusinessInfoPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { RulesPanel } from "@/components/dashboard/RulesPanel";
import { NetworkPanel } from "@/components/dashboard/NetworkPanel";
import { MessagesPanel } from "@/components/dashboard/MessagesPanel";
import { listThreads } from "@/lib/messages.functions";
import { ProviderCredentialsPanel } from "@/components/dashboard/ProviderCredentialsPanel";
import { FacilityProvidersPanel } from "@/components/dashboard/FacilityProvidersPanel";
import { ScheduleCalendarPanel } from "@/components/dashboard/ScheduleCalendarPanel";
import { getMyWorkHours, saveMyWorkHours } from "@/lib/schedule-board.functions";
import { useServerFn } from "@tanstack/react-start";
import { MedicaidSubmissionCenter } from "@/components/dashboard/MedicaidSubmissionCenter";
import { SavedCards } from "@/components/payments/SavedCards";
import { ChangelogChip } from "@/components/ChangelogChip";
import { demoProfile, demoTrips } from "@/lib/demo-data";
import {
  PATIENT_TYPE_OPTIONS,
  PATIENT_RELATIONSHIP_OPTIONS,
  formatPatientType,
  formatPatientRelationship,
} from "@/lib/patient-relationships";

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
      { title: "Dashboard — Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardRouter,
});

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["member_profiles"]["Row"];

export type PortalKind = "patient" | "provider" | "facility";
type Tab = "received" | "sent" | "new" | "upload" | "requests" | "reservations" | "network" | "rules" | "contacts" | "providers" | "saved_providers" | "saved_patients" | "vehicles" | "drivers" | "pricing" | "memberships" | "payouts" | "integrations" | "payments" | "business_info" | "schedule" | "medicaid" | "messages" | "account";

const PORTAL_TABS: Record<PortalKind, Tab[]> = {
  patient:  ["new", "sent", "saved_patients", "messages", "payments", "account"],
  provider: ["reservations", "schedule", "received", "sent", "new", "vehicles", "contacts", "saved_patients", "pricing", "rules", "medicaid", "memberships", "payouts", "integrations", "messages", "business_info", "account"],
  facility: ["new", "sent", "upload", "providers", "saved_providers", "contacts", "saved_patients", "messages", "payments", "account"],
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
  if (t === "saved_patients") return "Saved Patients";
  if (t === "business_info") return "Business Info";
  if (t === "medicaid") return "Medicaid Submission";
  if (t === "schedule") return "Schedule";
  if (t === "messages") return "Messages";
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
  useEffect(() => { if (!allowedTabs.includes(tab)) setTab(allowedTabs[0]); }, [allowedTabs, tab]);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

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

  const realProfile = profileQ.data as (Profile & { membership_tier?: string }) | null;
  // Admin previewing a portal: synthesize a profile + sample trips so the UI is visible without onboarding.
  const profile: (Profile & { membership_tier?: string }) | null =
    realProfile ?? (isAdmin && userId && userEmail ? (demoProfile(portal, userId, userEmail) as any) : null);
  const isDemo = isAdmin && !realProfile;
  const isActive = profile?.membership_status === "active";
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
        onTab={setTab}
        counts={{ received: received.length, sent: sent.length, unread: unreadTotal }}
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
                <div className="text-xs font-mono uppercase tracking-[0.22em] text-[oklch(0.78_0.04_220)] mb-2">Florida NEMT · {portal}</div>
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
                      <h3 className="font-display text-base font-bold tracking-tight">Florida NEMT Submissions <span className="text-muted-foreground font-normal">({flNemt.length})</span></h3>
                      <p className="text-sm text-muted-foreground">Auto-routed referrals from Florida NEMT based on your service area.</p>
                    </div>
                    {flNemt.length === 0
                      ? <div className="bg-secondary border border-border p-6 text-sm text-muted-foreground">No Florida NEMT referrals right now.</div>
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
            {tab === "saved_patients" && <SavedPatientsPanel />}
            {tab === "business_info" && <BusinessInfoPanel />}
            {tab === "medicaid" && <MedicaidSubmissionCenter userId={userId!} />}
            {tab === "messages" && <MessagesPanel userId={userId!} portal={portal} />}
            {tab === "account" && <AccountPanel profile={profile} portal={portal} userId={userId!} />}
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
        <span><strong>HIPAA acknowledgment.</strong> I confirm this transmission complies with HIPAA. Florida NEMT does not access PHI included in trip details — it is visible only to me and the receiving provider.</span>
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
            <span><strong>HIPAA acknowledgment.</strong> I confirm this bulk transmission complies with HIPAA. Florida NEMT does not access PHI included in trip details.</span>
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
                  {role === "recipient" && t.status === "assigned" && (
                    <>
                      <button onClick={async () => { await updateTripStatus({ data: { trip_id: t.id, status: "accepted" } }); toast.success("Accepted"); onChanged(); }}
                              className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-sm hover:bg-emerald-700 mr-2">✓ Accept</button>
                      <button onClick={async () => { await updateTripStatus({ data: { trip_id: t.id, status: "declined" } }); toast.success("Declined"); onChanged(); }}
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
      {viewing && <TripDetailModal trip={viewing} onClose={() => setViewing(null)} />}
      {rating && <RateProviderModal trip={rating} onClose={() => setRating(null)} onSaved={() => { setRating(null); onChanged(); }} />}
    </>
  );
}

function TripDetailModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const t: any = trip;

  const Field = ({ label, value, alwaysShow }: { label: string; value: any; alwaysShow?: boolean }) => {
    const empty = value == null || value === "" || value === false;
    if (empty && !alwaysShow) return null;
    return (
      <div className="space-y-1">
        <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/55">{label}</div>
        <div className="text-sm font-medium text-white break-words">{empty ? "—" : String(value)}</div>
      </div>
    );
  };

  const Section = ({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) => (
    <section className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
        <h4 className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/70">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</div>
    </section>
  );

  const isRound = !!t.round_trip;
  const flags: string[] = [];
  if (isRound) flags.push("Round trip");
  if (t.needs_wheelchair) flags.push("Wheelchair");
  if (t.has_passenger) flags.push("Companion");
  if (t.needs_assistance_to_vehicle) flags.push("Help to vehicle");
  if (t.needs_surgery_signin) flags.push("Surgery sign-in");
  if (t.needs_surgery_signout) flags.push("Surgery sign-out");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[oklch(0.12_0.04_250_/_0.72)] backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full max-h-[88vh] overflow-hidden rounded-3xl border border-white/15 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(160deg, oklch(0.24 0.06 250) 0%, oklch(0.18 0.05 255) 60%, oklch(0.22 0.07 258) 100%)",
        }}
      >
        {/* Accent glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[oklch(0.872_0.078_65.2_/_0.45)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[oklch(0.872_0.078_65.2_/_0.25)] blur-3xl" />

        {/* Header */}
        <header className="relative px-7 pt-6 pb-5 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TripStatusBadge s={t.status} />
              {t.trip_number && (
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/60">
                  Trip #{t.trip_number}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-white">
              {t.patient_first_name} {t.patient_last_name}
            </h3>
            <p className="text-sm text-white/65">
              {t.pickup_date}
              {t.pickup_time ? ` · Pickup ${t.pickup_time}` : ""}
              {t.appointment_time ? ` · Appt ${t.appointment_time}` : ""}
              {isRound && t.return_pickup_time ? ` · Return ${t.return_pickup_time}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-sm font-bold rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10 transition"
          >
            Close
          </button>
        </header>

        {/* Body */}
        <div className="relative px-7 py-6 space-y-5 overflow-auto max-h-[calc(88vh-9rem)]">
          <Section title="Patient" accent="bg-[oklch(0.872_0.078_65.2)]">
            <Field label="Name" value={`${t.patient_first_name ?? ""} ${t.patient_last_name ?? ""}`.trim()} />
            <Field label="Phone" value={t.patient_phone} />
            <Field label="Date of birth" value={t.patient_date_of_birth ?? t.patient_dob} />
            <Field label="Weight" value={t.patient_weight} />
            <Field label="Medicaid #" value={t.medicaid_number} />
            <Field label="Medicaid plan" value={t.medicaid_plan} />
            <Field label="Payer" value={t.payer} />
            <Field label="Emergency contact" value={[t.emergency_contact_name, t.emergency_contact_phone].filter(Boolean).join(" · ")} />
          </Section>

          <Section title="Route & Schedule" accent="bg-[oklch(0.872_0.078_65.2)]">
            <div className="col-span-2">
              <Field
                label="Pickup"
                value={`${t.pickup_address ?? ""}${t.pickup_address_details ? `, ${t.pickup_address_details}` : ""}, ${t.pickup_city ?? ""} ${t.pickup_zip ?? ""}`.trim()}
              />
            </div>
            <div className="col-span-2">
              <Field
                label="Dropoff"
                value={`${t.dropoff_address ?? ""}, ${t.dropoff_city ?? ""} ${t.dropoff_zip ?? ""}`.trim()}
              />
            </div>
            <Field label="Pickup date" value={t.pickup_date} alwaysShow />
            <Field label="Pickup time" value={t.pickup_time} alwaysShow />
            <Field label="Appointment time" value={t.appointment_time} alwaysShow />
            {isRound && (
              <>
                <Field label="Return pickup time" value={t.return_pickup_time} alwaysShow />
                <Field label="Return dropoff time" value={t.return_dropoff_time} alwaysShow />
              </>
            )}
            <Field label="Distance (mi)" value={t.estimated_miles ?? t.actual_miles} />
            <Field label="Estimated fare" value={t.estimated_fare ? `$${t.estimated_fare}` : null} />
          </Section>

          <Section title="Service & Patient Needs" accent="bg-[oklch(0.872_0.078_65.2)]">
            <Field label="Transportation type" value={t.transport_type} alwaysShow />
            <Field label="Service level" value={t.service_level ? String(t.service_level).replace(/_/g, " ") : null} alwaysShow />
            <Field label="Trip type" value={isRound ? "Round trip" : "One-way"} alwaysShow />
            <Field label="Source" value={t.source} />
            <div className="col-span-2 space-y-2">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/55">Patient needs</div>
              {flags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {flags.map((f) => (
                    <span
                      key={f}
                      className="text-[0.7rem] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[oklch(0.872_0.078_65.2_/_0.22)] text-white border border-[oklch(0.872_0.078_65.2_/_0.55)]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/70">No special needs indicated.</div>
              )}
            </div>
          </Section>

          <Section title="Notes & Instructions" accent="bg-white/40">
            <div className="col-span-2">
              <Field label="Special instructions" value={t.special_instructions} alwaysShow />
            </div>
            <div className="col-span-2">
              <Field label="Mobility notes" value={t.mobility_notes} alwaysShow />
            </div>
            {t.provider_notes && (
              <div className="col-span-2">
                <Field label="Provider notes" value={t.provider_notes} />
              </div>
            )}
          </Section>
        </div>


        {/* Footer */}
        <footer className="relative px-7 py-4 border-t border-white/10 flex justify-end gap-2 bg-black/20">
          <button
            onClick={onClose}
            className="text-sm font-bold text-white/80 hover:text-white px-4 py-2 rounded-xl hover:bg-white/5 transition"
          >
            Close
          </button>
          <button
            onClick={() => downloadTripPdf(trip as TripPdfInput)}
            className="text-sm font-bold text-[oklch(0.328_0.068_257.3)] px-5 py-2 rounded-xl bg-[oklch(0.872_0.078_65.2)] hover:brightness-105 transition shadow-[0_8px_24px_-8px_oklch(0.872_0.078_65.2_/_0.7)]"
          >
            Download PDF
          </button>
        </footer>
      </div>
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

/* -------- Account -------- */
function AccountPanel({ profile, portal, userId }: { profile: Profile; portal: PortalKind; userId: string }) {
  const [busy, setBusy] = useState(false);
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
  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-card border border-border rounded-sm p-6 space-y-3">
        <h2 className="text-xl font-extrabold tracking-tight">Account</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Name</span><div className="font-bold">{profile.first_name} {profile.last_name}</div></div>
          <div><span className="text-muted-foreground">Company</span><div className="font-bold">{profile.company_name}</div></div>
          <div><span className="text-muted-foreground">City</span><div className="font-bold">{profile.city}</div></div>
          <div><span className="text-muted-foreground">Region</span><div className="font-bold">{profile.region ?? "—"}</div></div>
          <div><span className="text-muted-foreground">Phone</span><div className="font-bold">{profile.phone}</div></div>
          <div><span className="text-muted-foreground">Dispatch email</span><div className="font-bold">{profile.dispatch_email}</div></div>
        </div>
        <div className="pt-4 border-t border-border">
          <button onClick={openPortal} disabled={busy}
                  className="portal-btn-primary px-5 py-2">
            {busy ? "Opening…" : "Manage billing"}
          </button>
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
  counts: { received: number; sent: number };
  membershipStatus: string;
  onSavedName: () => void;
}) {
  const { portal, profile, userEmail, allowedTabs, currentTab, onTab, counts, membershipStatus, onSavedName } = props;

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
          <span className="font-display font-bold text-base tracking-tight uppercase">Florida NEMT</span>
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

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {allowedTabs.map((key) => {
          const active = currentTab === key;
          return (
            <button
              key={key}
              onClick={() => onTab(key)}
              className={`relative w-full text-left pl-4 pr-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-[oklch(0.872_0.078_65.2)]" />}
              {tabLabel(key, portal, counts)}
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
        <ChangelogChip />
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

