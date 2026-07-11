import { useEffect, useState } from "react";
import { useNavigate, useRouter, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PATIENT_TYPE_OPTIONS,
  PATIENT_RELATIONSHIP_OPTIONS,
} from "@/lib/patient-relationships";

export type PortalKind = "patient" | "provider" | "facility";

const COPY: Record<PortalKind, { eyebrow: string; title: string; blurb: string; bullets: string[] }> = {
  patient: {
    eyebrow: "Patient Portal",
    title: "Patients, families & caregivers",
    blurb: "Request rides, schedule recurring trips, save insurance info, and track every appointment.",
    bullets: [
      "Request medical transportation",
      "Save patient & Medicaid info",
      "Track recurring appointments",
    ],
  },
  provider: {
    eyebrow: "Provider Portal",
    title: "NEMT providers & dispatchers",
    blurb: "Manage drivers, vehicles, Medicaid & NPI credentials, billing, and facility referrals.",
    bullets: [
      "Dispatch trips & manage drivers",
      "Bill Medicaid with CMS-ready logs",
      "Connect bank for instant payouts",
    ],
  },
  facility: {
    eyebrow: "Facility Portal",
    title: "Hospitals, SNFs & case managers",
    blurb: "Book transportation for many patients from one account, upload supporting docs, and track every trip.",
    bullets: [
      "Manage many patients in one place",
      "Schedule recurring discharges",
      "Statewide provider network",
    ],
  },
};

export function PortalAuth({ kind }: { kind: PortalKind }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [patientType, setPatientType] = useState<string>("");
  const [patientTypeOther, setPatientTypeOther] = useState("");
  const [patientRelationship, setPatientRelationship] = useState<string>("");
  const [patientRelationshipOther, setPatientRelationshipOther] = useState("");
  const [billingSameAsAccount, setBillingSameAsAccount] = useState(true);
  const [billing, setBilling] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const copy = COPY[kind];
  const isPatient = kind === "patient";
  const isSignup = mode === "signup";

  const dest = `/${kind}/dashboard` as const;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: dest } as any);
    });
  }, [navigate, dest]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPatient && isSignup) {
      if (!patientType) return toast.error("Please select who is creating this account");
      if (patientType === "Other" && !patientTypeOther.trim()) return toast.error("Please describe the patient type");
      if (!patientRelationship) return toast.error("Please select the relationship to the patient");
      if (patientRelationship === "Other" && !patientRelationshipOther.trim()) return toast.error("Please describe the relationship");
      if (!billingSameAsAccount) {
        if (!billing.firstName.trim() || !billing.lastName.trim() || !billing.email.trim() || !billing.phone.trim()) {
          return toast.error("Please complete all billing contact fields");
        }
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const billingContact = isPatient && !billingSameAsAccount
          ? {
              firstName: billing.firstName.trim(),
              lastName: billing.lastName.trim(),
              email: billing.email.trim(),
              phone: billing.phone.trim(),
            }
          : null;
        const metaExtra = isPatient
          ? {
              patient_type: patientType,
              patient_type_other: patientType === "Other" ? patientTypeOther.trim() : null,
              patient_relationship: patientRelationship,
              patient_relationship_other:
                patientRelationship === "Other" ? patientRelationshipOther.trim() : null,
              billing_contact: billingContact,
            }
          : {};
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: { portal: kind, ...metaExtra },
          },
        });
        if (error) throw error;
        // If we already have a session (email confirmation disabled), persist billing contact to profile now.
        if (billingContact && signUpData.session?.user?.id) {
          await supabase
            .from("member_profiles")
            .update({ billing_contact: billingContact })
            .eq("user_id", signUpData.session.user.id);
        }
        toast.success("Account created. You can now sign in.");
        setMode("signin");
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Sync billing_contact from user metadata to profile if not yet set (first sign-in after email confirm).
        const uid = signInData.user?.id;
        const metaBilling = (signInData.user?.user_metadata as any)?.billing_contact;
        if (uid && metaBilling) {
          const { data: prof } = await supabase
            .from("member_profiles")
            .select("billing_contact")
            .eq("user_id", uid)
            .maybeSingle();
          if (!(prof as any)?.billing_contact) {
            await supabase
              .from("member_profiles")
              .update({ billing_contact: metaBilling })
              .eq("user_id", uid);
          }
        }
        await router.invalidate();
        navigate({ to: dest } as any);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    if (!email) return toast.error("Enter your email above, then click Forgot password");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-scope min-h-screen grid md:grid-cols-2 gap-0">
      <div className="hidden md:flex flex-col justify-between bg-card border-r border-border p-12">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 mb-8"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary mb-3">
            {copy.eyebrow}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter mb-4">{copy.title}</h1>
          <p className="text-base text-muted-foreground max-w-md">{copy.blurb}</p>
        </div>
        <ul className="space-y-3 text-sm">
          {copy.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="text-primary">●</span> {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid place-items-center px-6 py-12 bg-background">
        <div className="w-full max-w-md portal-panel p-8">
          <Link
            to="/"
            className="md:hidden inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <p className="md:hidden font-mono text-xs font-bold text-primary uppercase tracking-widest mb-3">
            {copy.eyebrow}
          </p>
          <h2 className="text-2xl font-extrabold tracking-tighter mb-1">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Welcome back." : "It takes less than a minute."}
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="portal-label">Email</span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="portal-input"
              />
            </label>
            <label className="block">
              <span className="portal-label">Password</span>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="portal-input"
              />
            </label>
            {isPatient && isSignup && (
              <>
                <label className="block">
                  <span className="portal-label">Who is creating this account? *</span>
                  <select
                    required
                    value={patientType}
                    onChange={(e) => setPatientType(e.target.value)}
                    className="portal-input"
                  >
                    <option value="">Select…</option>
                    {PATIENT_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                {patientType === "Other" && (
                  <label className="block">
                    <span className="portal-label">Please specify *</span>
                    <input
                      type="text"
                      required
                      value={patientTypeOther}
                      onChange={(e) => setPatientTypeOther(e.target.value)}
                      className="portal-input"
                      placeholder="Describe who you are"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="portal-label">Relationship to the patient *</span>
                  <select
                    required
                    value={patientRelationship}
                    onChange={(e) => setPatientRelationship(e.target.value)}
                    className="portal-input"
                  >
                    <option value="">Select…</option>
                    {PATIENT_RELATIONSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                {patientRelationship === "Other" && (
                  <label className="block">
                    <span className="portal-label">Please specify *</span>
                    <input
                      type="text"
                      required
                      value={patientRelationshipOther}
                      onChange={(e) => setPatientRelationshipOther(e.target.value)}
                      className="portal-input"
                      placeholder="Describe your relationship"
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  This helps dispatchers and providers know who is scheduling and managing care.
                </p>

                <div className="pt-2 border-t border-border/60 mt-2">
                  <p className="portal-label mb-2">Billing information</p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={billingSameAsAccount}
                      onChange={(e) => setBillingSameAsAccount(e.target.checked)}
                    />
                    <span>Use same information as account holder</span>
                  </label>
                  {!billingSameAsAccount && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="block col-span-1">
                        <span className="portal-label">First name *</span>
                        <input
                          type="text" required className="portal-input"
                          value={billing.firstName}
                          onChange={(e) => setBilling((b) => ({ ...b, firstName: e.target.value }))}
                        />
                      </label>
                      <label className="block col-span-1">
                        <span className="portal-label">Last name *</span>
                        <input
                          type="text" required className="portal-input"
                          value={billing.lastName}
                          onChange={(e) => setBilling((b) => ({ ...b, lastName: e.target.value }))}
                        />
                      </label>
                      <label className="block col-span-2">
                        <span className="portal-label">Email *</span>
                        <input
                          type="email" required className="portal-input"
                          value={billing.email}
                          onChange={(e) => setBilling((b) => ({ ...b, email: e.target.value }))}
                        />
                      </label>
                      <label className="block col-span-2">
                        <span className="portal-label">Phone *</span>
                        <input
                          type="tel" required className="portal-input"
                          value={billing.phone}
                          onChange={(e) => setBilling((b) => ({ ...b, phone: e.target.value }))}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={busy}
              className="portal-btn-primary w-full py-3"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already registered? Sign in"}
            </button>
            {mode === "signin" && (
              <button
                type="button"
                onClick={onForgot}
                disabled={busy}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

