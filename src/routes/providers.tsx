import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  submitProviderApplication,
  providerApplicationSchema,
  type ProviderApplicationInput,
} from "@/lib/forms.functions";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "For Providers — Join FloridaNEMT" },
      {
        name: "description",
        content:
          "Register your NEMT company with FloridaNEMT. Access statewide trip volume, dispatch tools, and onboarding for drivers and vehicles.",
      },
      { property: "og:title", content: "Join FloridaNEMT" },
      { property: "og:description", content: "Provider registration for Florida NEMT companies." },
      { property: "og:url", content: "/providers" },
    ],
    links: [{ rel: "canonical", href: "/providers" }],
  }),
  component: ProvidersPage,
});

const inputCls =
  "w-full bg-card border border-input rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

const empty: ProviderApplicationInput = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  serviceTypes: ["ambulatory"],
  fleetSize: undefined,
  notes: "",
};

function ProvidersPage() {
  const submit = useServerFn(submitProviderApplication);
  const [form, setForm] = useState<ProviderApplicationInput>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const toggleType = (t: "ambulatory" | "wheelchair" | "gurney") =>
    setForm((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(t)
        ? f.serviceTypes.filter((x) => x !== t)
        : [...f.serviceTypes, t],
    }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = providerApplicationSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({ data: parsed.data });
      if (res.ok) {
        setDone(true);
        toast.success("Application received. We'll be in touch within 2 business days.");
      } else toast.error(res.error);
    } catch (err) {
      console.error(err);
      toast.error("Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
              For NEMT Providers
            </p>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter mb-6">
              Join Florida's NEMT network.
            </h1>
            <p className="text-lg text-muted max-w-xl mb-10">
              Register your transport company to receive vetted trip volume, manage drivers and
              vehicles in one place, and grow with a statewide referral network.
            </p>
            <ul className="space-y-4 mb-10">
              {[
                "Statewide trip volume from a single intake",
                "Driver & vehicle credential management",
                "Compliance-ready document storage",
                "Required NEMT & HIPAA training in-house",
              ].map((b) => (
                <li key={b} className="flex gap-4 text-base">
                  <span className="mt-2 size-2 rounded-full bg-accent shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Link to="/training" className="font-bold text-primary underline underline-offset-8 hover:text-accent">
              See the required training →
            </Link>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 lg:p-10">
            {done ? (
              <div className="py-12 text-center">
                <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-4">
                  Application received
                </p>
                <h2 className="text-3xl font-extrabold tracking-tighter mb-4">Thanks — we'll be in touch.</h2>
                <p className="text-muted">A network onboarding lead will reach out within 2 business days.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <h2 className="text-2xl font-extrabold tracking-tighter mb-2">Provider application</h2>
                <p className="text-sm text-muted mb-4">Quick intake — full onboarding follows.</p>

                <input className={inputCls} placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                <input className={inputCls} placeholder="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className={inputCls} type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <input className={inputCls} placeholder="Primary city (e.g. Orlando)" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="Fleet size (optional)"
                  value={form.fleetSize ?? ""}
                  onChange={(e) => setForm({ ...form, fleetSize: e.target.value ? Number(e.target.value) : undefined })}
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Service types</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ambulatory", "wheelchair", "gurney"] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleType(t)}
                        className={`p-3 border rounded-sm text-xs font-bold uppercase tracking-wide transition-all ${
                          form.serviceTypes.includes(t)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:border-primary/40"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea className={`${inputCls} min-h-[90px]`} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition-all disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
