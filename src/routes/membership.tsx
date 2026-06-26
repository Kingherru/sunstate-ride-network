import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useProviderOnlyGate } from "@/lib/portal-guard";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "FloridaNEMT Membership — $5/month dispatch network" },
      { name: "description", content: "Join the FloridaNEMT dispatch network. $5/month — send and receive trips with approved NEMT providers in your region." },
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
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-accent mb-4">Member Network</span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-4">
            $5/month. Run your dispatch.
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
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-extrabold tracking-tighter text-primary">$5</span>
            <span className="text-muted-foreground">/ month</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            For approved NEMT providers. Cancel anytime.
          </p>

          {!user ? (
            <>
              <Link
                to="/auth"
                className="block w-full text-center text-sm font-bold text-primary-foreground bg-primary px-6 py-3 rounded-sm hover:bg-primary/90 mb-3"
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
              Subscribe for $5/month
            </button>

          ) : (
            <StripeEmbeddedCheckout
              priceId="nemt_membership_monthly"
              userId={user.id}
              customerEmail={user.email}
            />
          )}
        </div>
      </section>
    </div>
  );
}
