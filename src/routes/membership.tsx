import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useProviderOnlyGate } from "@/lib/portal-guard";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "MyFloridaNemt.com Membership — $5/year dispatch network" },
      { name: "description", content: "Join the MyFloridaNemt.com dispatch network. $5/year — send and receive trips with approved NEMT providers in your region." },
      { rel: "canonical", href: "https://floridanemt.com/membership" } as any,
    ],
  }),
  component: MembershipPage,
});

const BENEFITS = [
  "Send trips to approved providers in your Florida region",
  "Upload trip data via CSV — bulk dispatch in seconds",
  "Email PDF trip sheets directly to recipient providers",
  "Receive trip assignments from regional partners",
  "Manage all trips from a single dispatch dashboard",
  "Cancel anytime — no contracts, no setup fees",
];

function MembershipPage() {
  useProviderOnlyGate();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  return (
    <div className="bg-background">
      <section className="bg-primary/5 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-accent mb-4">Member Network</span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-4">
            $5/year. Run your dispatch.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join Florida's NEMT dispatch network. Send trips. Receive trips. Export to your fleet.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-6">What you get</h2>
          <ul className="space-y-4">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-3">
                <Check className="size-5 text-accent shrink-0 mt-0.5" />
                <span className="text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card border border-border rounded-sm p-8 shadow-sm">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setPlan("monthly")}
              className={`p-4 rounded-sm border text-left transition ${plan === "monthly" ? "border-accent bg-accent/5" : "border-border"}`}
            >
              <div className="text-2xl font-extrabold text-primary">$10</div>
              <div className="text-xs text-muted-foreground">per month</div>
            </button>
            <button
              type="button"
              onClick={() => setPlan("yearly")}
              className={`p-4 rounded-sm border text-left transition relative ${plan === "yearly" ? "border-accent bg-accent/5" : "border-border"}`}
            >
              <div className="text-2xl font-extrabold text-primary">$100</div>
              <div className="text-xs text-muted-foreground">per year · save $20</div>
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            For approved NEMT providers. Cancel anytime.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Not a member yet? You can still use MyFloridaNemt.com for reservations, scheduling, trip history, vehicles, and drivers — free.
          </p>
          <p className="text-[11px] text-muted-foreground mb-6 italic">
            Pricing is subject to change at any time.
          </p>

          {!user ? (
            <>
              <Link
                to="/auth"
                className="block w-full text-center text-sm font-bold text-white bg-accent px-6 py-3 rounded-sm hover:bg-accent/90 shadow-sm mb-3"
              >
                Sign in to subscribe
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
              className="w-full text-sm font-bold text-white bg-accent px-6 py-3 rounded-sm hover:bg-accent/90 shadow-sm"
            >
              {plan === "monthly" ? "Subscribe for $10/month" : "Subscribe for $100/year"}
            </button>

          ) : (
            <StripeEmbeddedCheckout
              priceId={plan === "monthly" ? "nemt_membership_monthly_v2" : "nemt_membership_yearly_v2"}
              userId={user.id}
              customerEmail={user.email}
            />
          )}
        </div>
      </section>
    </div>
  );
}
