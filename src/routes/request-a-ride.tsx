import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  submitRideRequest,
  rideRequestSchema,
  type RideRequestInput,
  RECURRENCE_OPTIONS,
} from "@/lib/forms.functions";
import { enrichRideRequest } from "@/lib/maps.functions";
import { getMyRequest } from "@/lib/requests.functions";
import { CITY_LIST } from "@/lib/cities";

export const Route = createFileRoute("/request-a-ride")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ copyFrom: z.string().uuid().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Request a Ride — Florida NEMT" },
      {
        name: "description",
        content:
          "Book non-emergency medical transportation anywhere in Florida. Ambulatory, wheelchair, and gurney transport with on-time pickup.",
      },
      { property: "og:title", content: "Request a Ride — Florida NEMT" },
      { property: "og:description", content: "Book NEMT transport across Florida." },
      { property: "og:url", content: "/request-a-ride" },
    ],
    links: [{ rel: "canonical", href: "/request-a-ride" }],
  }),
  component: RequestRidePage,
});

const empty: RideRequestInput = {
  patientFirstName: "",
  patientLastName: "",
  patientPhone: "",
  patientEmail: "",
  pickupAddress: "",
  pickupCity: "",
  pickupDate: "",
  pickupTime: "",
  dropoffAddress: "",
  dropoffCity: "",
  transportType: "ambulatory",
  roundTrip: false,
  mobilityNotes: "",
  specialInstructions: "",
  recurrence: "none",
  recurrenceEndDate: "",
};

function Field({
  label,
  children,
  required,
  error,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
      {error && <span className="block mt-1 text-xs text-destructive">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full bg-card border border-input rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

function RequestRidePage() {
  const router = useRouter();
  const submit = useServerFn(submitRideRequest);
  const enrich = useServerFn(enrichRideRequest);
  const [form, setForm] = useState<RideRequestInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; miles?: number | null; cents?: number | null } | null>(null);

  const upd = <K extends keyof RideRequestInput>(k: K, v: RideRequestInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = rideRequestSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({ data: parsed.data });
      if (res.ok) {
        // Geocode + compute miles & estimated cost in the background; if it fails we still confirm the booking.
        let miles: number | null | undefined; let cents: number | null | undefined;
        try {
          const enriched = await enrich({ data: { id: res.id } });
          if (enriched.ok) { miles = enriched.miles; cents = enriched.estimated_cost_cents; }
        } catch { /* ignore — non-fatal */ }
        setDone({ id: res.id, miles, cents });
        toast.success("Ride request received. A dispatcher will call you shortly.");
        router.invalidate();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please call (800) 555-0199.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="py-32 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Confirmation #{done.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="text-5xl font-extrabold tracking-tighter mb-6">Ride request received.</h1>
          {(done.miles != null || done.cents != null) && (
            <div className="bg-card border border-border rounded-sm p-5 mb-8 inline-flex flex-col items-center gap-1">
              {done.miles != null && <div className="text-sm"><span className="font-bold">Distance:</span> {done.miles.toFixed(1)} miles</div>}
              {done.cents != null && <div className="text-sm"><span className="font-bold">Estimated fare:</span> ${(done.cents / 100).toFixed(2)} <span className="text-muted text-xs">(Florida NEMT avg rates)</span></div>}
            </div>
          )}
          <p className="text-muted text-lg mb-10">
            A dispatcher will confirm pickup details by phone within 2 hours. For urgent same-day
            requests, call <a href="tel:8005550199" className="text-primary font-bold">(800) 555-0199</a>.
          </p>
          <Link
            to="/"
            className="inline-block px-8 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-wide uppercase"
          >
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
          New Trip Intake
        </p>
        <h1 className="text-5xl font-extrabold tracking-tighter mb-4">Request a Ride</h1>
        <p className="text-muted text-lg mb-12 max-w-[55ch]">
          Tell us about the trip. A dispatcher will confirm by phone within 2 hours. For same-day
          urgent requests, please call directly.
        </p>

        <form onSubmit={onSubmit} className="space-y-10 bg-card border border-border p-8 md:p-12 rounded-2xl">
          {/* Patient */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-primary mb-2">
              Patient
            </legend>
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="First name" required error={errors.patientFirstName}>
                <input className={inputCls} value={form.patientFirstName} onChange={(e) => upd("patientFirstName", e.target.value)} />
              </Field>
              <Field label="Last name" required error={errors.patientLastName}>
                <input className={inputCls} value={form.patientLastName} onChange={(e) => upd("patientLastName", e.target.value)} />
              </Field>
              <Field label="Phone" required error={errors.patientPhone}>
                <input type="tel" className={inputCls} value={form.patientPhone} onChange={(e) => upd("patientPhone", e.target.value)} placeholder="(555) 555-0123" />
              </Field>
              <Field label="Email" error={errors.patientEmail}>
                <input type="email" className={inputCls} value={form.patientEmail} onChange={(e) => upd("patientEmail", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          {/* Pickup */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-primary mb-2">
              Pickup
            </legend>
            <Field label="Pickup address" required error={errors.pickupAddress}>
              <input className={inputCls} value={form.pickupAddress} onChange={(e) => upd("pickupAddress", e.target.value)} placeholder="Street, suite/unit" />
            </Field>
            <div className="grid md:grid-cols-3 gap-6">
              <Field label="City" required error={errors.pickupCity}>
                <input className={inputCls} value={form.pickupCity} onChange={(e) => upd("pickupCity", e.target.value)} list="fl-cities" />
              </Field>
              <Field label="Date" required error={errors.pickupDate}>
                <input type="date" className={inputCls} value={form.pickupDate} onChange={(e) => upd("pickupDate", e.target.value)} />
              </Field>
              <Field label="Time" required error={errors.pickupTime}>
                <input type="time" className={inputCls} value={form.pickupTime} onChange={(e) => upd("pickupTime", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          {/* Dropoff */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-primary mb-2">
              Drop-off
            </legend>
            <Field label="Drop-off address" required error={errors.dropoffAddress}>
              <input className={inputCls} value={form.dropoffAddress} onChange={(e) => upd("dropoffAddress", e.target.value)} />
            </Field>
            <Field label="City" required error={errors.dropoffCity}>
              <input className={inputCls} value={form.dropoffCity} onChange={(e) => upd("dropoffCity", e.target.value)} list="fl-cities" />
            </Field>
          </fieldset>

          {/* Trip type */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-primary mb-2">
              Transport details
            </legend>
            <div className="grid md:grid-cols-3 gap-3">
              {(["ambulatory", "wheelchair", "gurney"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => upd("transportType", t)}
                  className={`p-4 border rounded-sm text-sm font-bold uppercase tracking-wide transition-all ${
                    form.transportType === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:border-primary/40"
                  }`}
                >
                  {t === "gurney" ? "Gurney / Stretcher" : t}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={form.roundTrip}
                onChange={(e) => upd("roundTrip", e.target.checked)}
                className="size-4"
              />
              <span>Round trip (return ride needed)</span>
            </label>
            <Field label="Mobility notes" error={errors.mobilityNotes}>
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={form.mobilityNotes}
                onChange={(e) => upd("mobilityNotes", e.target.value)}
                placeholder="Oxygen, walker, transfer assistance, weight considerations..."
              />
            </Field>
            <Field label="Special instructions" error={errors.specialInstructions}>
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={form.specialInstructions}
                onChange={(e) => upd("specialInstructions", e.target.value)}
                placeholder="Gate codes, building entry, appointment time..."
              />
            </Field>
          </fieldset>

          <datalist id="fl-cities">
            {CITY_LIST.map((c) => (
              <option key={c.slug} value={c.name} />
            ))}
          </datalist>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-8 py-5 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit ride request"}
          </button>
          <p className="text-xs text-muted text-center">
            By submitting you agree to be contacted about this trip. We never share patient info.
          </p>
        </form>
      </div>
    </section>
  );
}
