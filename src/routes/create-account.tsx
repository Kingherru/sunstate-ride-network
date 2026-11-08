import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthMessage, PasswordInput, authField, authLabel } from "@/components/auth/AuthShell";
import { btnAction } from "@/components/home/buttons";
import { cn } from "@/lib/utils";
import { safeReturnPath } from "@/lib/access.functions";
import { DsButton, DsSelect } from '@/components/ds/controls';

export const Route = createFileRoute("/create-account")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; type?: 'provider' } => ({ redirect: safeReturnPath(s.redirect) ?? undefined, type: s.type === 'provider' ? 'provider' : undefined }),
  head: () => ({
    meta: [
      { title: "Create Account — MY FLORIDA NEMT" },
      { name: "description", content: "Create a MY FLORIDA NEMT account for private pay, facility, hospital or provider use." },
      { property: "og:title", content: "Create Account — MY FLORIDA NEMT" },
      { property: "og:description", content: "Create a MY FLORIDA NEMT account for private pay, facility, hospital or provider use." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CreateAccount,
});

const TYPES = [
  { value: "provider", label: "Provider", desc: "Independent NEMT transportation businesses." },
  { value: "private_pay", label: "Patient / Personal", desc: "For yourself or another patient." },
  { value: "facility", label: "Facility / Organization", desc: "Assisted living, dialysis, clinics and similar." },
] as const;
type AccountType = (typeof TYPES)[number]["value"];

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(80),
  lastName: z.string().trim().min(1, "Enter your last name.").max(80),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  phone: z.string().trim().regex(/^[0-9+().\-\s]{7,20}$/, "Enter a valid phone number."),
  org: z.string().trim().max(160),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  confirm: z.string(),
  terms: z.literal(true, { message: "Please accept the Terms and Privacy Policy." }),
});

function CreateAccount() {
  const { redirect: returnTo, type: initialType } = Route.useSearch();
  const [type, setType] = useState<AccountType | null>(initialType ?? null);
  const [facilityType, setFacilityType] = useState('general_facility');
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", org: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const needsOrg = type !== null && type !== "private_pay";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "terms" ? e.target.checked : e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !type) return;
    const r = schema.safeParse(f);
    const errs: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) errs[String(i.path[0])] ??= i.message;
    if (f.password !== f.confirm) errs.confirm = "Passwords do not match.";
    if (needsOrg && f.org.trim().length < 2) errs.org = "Enter your organization name.";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=1&redirect=${encodeURIComponent(returnTo ?? '/onboarding')}`,
        data: { display_name: `${f.firstName.trim()} ${f.lastName.trim()}`, first_name:f.firstName.trim(), last_name:f.lastName.trim(), phone: f.phone.trim(), account_type: type === 'facility' && facilityType === 'hospital' ? 'hospital' : type, organization_type: type === 'facility' ? facilityType : type === 'provider' ? 'transportation_provider' : 'private_pay_patient', organization_name: needsOrg ? f.org.trim() : null, terms_accepted_at: new Date().toISOString() },
      },
    });
    setBusy(false);
    if (error) {
      if (/weak|pwned|leaked/i.test(error.message)) return setErrors({ password: "Please choose a stronger password that hasn't appeared in a data breach." });
      if (/rate|too many/i.test(error.message)) return setFormError("Too many attempts. Please wait a few minutes and try again.");
      return setFormError("We couldn't create your account. Please check your details and try again.");
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell title="Check Your Email">
        <div className="flex flex-col gap-5">
          <AuthMessage tone="success">We sent a verification link to the email you entered. Open it to finish creating your account, then sign in.</AuthMessage>
          <Link to="/login" className={`${btnAction} w-full`}>GO TO SIGN IN</Link>
        </div>
      </AuthShell>
    );
  }

  const field = (k: "firstName" | "lastName" | "email" | "phone" | "org", label: string, type = "text", auto?: string) => (
    <div>
      <label htmlFor={k} className={authLabel}>{label}</label>
      <input id={k} type={type} autoComplete={auto} className={authField} value={f[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${k}-err` : undefined} />
      {errors[k] && <p id={`${k}-err`} className="auth-message ds-caption mt-1.5 !text-ds-error">{errors[k]}</p>}
    </div>
  );

  return (
    <AuthShell title="Create Account" intro="Choose the account type that fits you." wide>
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <p className="ds-caption" aria-live="polite">Step {step + 1} of 2 · {step === 0 ? 'Choose account type' : 'Create your verified sign-in'}</p>
        {step === 0 && <>
        <fieldset>
          <legend className={authLabel}>Account type</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {TYPES.map((t) => (
              <label key={t.value} className={cn("ds-transition cursor-pointer rounded-ds-sm p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ds-focus", type === t.value ? "bg-ds-primary text-ds-on-primary" : "bg-ds-sky text-ds-primary hover:bg-ds-hover")}>
                <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
                <span className="ds-h4 block uppercase">{t.label}</span>
                <span className={cn("ds-caption mt-1 block", type === t.value && "!text-ds-on-primary")}>{t.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <DsButton type="button" disabled={!type} onClick={() => setStep(1)}>Continue</DsButton>
        </>}

        {type === "provider" && (
          <AuthMessage tone="info">Your basic account does not require payment or administrator approval. After email verification, continue setup for business details and private credentials; verification and Network eligibility remain separate.</AuthMessage>
        )}

        {type && step === 1 && (
          <div className="auth-message flex flex-col gap-5">
            {formError && <AuthMessage tone="error">{formError}</AuthMessage>}
            <div className="grid gap-5 sm:grid-cols-2">{field("firstName", "First name", "text", "given-name")}{field("lastName", "Last name", "text", "family-name")}</div>
            {needsOrg && field("org", type === "provider" ? "Business name" : "Organization name", "text", "organization")}
            {type === 'facility' && <div><label htmlFor="facility-type" className={authLabel}>Facility type — Required</label><DsSelect id="facility-type" value={facilityType} onChange={e => setFacilityType(e.target.value)}><option value="hospital">Hospital</option><option value="nursing_home">Nursing Home / Skilled Nursing</option><option value="group_home">Group Home</option><option value="general_facility">Assisted Living</option><option value="medical_facility">Clinic / Medical Office / Dialysis / Rehabilitation</option><option value="broker">Broker</option><option value="insurance_company">Insurance Company</option><option value="other_organization">Other</option></DsSelect></div>}
            <div className="grid gap-5 sm:grid-cols-2">
              {field("email", "Email", "email", "email")}
              {field("phone", "Phone number", "tel", "tel")}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className={authLabel}>Password</label>
                <PasswordInput id="password" autoComplete="new-password" value={f.password} onChange={set("password")} aria-invalid={errors.password ? true : undefined} />
                {errors.password ? <p className="auth-message ds-caption mt-1.5 !text-ds-error">{errors.password}</p> : <p className="ds-caption mt-1.5">At least 8 characters.</p>}
              </div>
              <div>
                <label htmlFor="confirm" className={authLabel}>Confirm password</label>
                <PasswordInput id="confirm" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} aria-invalid={errors.confirm ? true : undefined} />
                {errors.confirm && <p className="auth-message ds-caption mt-1.5 !text-ds-error">{errors.confirm}</p>}
              </div>
            </div>
            <div>
              <label className="ds-body inline-flex items-start gap-2.5">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--ds-primary)]" checked={f.terms} onChange={set("terms")} />
                <span>I acknowledge the <Link to="/policies" hash="terms" className="text-ds-link underline">Terms and Conditions</Link> and <Link to="/policies" hash="privacy" className="text-ds-link underline">Privacy</Link> sections of OUR POLICIES.</span>
              </label>
              {errors.terms && <p className="auth-message ds-caption mt-1.5 !text-ds-error">{errors.terms}</p>}
            </div>
            <DsButton type="submit" className="w-full" disabled={busy}>{busy ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}</DsButton>
            <DsButton type="button" variant="ghost" disabled={busy} onClick={() => setStep(0)}>Back</DsButton>
          </div>
        )}
        <p className="ds-body text-center text-ds-text-2">Already have an account? <Link to="/login" className="font-semibold text-ds-link underline underline-offset-4">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
