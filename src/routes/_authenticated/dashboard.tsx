import { createFileRoute, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";
import { createTrip, createTripsBulk, listRegionalProviders, assignTrip, updateTripStatus, recordHipaaAck } from "@/lib/trips.functions";
import { downloadTripPdf, normalizeCsvHeader, type TripPdfInput } from "@/lib/trip-pdf";
import type { Database } from "@/integrations/supabase/types";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { PricingPanel } from "@/components/dashboard/PricingPanel";
import { IntegrationsPanel } from "@/components/dashboard/IntegrationsPanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { RequestsPanel, ReservationsPanel } from "@/components/dashboard/RequestsPanel";
import { RulesPanel } from "@/components/dashboard/RulesPanel";
import { NetworkPanel } from "@/components/dashboard/NetworkPanel";
import { FacilityProvidersPanel } from "@/components/dashboard/FacilityProvidersPanel";
import { demoProfile, demoTrips } from "@/lib/demo-data";

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
type Tab = "received" | "sent" | "new" | "upload" | "requests" | "reservations" | "network" | "rules" | "contacts" | "providers" | "saved_providers" | "vehicles" | "drivers" | "pricing" | "memberships" | "payouts" | "integrations" | "account";

const PORTAL_TABS: Record<PortalKind, Tab[]> = {
  patient:  ["new", "sent", "account"],
  provider: ["reservations", "received", "sent", "new", "vehicles", "contacts", "pricing", "rules", "memberships", "payouts", "integrations", "account"],
  facility: ["new", "sent", "upload", "providers", "saved_providers", "contacts", "account"],
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
  if (t === "reservations") return "Reservations & Schedule";
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

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <PortalSidebar
        portal={portal}
        profile={profile}
        userEmail={userEmail}
        allowedTabs={allowedTabs}
        currentTab={tab}
        onTab={setTab}
        counts={{ received: received.length, sent: sent.length }}
        membershipStatus={profile?.membership_status ?? "inactive"}
        onSavedName={() => qc.invalidateQueries({ queryKey: ["member-profile"] })}
      />

      <main className="flex-1 min-w-0 px-6 py-8">
        {isAdmin && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-primary/10 border border-primary/30 rounded-sm px-4 py-2 text-sm">
            <span className="font-bold text-primary">
              Admin preview · You're viewing the {portal} dashboard{isDemo ? " with demo data" : ""}.
            </span>
            <Link to="/admin" className="font-bold text-primary hover:underline">
              ← Back to admin
            </Link>
          </div>
        )}

        {isDemo && (
          <div className="mb-4 bg-amber-50 border border-amber-300 px-4 py-2 text-xs text-amber-900">
            <strong>Demo data shown.</strong> Trips, profile, and counts marked “(DEMO)” are placeholders so you can see the layout — nothing is saved. Real data appears once a user completes onboarding.
          </div>
        )}

        {!profileQ.isLoading && !profile && userId && userEmail && (
          <ProfileSetup userId={userId} userEmail={userEmail} portal={portal} onSaved={() => qc.invalidateQueries({ queryKey: ["member-profile"] })} />
        )}

        {profile && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight">{meta.label}</h1>
              <p className="text-sm text-muted-foreground mt-1">{meta.heroText}</p>
            </div>
            {portal === "provider" && !canSend && (
              <div className="mb-6 bg-orange-50 border border-orange-200 rounded-sm p-4 text-sm">
                <p className="font-bold text-orange-900">Free plan — receive referrals, manage reservations, vehicles, drivers & trip history.</p>
                <p className="text-orange-800 mt-1">
                  Upgrade to a paid membership ($5/year) to send trips, bulk upload, and use API integrations.{" "}
                  <Link to="/membership" className="underline font-bold">Upgrade now →</Link>
                </p>
              </div>
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
                      <h2 className="text-xl font-extrabold tracking-tight">Florida NEMT Submissions <span className="text-muted-foreground font-normal">({flNemt.length})</span></h2>
                      <p className="text-sm text-muted-foreground">Auto-routed referrals from Florida NEMT based on your service area.</p>
                    </div>
                    {flNemt.length === 0
                      ? <div className="bg-card border border-border rounded-sm p-6 text-sm text-muted-foreground">No Florida NEMT referrals right now.</div>
                      : <TripList trips={flNemt} userId={userId!} role="recipient" onChanged={onChanged} />}
                  </section>
                  <section>
                    <div className="mb-3">
                      <h2 className="text-xl font-extrabold tracking-tight">Subscribed Provider Submissions <span className="text-muted-foreground font-normal">({subProv.length})</span></h2>
                      <p className="text-sm text-muted-foreground">Trips sent directly to you by providers and facilities in your network.</p>
                    </div>
                    {subProv.length === 0
                      ? <div className="bg-card border border-border rounded-sm p-6 text-sm text-muted-foreground">No partner submissions yet.</div>
                      : <TripList trips={subProv} userId={userId!} role="recipient" onChanged={onChanged} />}
                  </section>
                </div>
              );
            })()}
            {tab === "sent" && <TripList trips={sent} userId={userId!} role="sender" portal={portal} onChanged={() => qc.invalidateQueries({ queryKey: ["my-trips"] })} />}
            {tab === "new" && (canSend ? <NewTripForm onCreated={() => { qc.invalidateQueries({ queryKey: ["my-trips"] }); setTab("sent"); }} /> : <PaidOnly />)}
            {tab === "upload" && (canSend ? <CsvUpload onUploaded={() => { qc.invalidateQueries({ queryKey: ["my-trips"] }); setTab("sent"); }} /> : <PaidOnly />)}
            {tab === "reservations" && <ReservationsPanel userId={userId!} />}
            {tab === "rules" && <RulesPanel />}
            {tab === "contacts" && <ContactsPanel />}
            {tab === "providers" && <FacilityProvidersPanel initialMode="lookup" />}
            {tab === "saved_providers" && <FacilityProvidersPanel initialMode="saved" />}
            {tab === "vehicles" && <FleetPanel />}
            {tab === "pricing" && <PricingPanel />}
            {tab === "memberships" && <MembershipsTab profile={profile} />}
            {tab === "payouts" && <PayoutsPanel userId={userId!} />}
            {tab === "integrations" && (canSend ? <IntegrationsPanel /> : <PaidOnly />)}
            {tab === "account" && <AccountPanel profile={profile} portal={portal} userId={userId!} />}
          </>
        )}

      </main>
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
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
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
        <button disabled={busy} className="col-span-2 mt-2 bg-primary text-primary-foreground font-bold py-3 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, v, on, required, type = "text", placeholder, className = "" }: {
  label: string; v: string; on: (v: string) => void; required?: boolean; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-bold text-foreground">{label}{required && " *"}</span>
      <input
        type={type} value={v} onChange={(e) => on(e.target.value)} required={required} placeholder={placeholder}
        className="border border-border rounded-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
      <Link to="/membership" className="inline-block bg-primary text-primary-foreground font-bold px-6 py-3 rounded-sm hover:bg-primary/90">
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
      <Link to="/membership" className="inline-block bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-sm hover:bg-primary/90">
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
    pickup_address: "", pickup_city: "", pickup_zip: "", pickup_date: "", pickup_time: "",
    dropoff_address: "", dropoff_city: "", dropoff_zip: "",
    transport_type: "ambulatory", round_trip: false,
    service_level: "curb_to_curb",
    needs_wheelchair: false, has_passenger: false, needs_assistance_to_vehicle: false,
    needs_surgery_signin: false, needs_surgery_signout: false,
    mobility_notes: "", special_instructions: "", payer: "", trip_number: "",
  });
  const [hipaaOk, setHipaaOk] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      if (!hipaaOk) throw new Error("Please confirm HIPAA acknowledgment.");
      const ack = await recordHipaaAck({ data: { context: "send_trip" } });
      const payload = { ...form };
      // Don't send empty date string (zod regex would reject)
      if (!payload.patient_date_of_birth) delete payload.patient_date_of_birth;
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
      <Field label="Pickup city" v={form.pickup_city} on={(v) => setForm({ ...form, pickup_city: v })} required />
      <Field label="Pickup ZIP" v={form.pickup_zip} on={(v) => setForm({ ...form, pickup_zip: v })} />
      <Field label="Pickup date" v={form.pickup_date} on={(v) => setForm({ ...form, pickup_date: v })} required type="date" />
      <Field label="Pickup time" v={form.pickup_time} on={(v) => setForm({ ...form, pickup_time: v })} required type="time" />
      <Field label="Dropoff address" v={form.dropoff_address} on={(v) => setForm({ ...form, dropoff_address: v })} required className="col-span-2" />
      <Field label="Dropoff city" v={form.dropoff_city} on={(v) => setForm({ ...form, dropoff_city: v })} required />
      <Field label="Dropoff ZIP" v={form.dropoff_zip} on={(v) => setForm({ ...form, dropoff_zip: v })} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Transport type</span>
        <select value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })}
                className="border border-border rounded-sm px-3 py-2 bg-background">
          <option value="ambulatory">Ambulatory</option>
          <option value="wheelchair">Wheelchair</option>
          <option value="stretcher">Stretcher</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Service level</span>
        <select value={form.service_level} onChange={(e) => setForm({ ...form, service_level: e.target.value })}
                className="border border-border rounded-sm px-3 py-2 bg-background">
          <option value="curb_to_curb">Curb to curb</option>
          <option value="door_to_door">Door to door</option>
          <option value="bed_to_bed">Bed to bed</option>
          <option value="driveway_pickup">Pickup in driveway</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-bold mt-2">
        <input type="checkbox" checked={form.round_trip} onChange={(e) => setForm({ ...form, round_trip: e.target.checked })} />
        Round trip
      </label>
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
        <span className="font-bold">Mobility notes</span>
        <textarea value={form.mobility_notes} onChange={(e) => setForm({ ...form, mobility_notes: e.target.value })}
                  className="border border-border rounded-sm px-3 py-2 bg-background" rows={2} />
      </label>
      <label className="flex flex-col gap-1 text-sm col-span-2">
        <span className="font-bold">Special instructions</span>
        <textarea value={form.special_instructions} onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
                  className="border border-border rounded-sm px-3 py-2 bg-background" rows={2} />
      </label>
      <label className="col-span-2 flex items-start gap-2 text-sm bg-muted/40 border border-border rounded-sm p-3">
        <input type="checkbox" checked={hipaaOk} onChange={(e) => setHipaaOk(e.target.checked)} className="mt-0.5" required />
        <span><strong>HIPAA acknowledgment.</strong> I confirm this transmission complies with HIPAA. Florida NEMT does not access PHI included in trip details — it is visible only to me and the receiving provider.</span>
      </label>
      <button disabled={m.isPending || !hipaaOk} className="col-span-2 bg-primary text-primary-foreground font-bold py-3 rounded-sm hover:bg-primary/90 disabled:opacity-50">
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
            className="bg-primary text-primary-foreground font-bold px-6 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50"
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
  const qc = useQueryClient();
  const showSavedBadge = portal === "facility" && role === "sender";
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
              <tr key={t.id} className="border-t border-border align-top">
                <td className="px-3 py-2 whitespace-nowrap">{t.pickup_date}<br /><span className="text-xs text-muted-foreground">{t.pickup_time}</span></td>
                <td className="px-3 py-2">{t.patient_first_name} {t.patient_last_name}</td>
                <td className="px-3 py-2 text-xs">
                  <div>{t.pickup_city}{t.pickup_zip ? `, ${t.pickup_zip}` : ""}</div>
                  <div className="text-muted-foreground">↓ {t.dropoff_city}{t.dropoff_zip ? `, ${t.dropoff_zip}` : ""}</div>
                </td>
                <td className="px-3 py-2"><TripStatusBadge s={t.status} /></td>
                {showSavedBadge && (
                  <td className="px-3 py-2">
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
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => downloadTripPdf(t as TripPdfInput)} className="text-xs font-bold text-primary hover:underline mr-3">PDF</button>
                  {role === "sender" && t.status === "open" && (
                    <button onClick={() => setAssigning(t)} className="text-xs font-bold text-accent hover:underline mr-3">Send</button>
                  )}
                  {role === "recipient" && t.status === "assigned" && (
                    <>
                      <button onClick={async () => { await updateTripStatus({ data: { trip_id: t.id, status: "accepted" } }); toast.success("Accepted"); onChanged(); }}
                              className="text-xs font-bold text-accent hover:underline mr-3">Accept</button>
                      <button onClick={async () => { await updateTripStatus({ data: { trip_id: t.id, status: "declined" } }); toast.success("Declined"); onChanged(); }}
                              className="text-xs font-bold text-red-600 hover:underline">Decline</button>
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
    </>
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
                  className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
            {busy ? "Opening…" : "Manage billing"}
          </button>
        </div>
      </div>
      {portal === "provider" && (
        <div className="bg-card border border-border rounded-sm p-6">
          <NetworkPanel userId={userId} />
        </div>
      )}
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
    <aside className="w-64 shrink-0 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <Link to="/" className="font-extrabold text-lg tracking-tighter text-primary uppercase block mb-3">
          Florida NEMT
        </Link>
        {editing ? (
          <div className="space-y-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full text-sm font-bold border border-border bg-background px-2 py-1.5 rounded-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={saveName} disabled={saving}
                      className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1 rounded-sm disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setNameDraft(displayName); }}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1">
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
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
              {portal} portal
            </div>
            <div className="text-base font-extrabold tracking-tight truncate group-hover:text-accent transition-colors">
              {displayName}
              <span className="ml-2 text-xs font-normal text-muted-foreground opacity-0 group-hover:opacity-100">edit</span>
            </div>
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
              className={`w-full text-left px-3 py-2 text-sm font-bold rounded-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {tabLabel(key, portal, counts)}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border text-xs">
        <div className="text-muted-foreground truncate mb-2" title={userEmail ?? ""}>{userEmail}</div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="font-bold text-muted-foreground hover:text-foreground"
        >Sign out</button>
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

