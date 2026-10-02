import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthMessage, PasswordInput, authField, authLabel } from "@/components/auth/AuthShell";
import { btnAction } from "@/components/home/buttons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/create-account")({
  head: () => ({
    meta: [
      { title: "Create Account — MY FLORIDA NEMT" },
      { name: "description", content: "Create a MY FLORIDA NEMT account for private pay, facility, hospital or provider use." },
      { property: "og:title", content: "Create Account — MY FLORIDA NEMT" },
      { property: "og:description", content: "Create a MY FLORIDA NEMT account for private pay, facility, hospital or provider use." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateAccount,
});

const TYPES = [
  { value: "private_pay", label: "Private Pay", desc: "For yourself or a family member." },
  { value: "facility", label: "Facility", desc: "Assisted living, dialysis, clinics and similar." },
  { value: "hospital", label: "Hospital", desc: "Hospital discharge and case management teams." },
  { value: "provider", label: "Provider", desc: "Independent NEMT transportation businesses." },
] as const;
type AccountType = (typeof TYPES)[number]["value"];

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  phone: z.string().trim().regex(/^[0-9+().\-\s]{7,20}$/, "Enter a valid phone number."),
  org: z.string().trim().max(160),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  confirm: z.string(),
  terms: z.literal(true, { message: "Please accept the Terms and Privacy Policy." }),
});

function CreateAccount() {
  const [type, setType] = useState<AccountType | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", org: "", password: "", confirm: "", terms: false });
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
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
        data: { display_name: f.name.trim(), phone: f.phone.trim(), account_type: type, organization_name: needsOrg ? f.org.trim() : null, terms_accepted_at: new Date().toISOString() },
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

  const field = (k: "name" | "email" | "phone" | "org", label: string, type = "text", auto?: string) => (
    <div>
      <label htmlFor={k} className={authLabel}>{label}</label>
      <input id={k} type={type} autoComplete={auto} className={authField} value={f[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${k}-err` : undefined} />
      {errors[k] && <p id={`${k}-err`} className="auth-message ds-caption mt-1.5 !text-ds-error">{errors[k]}</p>}
    </div>
  );

  return (
    <AuthShell title="Create Account" intro="Choose the account type that fits you." wide>
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <fieldset>
          <legend className={authLabel}>Account type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => (
              <label key={t.value} className={cn("ds-transition cursor-pointer rounded-ds-sm p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ds-focus", type === t.value ? "bg-ds-primary text-ds-on-primary" : "bg-ds-sky text-ds-primary hover:bg-ds-hover")}>
                <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
                <span className="ds-h4 block uppercase">{t.label}</span>
                <span className={cn("ds-caption mt-1 block", type === t.value && "!text-ds-on-primary")}>{t.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {type === "provider" && (
          <AuthMessage tone="info">This creates your provider account. Your full provider application and credentialing come later — see <Link to="/join" className="font-semibold underline">Join the Provider Network</Link>.</AuthMessage>
        )}

        {type && (
          <div className="auth-message flex flex-col gap-5">
            {formError && <AuthMessage tone="error">{formError}</AuthMessage>}
            {field("name", "Full name", "text", "name")}
            {needsOrg && field("org", type === "provider" ? "Business name" : "Organization name", "text", "organization")}
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
                <span>I agree to the <Link to="/terms" className="text-ds-link underline">Terms of Use</Link> and <Link to="/privacy" className="text-ds-link underline">Privacy Policy</Link>.</span>
              </label>
              {errors.terms && <p className="auth-message ds-caption mt-1.5 !text-ds-error">{errors.terms}</p>}
            </div>
            <button className={`${btnAction} w-full`} disabled={busy}>{busy ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}</button>
          </div>
        )}
        <p className="ds-body text-center text-ds-text-2">Already have an account? <Link to="/login" className="font-semibold text-ds-link underline underline-offset-4">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
