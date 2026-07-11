import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  submitRideRequest,
  rideRequestSchema,
  type RideRequestInput,
  type BillingContact,
  RECURRENCE_OPTIONS,
} from "@/lib/forms.functions";
import { enrichRideRequest } from "@/lib/maps.functions";
import { getMyRequest } from "@/lib/requests.functions";
import { CITY_LIST } from "@/lib/cities";
import { RoutePreview, googleRouteUrl, formatMinutes } from "@/components/maps/RoutePreview";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/request-a-ride")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ copyFrom: z.string().uuid().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Request a Ride — MyFloridaNemt.com" },
      {
        name: "description",
        content:
          "Book non-emergency medical transportation anywhere in Florida. Ambulatory, wheelchair, and gurney transport with on-time pickup.",
      },
      { property: "og:title", content: "Request a Ride — MyFloridaNemt.com" },
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
  pickupAddressDetails: "",
  pickupCity: "",
  pickupDate: "",
  pickupTime: "",
  appointmentTime: "",
  dropoffAddress: "",
  dropoffCity: "",
  transportType: "ambulatory",
  tripType: "one_way",
  roundTrip: false,
  returnPickupTime: "",
  returnDropoffTime: "",
  additionalStops: [],
  mobilityNotes: "",
  specialInstructions: "",
  recurrence: "none",
  recurrenceEndDate: "",
  billingSource: "account",
  createAccount: false,
};


const TRIP_TYPE_LABELS: Record<RideRequestInput["tripType"], string> = {
  one_way: "One-way",
  round_trip: "Round trip",
  multi_trip: "Multi-stop",
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
  const { copyFrom } = Route.useSearch();
  const submit = useServerFn(submitRideRequest);
  const enrich = useServerFn(enrichRideRequest);
  const fetchOne = useServerFn(getMyRequest);
  const [form, setForm] = useState<RideRequestInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    id: string;
    miles?: number | null;
    cents?: number | null;
    durationSec?: number | null;
    trafficSec?: number | null;
    polyline?: string | null;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
  } | null>(null);
  const [copiedFromId, setCopiedFromId] = useState<string | null>(null);
  const [savedBilling, setSavedBilling] = useState<BillingContact | null>(null);
  const [customBilling, setCustomBilling] = useState<BillingContact>({
    firstName: "", lastName: "", email: "", phone: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data: p } = await supabase
        .from("member_profiles")
        .select("billing_contact")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const bc = (p as any)?.billing_contact as BillingContact | null;
      if (bc && !cancelled) setSavedBilling(bc);
    })();
    return () => { cancelled = true; };
  }, []);

  const upd = <K extends keyof RideRequestInput>(k: K, v: RideRequestInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!copyFrom) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchOne({ data: { id: copyFrom } });
        if (!r.ok || cancelled) return;
        const row = r.row;
        const allowed: RideRequestInput["recurrence"][] = [...RECURRENCE_OPTIONS];
        const rec = allowed.includes(row.recurrence_rule as RideRequestInput["recurrence"])
          ? (row.recurrence_rule as RideRequestInput["recurrence"])
          : "none";
        setForm({
          patientFirstName: row.patient_first_name ?? "",
          patientLastName: row.patient_last_name ?? "",
          patientPhone: row.patient_phone ?? "",
          patientEmail: row.patient_email ?? "",
          pickupAddress: row.pickup_address ?? "",
          pickupAddressDetails: (row as any).pickup_address_details ?? "",
          pickupCity: row.pickup_city ?? "",
          pickupDate: "",
          pickupTime: "",
          appointmentTime: "",
          dropoffAddress: row.dropoff_address ?? "",
          dropoffCity: row.dropoff_city ?? "",
          transportType:
            (row.transport_type as RideRequestInput["transportType"]) ?? "ambulatory",
          tripType:
            (row.trip_type as RideRequestInput["tripType"]) ??
            (row.round_trip ? "round_trip" : "one_way"),
          roundTrip: !!row.round_trip,
          returnPickupTime: "",
          returnDropoffTime: "",
          additionalStops: Array.isArray(row.additional_stops)
            ? (row.additional_stops as RideRequestInput["additionalStops"])
            : [],
          mobilityNotes: row.mobility_notes ?? "",
          specialInstructions: row.special_instructions ?? "",
          recurrence: rec,
          recurrenceEndDate: "",
          billingSource: "account",
          createAccount: false,
        });
        setCopiedFromId(copyFrom);
        toast.success("Trip copied. Set new pickup/drop-off dates and times to continue.");
      } catch {
        toast.error("Could not load that trip to copy.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [copyFrom, fetchOne]);



  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const withBilling: RideRequestInput = {
      ...form,
      billingContact:
        form.billingSource === "saved" ? savedBilling ?? undefined
        : form.billingSource === "custom" ? customBilling
        : undefined,
    };
    const parsed = rideRequestSchema.safeParse(withBilling);
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
        // Geocode + compute miles, drive time, traffic-aware ETA & polyline in the background;
        // if it fails we still confirm the booking.
        let enrichedInfo: Partial<NonNullable<typeof done>> = {};
        try {
          const enriched = await enrich({ data: { id: res.id, token: res.enrichmentToken } });
          if (enriched.ok) {
            enrichedInfo = {
              miles: enriched.miles,
              cents: enriched.estimated_cost_cents,
              durationSec: enriched.duration_seconds,
              trafficSec: enriched.duration_traffic_seconds,
              polyline: enriched.polyline,
              pickupLat: enriched.pickup_lat,
              pickupLng: enriched.pickup_lng,
              dropoffLat: enriched.dropoff_lat,
              dropoffLng: enriched.dropoff_lng,
            };
          }
        } catch { /* ignore — non-fatal */ }
        setDone({ id: res.id, ...enrichedInfo });
        toast.success("Ride request received. A dispatcher will contact you shortly.");
        router.invalidate();

        // Optional: create a Patient Portal account with the same email.
        if (parsed.data.createAccount && parsed.data.patientEmail) {
          try {
            const { data: existing } = await supabase.auth.getUser();
            if (!existing.user) {
              const { error: signUpErr } = await supabase.auth.signUp({
                email: parsed.data.patientEmail,
                password: crypto.randomUUID() + "Aa1!",
                options: {
                  emailRedirectTo: `${window.location.origin}/reset-password`,
                  data: {
                    portal: "patient",
                    first_name: parsed.data.patientFirstName,
                    last_name: parsed.data.patientLastName,
                  },
                },
              });
              if (!signUpErr) {
                await supabase.auth.resetPasswordForEmail(parsed.data.patientEmail, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                toast.success("Check your email to finish creating your Patient Portal account.");
              }
            }
          } catch (e) {
            console.error("account creation failed", e);
          }
        }
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
    const hasRoute =
      done.miles != null ||
      done.cents != null ||
      done.trafficSec != null ||
      done.durationSec != null;
    return (
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Confirmation #{done.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="text-5xl font-extrabold tracking-tighter mb-6">Ride request received.</h1>

          {hasRoute && (
            <div className="bg-card border border-border rounded-sm p-5 mb-6 text-left">
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                {done.miles != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Total miles</div>
                    <div className="text-lg font-extrabold">{done.miles.toFixed(1)} mi</div>
                  </div>
                )}
                {done.trafficSec != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Drive time (traffic)</div>
                    <div className="text-lg font-extrabold">{formatMinutes(done.trafficSec)}</div>
                    {done.durationSec != null && done.durationSec !== done.trafficSec && (
                      <div className="text-[11px] text-muted">Typical {formatMinutes(done.durationSec)}</div>
                    )}
                  </div>
                )}
                {done.cents != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Estimated trip cost</div>
                    <div className="text-lg font-extrabold">${(done.cents / 100).toFixed(2)}</div>
                    <div className="text-[11px] text-muted">
                      {form.tripType === "round_trip" ? "Round trip estimate" : form.tripType === "multi_trip" ? "Multi-stop estimate" : "One-way estimate"}
                    </div>
                  </div>
                )}
              </div>
              <RoutePreview
                polyline={done.polyline}
                pickupLat={done.pickupLat}
                pickupLng={done.pickupLng}
                dropoffLat={done.dropoffLat}
                dropoffLng={done.dropoffLng}
                height={240}
              />
              <a
                href={googleRouteUrl(done.pickupLat, done.pickupLng, done.dropoffLat, done.dropoffLng)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-primary hover:underline"
              >
                Open route in Google Maps →
              </a>
              <p className="mt-4 text-[11px] leading-relaxed text-muted border-t border-border pt-3">
                <strong className="font-bold text-foreground">This is an estimate only.</strong> The final price may change after dispatcher review, provider assignment, wait time, additional stops, or manual quoting. You will receive a confirmed price before your trip is dispatched.
              </p>
            </div>
          )}

          <p className="text-muted text-lg mb-10">
            A dispatcher will confirm your pickup details by phone or email within 2 hours. Please be
            on the lookout for our communication. For urgent same-day requests, call{" "}
            <a href="tel:8005550199" className="text-primary font-bold">(800) 555-0199</a>.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/requests/$id"
              params={{ id: done.id }}
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-wide uppercase"
            >
              Preview trip details
            </Link>
            <Link
              to="/"
              className="inline-block px-8 py-4 bg-card border border-border text-foreground font-bold rounded-sm text-sm tracking-wide uppercase"
            >
              Back to home
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            You can review and edit the reservation from the trip details page until a dispatcher claims it.
          </p>

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

        {copiedFromId && (
          <div className="mb-6 rounded-sm border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <strong className="font-bold">Copied from a previous trip.</strong> Review the details and
            pick a new pickup date before submitting.
          </div>
        )}

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
            <Field label="Building / Doctor's office / Suite (optional)" error={errors.pickupAddressDetails}>
              <input
                className={inputCls}
                value={form.pickupAddressDetails ?? ""}
                onChange={(e) => upd("pickupAddressDetails", e.target.value)}
                placeholder="e.g. Dr. Patel's office, Baptist MOB Suite 304, side entrance"
              />
              <p className="mt-1 text-xs text-muted">Building name, doctor or facility name, suite, gate code, or pickup notes.</p>
            </Field>
            <div className="grid md:grid-cols-3 gap-6">
              <Field label="City" required error={errors.pickupCity}>
                <input className={inputCls} value={form.pickupCity} onChange={(e) => upd("pickupCity", e.target.value)} list="fl-cities" />
              </Field>
              <Field label="Date" required error={errors.pickupDate}>
                <input type="date" className={inputCls} value={form.pickupDate} onChange={(e) => upd("pickupDate", e.target.value)} />
              </Field>
              <Field label="Pickup time" required error={errors.pickupTime}>
                <input type="time" className={inputCls} value={form.pickupTime} onChange={(e) => upd("pickupTime", e.target.value)} />
              </Field>
            </div>
            <Field label="Appointment time (drop-off arrival)" error={errors.appointmentTime}>
              <input
                type="time"
                className={inputCls}
                value={form.appointmentTime ?? ""}
                onChange={(e) => upd("appointmentTime", e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">When the patient needs to be at the destination.</p>
            </Field>
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
            <div>
              <span className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
                Trip type <span className="text-accent">*</span>
              </span>
              <div className="grid md:grid-cols-3 gap-3">
                {(["one_way", "round_trip", "multi_trip"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => {
                      upd("tripType", t);
                      upd("roundTrip", t === "round_trip");
                      if (t !== "multi_trip" && form.additionalStops.length > 0) {
                        upd("additionalStops", []);
                      }
                    }}
                    className={`p-4 border rounded-sm text-sm font-bold uppercase tracking-wide transition-all ${
                      form.tripType === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:border-primary/40"
                    }`}
                  >
                    {TRIP_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                {form.tripType === "one_way" && "Single pickup to a single drop-off."}
                {form.tripType === "round_trip" && "We'll dispatch a return ride after the appointment."}
                {form.tripType === "multi_trip" && "Add one or more stops between the pickup and final drop-off."}
              </p>
            </div>

            {form.tripType === "round_trip" && (
              <div className="border border-dashed border-border rounded-sm p-4 grid md:grid-cols-2 gap-6">
                <Field label="Return pickup time" required error={errors.returnPickupTime}>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.returnPickupTime ?? ""}
                    onChange={(e) => upd("returnPickupTime", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted">When the patient is ready to be picked up after the appointment.</p>
                </Field>
                <Field label="Return drop-off time" error={errors.returnDropoffTime}>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.returnDropoffTime ?? ""}
                    onChange={(e) => upd("returnDropoffTime", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted">Optional — expected arrival back home.</p>
                </Field>
              </div>
            )}


            {form.tripType === "multi_trip" && (
              <div className="space-y-4 border border-dashed border-border rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">
                    Additional stops
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      upd("additionalStops", [
                        ...form.additionalStops,
                        { address: "", city: "", pickupTime: "", note: "" },
                      ])
                    }
                    disabled={form.additionalStops.length >= 10}
                    className="text-xs font-bold uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
                  >
                    + Add stop
                  </button>
                </div>
                {form.additionalStops.length === 0 && (
                  <p className="text-xs text-muted">No stops yet. Add at least one stop between pickup and drop-off.</p>
                )}
                {form.additionalStops.map((stop, i) => (
                  <div key={i} className="grid md:grid-cols-[1fr_160px_140px_auto] gap-3 items-start">
                    <input
                      className={inputCls}
                      placeholder={`Stop ${i + 1} address`}
                      value={stop.address}
                      onChange={(e) => {
                        const next = [...form.additionalStops];
                        next[i] = { ...next[i], address: e.target.value };
                        upd("additionalStops", next);
                      }}
                    />
                    <input
                      className={inputCls}
                      placeholder="City"
                      list="fl-cities"
                      value={stop.city}
                      onChange={(e) => {
                        const next = [...form.additionalStops];
                        next[i] = { ...next[i], city: e.target.value };
                        upd("additionalStops", next);
                      }}
                    />
                    <input
                      type="time"
                      className={inputCls}
                      aria-label={`Stop ${i + 1} pickup time`}
                      value={stop.pickupTime ?? ""}
                      onChange={(e) => {
                        const next = [...form.additionalStops];
                        next[i] = { ...next[i], pickupTime: e.target.value };
                        upd("additionalStops", next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        upd(
                          "additionalStops",
                          form.additionalStops.filter((_, idx) => idx !== i),
                        )
                      }
                      className="px-3 py-3 border border-input rounded-sm text-xs font-bold uppercase tracking-wide hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive"
                    >
                      Remove
                    </button>
                    {(errors[`additionalStops.${i}.address`] ||
                      errors[`additionalStops.${i}.city`] ||
                      errors[`additionalStops.${i}.pickupTime`]) && (
                      <span className="md:col-span-4 text-xs text-destructive">
                        {errors[`additionalStops.${i}.address`] ||
                          errors[`additionalStops.${i}.city`] ||
                          errors[`additionalStops.${i}.pickupTime`]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
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

          {/* Recurrence */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-primary mb-2">
              Recurring trip
            </legend>
            <p className="text-xs text-muted -mt-2">
              Schedule the same trip on a repeating basis (e.g. weekly dialysis). Leave as "One-time"
              for a single ride.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="Repeat">
                <select
                  className={inputCls}
                  value={form.recurrence}
                  onChange={(e) =>
                    upd("recurrence", e.target.value as RideRequestInput["recurrence"])
                  }
                >
                  <option value="none">One-time (no repeat)</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays (Mon–Fri)</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              {form.recurrence !== "none" && (
                <Field label="Repeat until" error={errors.recurrenceEndDate}>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.recurrenceEndDate}
                    min={form.pickupDate || undefined}
                    onChange={(e) => upd("recurrenceEndDate", e.target.value)}
                  />
                </Field>
              )}
            </div>
          </fieldset>

          {/* Billing information */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold uppercase tracking-widest text-primary mb-2">
              Billing information
            </legend>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.billingSource === "account"}
                onChange={(e) =>
                  upd("billingSource", e.target.checked ? "account" : (savedBilling ? "saved" : "custom"))
                }
              />
              <span>Use same information as account holder</span>
            </label>

            {form.billingSource !== "account" && (
              <div className="space-y-4 pl-6 border-l-2 border-border">
                {savedBilling && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="billingSource"
                        checked={form.billingSource === "saved"}
                        onChange={() => upd("billingSource", "saved")}
                      />
                      <span>
                        Use saved billing contact ({savedBilling.firstName} {savedBilling.lastName})
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="billingSource"
                        checked={form.billingSource === "custom"}
                        onChange={() => upd("billingSource", "custom")}
                      />
                      <span>Enter different billing contact for this trip</span>
                    </label>
                  </div>
                )}

                {form.billingSource === "custom" && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <Field label="First name" required error={errors["billingContact.firstName"]}>
                      <input className={inputCls} value={customBilling.firstName}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, firstName: e.target.value }))} />
                    </Field>
                    <Field label="Last name" required error={errors["billingContact.lastName"]}>
                      <input className={inputCls} value={customBilling.lastName}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, lastName: e.target.value }))} />
                    </Field>
                    <Field label="Email" required error={errors["billingContact.email"]}>
                      <input type="email" className={inputCls} value={customBilling.email}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, email: e.target.value }))} />
                    </Field>
                    <Field label="Phone" required error={errors["billingContact.phone"]}>
                      <input type="tel" className={inputCls} value={customBilling.phone}
                        onChange={(e) => setCustomBilling((b) => ({ ...b, phone: e.target.value }))} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <datalist id="fl-cities">

            {CITY_LIST.map((c) => (
              <option key={c.slug} value={c.name} />
            ))}
          </datalist>

          {form.patientEmail && (
            <label className="flex items-start gap-3 text-sm bg-primary/5 border border-primary/20 rounded-sm p-4">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.createAccount ?? false}
                onChange={(e) => upd("createAccount", e.target.checked)}
              />
              <span>
                <strong className="font-bold">Create a Patient Portal account</strong> using{" "}
                <span className="font-mono">{form.patientEmail}</span>. We'll email you a link to set
                your password so you can track this ride, save patients, and book future trips faster.
              </span>
            </label>
          )}

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
