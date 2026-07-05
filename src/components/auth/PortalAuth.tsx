import { useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
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
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const metaExtra = isPatient
          ? {
              patient_type: patientType,
              patient_type_other: patientType === "Other" ? patientTypeOther.trim() : null,
              patient_relationship: patientRelationship,
              patient_relationship_other:
                patientRelationship === "Other" ? patientRelationshipOther.trim() : null,
            }
          : {};
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: { portal: kind, ...metaExtra },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can now sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await router.invalidate();
        navigate({ to: dest } as any);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-scope min-h-[80vh] grid md:grid-cols-2 gap-0">
      <div className="hidden md:flex flex-col justify-between bg-card border-r border-border p-12">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-accent mb-3">
            {copy.eyebrow}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter mb-4">{copy.title}</h1>
          <p className="text-base text-muted-foreground max-w-md">{copy.blurb}</p>
        </div>
        <ul className="space-y-3 text-sm">
          {copy.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="text-accent">●</span> {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid place-items-center px-6 py-12 bg-background">
        <div className="w-full max-w-md portal-panel p-8">
          <p className="md:hidden font-mono text-xs font-bold text-accent uppercase tracking-widest mb-3">
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
            <button
              type="submit"
              disabled={busy}
              className="portal-btn-primary w-full py-3"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already registered? Sign in"}
          </button>
        </div>
      </div>
    </section>
  );
}

