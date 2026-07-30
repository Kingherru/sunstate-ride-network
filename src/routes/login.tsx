import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, HeartPulse, Headset, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setRememberPreference, getRememberPreference } from "@/lib/session-persistence";
import loginHero from "@/assets/login-hero.jpg";

type PortalOption = {
  key: "staff" | "provider" | "facility" | "patient";
  label: string;
  blurb: string;
  to: string;
  Icon: typeof Truck;
};

const PORTALS: Record<PortalOption["key"], PortalOption> = {
  staff: {
    key: "staff",
    label: "Dispatch & Staff",
    blurb: "Dispatchers, admins and zone managers",
    to: "/admin",
    Icon: ShieldCheck,
  },
  provider: {
    key: "provider",
    label: "Provider Portal",
    blurb: "Transportation companies & drivers",
    to: "/provider/dashboard",
    Icon: Truck,
  },
  facility: {
    key: "facility",
    label: "Facility Portal",
    blurb: "Hospitals, SNFs & case managers",
    to: "/facility/dashboard",
    Icon: Building2,
  },
  patient: {
    key: "patient",
    label: "Patient Portal",
    blurb: "Patients, families & caregivers",
    to: "/patient/dashboard",
    Icon: HeartPulse,
  },
};

/** Everyone who can sign in from this one page. */
const USER_TYPES = [
  { label: "Providers", blurb: "Transportation companies & drivers", Icon: Truck },
  { label: "Facilities", blurb: "Hospitals, SNFs & case managers", Icon: Building2 },
  { label: "Patients", blurb: "Patients, families & caregivers", Icon: HeartPulse },
  { label: "Dispatchers", blurb: "Zone dispatch & scheduling", Icon: Headset },
  { label: "Staff", blurb: "My Florida NEMT admin team", Icon: ShieldCheck },
] as const;

const SIGNUP_OPTIONS = [
  { to: "/patient/login", label: "Patient / caregiver", blurb: "Book and track rides for yourself or a loved one", Icon: HeartPulse },
  { to: "/provider/login", label: "Transportation provider", blurb: "NEMT companies, drivers and dispatch teams", Icon: Truck },
  { to: "/facility/login", label: "Facility", blurb: "Hospitals, SNFs, clinics and case managers", Icon: Building2 },
] as const;

const OPS_ROLES = ["admin", "app_manager", "zone_manager", "dispatcher", "staff"];

function safeNext(next: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — My Florida NEMT" },
      {
        name: "description",
        content:
          "One sign in for providers, facilities, patients, dispatchers and staff on My Florida NEMT.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string; mode?: "signup" } => ({
    ...(typeof s.next === "string" && s.next ? { next: s.next } : {}),
    ...(s.mode === "signup" ? { mode: "signup" as const } : {}),
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { next, mode } = Route.useSearch();
  const redirectTarget = safeNext(next ?? "");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [choices, setChoices] = useState<PortalOption[] | null>(null);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState<{ id: string; user_metadata?: Record<string, any> } | null>(null);

  async function resolvePortals(user: {
    id: string;
    user_metadata?: Record<string, any>;
  }): Promise<PortalOption[]> {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleList = (roles ?? []).map((r) => String(r.role));
    const options: PortalOption[] = [];
    if (roleList.some((r) => OPS_ROLES.includes(r))) options.push(PORTALS.staff);

    const metaPortal = user.user_metadata?.portal as PortalOption["key"] | undefined;
    if (metaPortal && metaPortal !== "staff" && PORTALS[metaPortal]) {
      options.push(PORTALS[metaPortal]);
    }
    if (options.length === 0) options.push(PORTALS.provider);
    return options;
  }

  async function routeAfterAuth(user: { id: string; user_metadata?: Record<string, any> }) {
    if (redirectTarget) {
      navigate({ to: redirectTarget } as any);
      return;
    }
    const options = await resolvePortals(user);
    if (options.length > 1) {
      setChoices(options);
      return;
    }
    navigate({ to: options[0].to } as any);
  }

  // Never auto-route an existing session. Show it and let the person choose
  // to continue or sign out — signing in must always be intentional.
  useEffect(() => {
    setRemember(getRememberPreference());
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setExistingUser(data.user as any);
        setExistingEmail(data.user.email ?? "your account");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOutExisting() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setExistingUser(null);
      setExistingEmail(null);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setRememberPreference(remember);
      toast.success("Welcome back.");
      await router.invalidate();
      if (data.user) await routeAfterAuth(data.user);
      else navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
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
    <section className="min-h-screen flex-1 bg-background text-foreground px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          {/* Sign in — the main event */}
          <div className="rounded-2xl bg-card border border-border shadow-sm p-6 sm:p-8">
            {existingUser && !choices ? (
              <div className="mb-6 rounded-sm border border-border bg-secondary/40 p-4">
                <p className="text-sm font-bold text-foreground">
                  You're already signed in as {existingEmail}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  We won't move you automatically — choose what you'd like to do.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void routeAfterAuth(existingUser)}
                    className="px-4 py-2 rounded-sm bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                  >
                    Continue to my portal
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void signOutExisting()}
                    className="px-4 py-2 rounded-sm border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-60"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
            {mode === "signup" && !choices ? (
              <>
                <p className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  My Florida NEMT
                </p>
                <h1 className="text-3xl font-extrabold tracking-tighter mb-2">Create your account</h1>
                <p className="text-sm text-muted-foreground mb-6 max-w-lg">
                  Pick the account type that fits you. Registration takes about a minute.
                </p>
                <div className="space-y-3 max-w-lg">
                  {SIGNUP_OPTIONS.map((o) => (
                    <Link
                      key={o.to}
                      to={o.to}
                      search={{ mode: "signup" }}
                      className="flex items-center gap-3 rounded-sm border border-border px-4 py-3 hover:border-primary transition"
                    >
                      <o.Icon className="h-5 w-5 text-primary shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{o.label}</span>
                        <span className="block text-xs text-muted-foreground">{o.blurb}</span>
                      </span>
                    </Link>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Dispatcher and staff accounts are created by My Florida NEMT.
                </p>
                <p className="text-sm mt-6">
                  Already have an account?{" "}
                  <Link to="/login" search={{}} className="font-bold text-primary underline underline-offset-4">
                    Sign in
                  </Link>
                </p>
              </>
            ) : choices ? (
              <>
                <h1 className="text-2xl font-extrabold tracking-tighter mb-1">Choose your portal</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  Your account has access to more than one portal.
                </p>
                <div className="space-y-3">
                  {choices.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => navigate({ to: c.to } as any)}
                      className="w-full flex items-center gap-3 text-left rounded-sm border border-border px-4 py-3 hover:border-primary hover:bg-accent transition"
                    >
                      <c.Icon className="h-5 w-5 text-primary shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{c.label}</span>
                        <span className="block text-xs text-muted-foreground">{c.blurb}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  My Florida NEMT
                </p>
                <h1 className="text-3xl font-extrabold tracking-tighter mb-2">
                  Welcome back — sign in
                </h1>
                <p className="text-sm text-muted-foreground mb-6 max-w-lg">
                  Providers, facilities, patients, dispatchers and staff all sign in from this one
                  page. No need to pick an account type — we send you to the right portal
                  automatically.
                </p>

                <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
                  <label className="block">
                    <span className="portal-label">Email</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
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
                      autoComplete="current-password"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="portal-input"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="size-4"
                    />
                    <span>
                      Remember me on this device
                      <span className="block text-xs text-muted-foreground">
                        Leave unchecked on shared computers — you'll be signed out when the browser
                        closes.
                      </span>
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-8 py-3 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:opacity-90 transition disabled:opacity-60"
                    >
                      {busy ? "Signing in…" : "Sign in"}
                    </button>
                    <button
                      type="button"
                      onClick={onForgot}
                      disabled={busy}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>

                {/* Who signs in here */}
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="portal-label mb-3">Who signs in here</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {USER_TYPES.map((t) => (
                      <li
                        key={t.label}
                        className="flex items-start gap-3 rounded-sm border border-border/70 px-3 py-2"
                      >
                        <t.Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold leading-tight">{t.label}</span>
                          <span className="block text-xs text-muted-foreground">{t.blurb}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">
                    New here? Create the account that fits you:
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <Link
                      to="/patient/login"
                      search={{ mode: "signup" }}
                      className="px-3 py-1.5 border border-border rounded-sm hover:border-primary"
                    >
                      Patient sign up
                    </Link>
                    <Link
                      to="/provider/login"
                      search={{ mode: "signup" }}
                      className="px-3 py-1.5 border border-border rounded-sm hover:border-primary"
                    >
                      Provider sign up
                    </Link>
                    <Link
                      to="/facility/login"
                      search={{ mode: "signup" }}
                      className="px-3 py-1.5 border border-border rounded-sm hover:border-primary"
                    >
                      Facility sign up
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Dispatchers and staff accounts are created by My Florida NEMT.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Supporting visual — deliberately secondary */}
          <aside className="hidden lg:block rounded-2xl overflow-hidden border border-border bg-[#1D3557] text-white">
            <img
              src={loginHero}
              alt="Transportation driver assisting a senior passenger into a wheelchair-accessible medical van"
              width={1024}
              height={1536}
              loading="lazy"
              className="w-full h-52 object-cover"
            />
            <div className="p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/70 mb-2">
                My Florida NEMT
              </p>
              <p className="text-lg font-extrabold tracking-tight leading-snug mb-2">
                One network. One sign in.
              </p>
              <p className="text-sm text-white/80">
                Statewide non-emergency medical transportation — scheduling, dispatch and
                compliance in a single place.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
