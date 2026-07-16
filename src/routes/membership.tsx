import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles, Shield, Zap, Users, FileSpreadsheet, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useProviderOnlyGate } from "@/lib/portal-guard";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "My Florida NEMT Membership — $10/mo or $100/yr dispatch network" },
      { name: "description", content: "Join the My Florida NEMT dispatch network. $10/mo or $100/yr (save $20) — send and receive trips with approved NEMT providers in your region." },
      { rel: "canonical", href: "https://floridanemt.com/membership" } as any,
    ],
  }),
  component: MembershipPage,
});

type PlanKey = "monthly" | "yearly";

const PLANS: Record<PlanKey, {
  label: string;
  price: string;
  cadence: string;
  priceId: string;
  amountLabel: string;
  note: string;
  badge?: string;
}> = {
  monthly: {
    label: "Monthly",
    price: "$10",
    cadence: "/month",
    priceId: "nemt_membership_monthly_v2",
    amountLabel: "$10.00 billed monthly",
    note: "Flexible month-to-month billing. Cancel anytime.",
  },
  yearly: {
    label: "Yearly",
    price: "$100",
    cadence: "/year",
    priceId: "nemt_membership_yearly_v2",
    amountLabel: "$100.00 billed once per year",
    note: "Save $20 compared to monthly. Best value.",
    badge: "Save $20",
  },
};

const BENEFIT_GROUPS = [
  {
    icon: Send,
    title: "Dispatch trips instantly",
    desc: "Send trips to approved providers across your Florida region in a couple of clicks.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk CSV upload",
    desc: "Upload full schedules and dispatch dozens of trips in seconds.",
  },
  {
    icon: Users,
    title: "Regional partner network",
    desc: "Receive trip assignments from vetted partners in your service area.",
  },
  {
    icon: Zap,
    title: "One unified dashboard",
    desc: "Manage sent, received, and in-progress trips from a single view.",
  },
  {
    icon: Shield,
    title: "Approved providers only",
    desc: "Every network member is credentialed — protecting your reputation.",
  },
  {
    icon: Sparkles,
    title: "No contracts, no setup",
    desc: "Start today. Cancel anytime. No hidden fees or long-term commitments.",
  },
];

function MembershipPage() {
  useProviderOnlyGate();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [plan, setPlan] = useState<PlanKey>("yearly");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  const selected = PLANS[plan];

  // Guarantee price/session match: if the user changes plan while checkout is
  // open, close it so the next click mints a fresh Stripe session for the new
  // priceId. EmbeddedCheckoutProvider ignores clientSecret changes after mount.
  const selectPlan = (next: PlanKey) => {
    if (next === plan) return;
    setPlan(next);
    setCheckoutOpen(false);
  };

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-accent-foreground bg-accent px-3 py-1 rounded-sm mb-6">
            Provider Network Membership
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-5">
            Grow your NEMT business with Florida's dispatch network
          </h1>
          <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            One membership. Send trips, receive trips, and connect with approved
            NEMT providers across your region — starting at $10/month.
          </p>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-3">
            What's included
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight">Everything you need to run dispatch</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFIT_GROUPS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-sm p-6 hover:border-accent transition">
              <div className="size-11 rounded-sm bg-accent/10 flex items-center justify-center mb-4">
                <Icon className="size-5 text-accent" />
              </div>
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-primary/5 py-20 px-6 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-3">
              Simple pricing
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-3">Pick the plan that fits</h2>
            <p className="text-muted-foreground">Same features. Same network. Just choose how you want to pay.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
            {(["monthly", "yearly"] as PlanKey[]).map((key) => {
              const p = PLANS[key];
              const isActive = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectPlan(key)}
                  aria-pressed={isActive}
                  className={`text-left p-8 rounded-sm border-2 transition relative bg-card ${
                    isActive
                      ? "border-accent shadow-lg"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-3 right-6 text-xs font-bold uppercase tracking-wider bg-accent text-accent-foreground px-3 py-1 rounded-sm">
                      {p.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      {p.label}
                    </span>
                    {isActive && <Check className="size-4 text-accent" />}
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-5xl font-extrabold text-primary">{p.price}</span>
                    <span className="text-muted-foreground font-medium">{p.cadence}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.note}</p>
                </button>
              );
            })}
          </div>

          {/* Selection summary + checkout */}
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-sm p-8 shadow-sm">
            <div className="flex items-center justify-between pb-5 mb-5 border-b border-border">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Selected plan
                </div>
                <div className="font-bold text-lg">
                  {selected.label} — {selected.price}{selected.cadence}
                </div>
                <div className="text-sm text-muted-foreground">{selected.amountLabel}</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-3xl font-extrabold text-primary">{selected.price}</div>
                <div className="text-xs text-muted-foreground">{selected.cadence}</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              For approved NEMT providers. Cancel anytime. Not a member yet?
              You can still use My Florida NEMT for reservations, scheduling,
              trip history, vehicles, and drivers — free.
            </p>
            <p className="text-[11px] text-muted-foreground italic mb-6">
              Pricing is subject to change at any time.
            </p>

            {!user ? (
              <>
                <Link
                  to="/auth"
                  className="block w-full text-center text-sm font-bold text-white bg-accent px-6 py-4 rounded-sm hover:bg-accent/90 shadow-sm mb-3"
                >
                  Sign in to subscribe for {selected.price}{selected.cadence}
                </Link>
                <p className="text-xs text-muted-foreground text-center">
                  New here?{" "}
                  <Link to="/auth" className="underline">Create an account</Link>
                  {" "}— it's free until you subscribe.
                </p>
              </>
            ) : !checkoutOpen ? (
              <button
                onClick={() => setCheckoutOpen(true)}
                className="w-full text-sm font-bold text-white bg-accent px-6 py-4 rounded-sm hover:bg-accent/90 shadow-sm"
              >
                Continue to checkout — {selected.amountLabel}
              </button>
            ) : (
              <div>
                <div className="mb-4 p-3 bg-primary/5 border border-border rounded-sm text-sm">
                  You're subscribing to the <strong>{selected.label}</strong> plan:{" "}
                  <strong>{selected.amountLabel}</strong>.{" "}
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(false)}
                    className="underline text-accent"
                  >
                    Change plan
                  </button>
                </div>
                <StripeEmbeddedCheckout
                  key={selected.priceId}
                  priceId={selected.priceId}
                  userId={user.id}
                  customerEmail={user.email}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
