import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
import { CITY_LIST } from "@/lib/cities";
import { AddressAutocomplete, type AddressSelection } from "@/components/forms/AddressAutocomplete";
import { PriceEstimate } from "@/components/pricing/PriceEstimate";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { TimePickerField, TimeSelect } from "@/components/ui/time-picker-field";
import { RoutePreview, googleRouteUrl, formatMinutes } from "@/components/maps/RoutePreview";
import { supabase } from "@/integrations/supabase/client";
import { PublicPage } from "@/components/public/PublicPage";
import { NonEmergencyNotice, pageHead } from "@/components/public/page-kit";
import { LINKS, PUBLIC_EMAIL, PUBLIC_PHONE_TEL } from "@/lib/site-config";
import { TripLegsPreview, type LegInput } from "@/components/trips/TripLegsPreview";


const SERVICE_CHOICES: { id: string; label: string; kind: "ride" | "delivery"; type?: RideRequestInput["transportType"] }[] = [
  { id: "ambulatory", label: "Ambulatory", kind: "ride", type: "ambulatory" },
  { id: "wheelchair", label: "Wheelchair", kind: "ride", type: "wheelchair" },
  { id: "stretcher", label: "Stretcher", kind: "ride", type: "gurney" },
  { id: "medical-delivery", label: "Medical Delivery", kind: "delivery" },
];

const SERVICE_PARAM: Record<string, RideRequestInput["transportType"]> = { ambulatory: "ambulatory", wheelchair: "wheelchair", stretcher: "gurney" };

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ service: z.string().max(40).optional().catch(undefined) }).parse(s),
  head: () => pageHead(
    "/book",
    "Submit a Florida NEMT Trip Request — Book a Trip | MY FLORIDA NEMT",
    "Request ambulatory, wheelchair or stretcher non-emergency medical transportation in Florida. Participating independent providers review each request; acceptance is required.",
    "Book a Trip",
  ),
  component: () => <PublicPage><RequestRidePage /></PublicPage>,
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
  returnDate: "",
  returnPickupBuilding: "",
  returnPickupDoctor: "",
  returnPickupSuite: "",
  additionalStops: [],
  mobilityNotes: "",
  specialInstructions: "",
  recurrence: "none",
  recurrenceEndDate: "",
  billingSource: "account",
  createAccount: false,
  blackTie: false,
};

function buildLegs(f: RideRequestInput): LegInput[] {
  const pickup = [f.pickupAddress, f.pickupCity].filter(Boolean).join(", ");
  const dropoff = [f.dropoffAddress, f.dropoffCity].filter(Boolean).join(", ");
  const legs: LegInput[] = [];
  // Leg 1: primary pickup → drop-off (or first stop for multi-trip)
  const firstTo =
    f.tripType === "multi_trip" && f.additionalStops.length > 0
      ? [f.additionalStops[0].address, f.additionalStops[0].city].filter(Boolean).join(", ")
      : dropoff;
  legs.push({
    label: "Pickup",
    from: pickup,
    to: firstTo,
    date: f.pickupDate,
    time: f.pickupTime,
  });
  if (f.tripType === "multi_trip") {
    for (let i = 0; i < f.additionalStops.length; i++) {
      const s = f.additionalStops[i];
      const next = f.additionalStops[i + 1];
      const to = next
        ? [next.address, next.city].filter(Boolean).join(", ")
        : dropoff;
      const stopTime = s.pickupTime ?? "";
      legs.push({
        label: `Stop ${i + 1}`,
        from: [s.address, s.city].filter(Boolean).join(", "),
        to,
        date: f.pickupDate,
        time: stopTime || f.pickupTime,
        inheritedDate: true,
        inheritedTime: !stopTime,
        note: s.note || undefined,
      });
    }
  }
  if (f.tripType === "round_trip") {
    const rdate = f.returnDate || f.pickupDate;
    legs.push({
      label: "Return",
      from: dropoff,
      to: pickup,
      date: rdate,
      time: f.returnPickupTime || f.pickupTime,
      inheritedDate: !f.returnDate || f.returnDate === f.pickupDate,
      inheritedTime: !f.returnPickupTime,
    });
  }
  return legs;
}


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
    <label
      className={
        error
          ? "block rounded-ds-sm [&_input]:border-destructive [&_textarea]:border-destructive [&_select]:border-destructive [&_button]:border-destructive"
          : "block"
      }
      data-field-error={error ? "true" : undefined}
    >
      <span className="block text-xs font-bold uppercase tracking-widest text-ds-text-2 mb-2">
        {label}
        {required && <span className="text-ds-accent-active"> *</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="block mt-1 text-xs font-semibold text-ds-error">
          {error}
        </span>
      )}
    </label>
  );
}


const inputCls =
  "w-full bg-ds-surface border border-ds-border rounded-ds-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ds-focus focus:border-ds-sky-border transition-all";

function haversineMiles(lat1: number | null, lng1: number | null, lat2: number | null, lng2: number | null): number {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 0;
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function RequestRidePage() {
  const router = useRouter();
  const { service } = Route.useSearch();
  const [kind, setKind] = useState<"ride" | "delivery">(service === "medical-delivery" ? "delivery" : "ride");
  const submit = useServerFn(submitRideRequest);
  const enrich = useServerFn(enrichRideRequest);
  const [form, setForm] = useState<RideRequestInput>(() => (service && SERVICE_PARAM[service] ? { ...empty, transportType: SERVICE_PARAM[service] } : empty));
  const [returnDateManual, setReturnDateManual] = useState(false);
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
  const [savedBilling, setSavedBilling] = useState<BillingContact | null>(null);
  const [customBilling, setCustomBilling] = useState<BillingContact>({
    firstName: "", lastName: "", email: "", phone: "",
  });
  // Autocomplete-derived location metadata used for live price estimate.
  const [pickupMeta, setPickupMeta] = useState<{ zip: string; state: string; lat: number | null; lng: number | null }>({ zip: "", state: "", lat: null, lng: null });
  const [dropoffMeta, setDropoffMeta] = useState<{ zip: string; state: string; lat: number | null; lng: number | null }>({ zip: "", state: "", lat: null, lng: null });
  const estimatedMiles = haversineMiles(pickupMeta.lat, pickupMeta.lng, dropoffMeta.lat, dropoffMeta.lng);

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
        const key = issue.path.join(".");
        const raw = issue.message ?? "";
        const generic =
          !raw ||
          /^Required$/i.test(raw) ||
          /at least \d+ character/i.test(raw) ||
          /^Invalid/i.test(raw) ||
          /expected|received/i.test(raw);
        errs[key] = generic
          ? key.toLowerCase().includes("email")
            ? "Enter a valid email address."
            : key.toLowerCase().includes("phone")
              ? "Enter a valid phone number."
              : key.toLowerCase().includes("date")
                ? "Choose a date."
                : key.toLowerCase().includes("time")
                  ? "Choose a time."
                  : "This field is required."
          : raw;
      }

      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      // Bring the first problem field into view so the user can correct it.
      requestAnimationFrame(() => {
        const el = document.querySelector("[data-field-error='true']");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
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
        toast.success("Trip request submitted. It is not confirmed until a provider accepts it.");
        router.invalidate();

      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error("trip request submission failed");
      toast.error("Something went wrong. Please try again or call us.");
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
          <p className=" text-xs font-bold text-ds-accent-active uppercase tracking-[0.2em] mb-4">
            Confirmation #{done.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="ds-display mb-6 uppercase text-ds-primary">Trip request submitted</h1>

          {hasRoute && (
            <div className="bg-ds-surface border border-ds-border rounded-ds-sm p-5 mb-6 text-left">
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                {done.miles != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ds-text-2">Total miles</div>
                    <div className="text-lg font-extrabold">{done.miles.toFixed(1)} mi</div>
                  </div>
                )}
                {done.trafficSec != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ds-text-2">Drive time (traffic)</div>
                    <div className="text-lg font-extrabold">{formatMinutes(done.trafficSec)}</div>
                    {done.durationSec != null && done.durationSec !== done.trafficSec && (
                      <div className="text-[11px] text-ds-text-2">Typical {formatMinutes(done.durationSec)}</div>
                    )}
                  </div>
                )}
                {done.cents != null && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ds-text-2">Estimated trip cost</div>
                    <div className="text-lg font-extrabold">${(done.cents / 100).toFixed(2)}</div>
                    <div className="text-[11px] text-ds-text-2">
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
                className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-ds-primary hover:underline"
              >
                Open route in Google Maps →
              </a>
              <p className="mt-4 text-[11px] leading-relaxed text-ds-text-2 border-t border-ds-border pt-3">
                <strong className="font-bold text-ds-on-surface">This is an estimate only.</strong> The final price is set by the accepting provider and may change with wait time, additional stops, or manual quoting. A provider confirms pricing before accepting the trip.
              </p>
            </div>
          )}

          <p className="ds-body-lg mb-10 text-ds-text-2">
            Your request has been submitted. It is <strong>not a confirmed trip</strong> until a participating independent provider reviews and accepts it. We'll contact you using the details you provided.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="ds-button-text inline-flex min-h-12 items-center rounded-ds-sm bg-ds-primary px-6 uppercase text-ds-on-primary hover:bg-ds-primary-hover">Back to home</Link>
            <a href={LINKS.createAccount} className="ds-button-text inline-flex min-h-12 items-center rounded-ds-sm bg-ds-sky px-6 uppercase text-ds-primary hover:bg-ds-hover">Create an account</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-ds-bg px-5 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="ds-display text-center uppercase text-ds-primary">Book a trip</h1>
        <p className="ds-body-lg mx-auto mt-4 max-w-[46rem] text-center text-ds-text-2">
          Share the trip details below. Independent providers in the MY FLORIDA NEMT network review each request — submitting does not guarantee a ride until a provider accepts it.
        </p>
        <div role="note" className="ds-body-lg mx-auto mt-6 mb-6 max-w-[46rem] rounded-ds bg-ds-membership p-5 text-center text-ds-primary">
          <strong>We recommend submitting requests 48–72 hours in advance.</strong> Short-notice requests may be submitted for review, but availability and acceptance are not guaranteed.
        </div>
        <NonEmergencyNotice className="mb-10" />

        <fieldset className="mb-8">
          <legend className="ds-label mb-3 block text-ds-on-surface">What do you need? <span className="text-ds-accent-active">*</span></legend>
          <div role="radiogroup" aria-label="Service" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE_CHOICES.map((c) => {
              const on = c.kind === "delivery" ? kind === "delivery" : kind === "ride" && form.transportType === c.type;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={on}
                  onClick={() => { setKind(c.kind); if (c.type) upd("transportType", c.type); }}
                  className={`ds-button-text min-h-12 whitespace-nowrap rounded-ds-sm px-4 uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus ${on ? "bg-ds-action text-ds-on-action" : "bg-ds-sky text-ds-primary hover:bg-ds-hover"}`}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {kind === "delivery" ? (
          <div role="status" className="rounded-ds-lg bg-ds-sky p-6 sm:p-8">
            <h2 className="ds-section-title uppercase text-ds-primary">Medical delivery requests</h2>
            <p className="ds-body-lg mt-3">Online medical delivery requests aren’t available yet — the request system currently stores passenger trips only, so we won’t accept a delivery through this form. Please call or email us with:</p>
            <ul className="ds-body-lg mt-3 list-disc space-y-1 pl-6">
              <li>The pickup location</li>
              <li>The delivery destination</li>
              <li>Basic delivery instructions, such as handling needs and the deadline</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={PUBLIC_PHONE_TEL} className="ds-button-text inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-ds-sm bg-ds-action px-6 uppercase text-ds-on-action hover:bg-ds-action-hover">Call us</a>
              <a href={`mailto:${PUBLIC_EMAIL}?subject=${encodeURIComponent("Medical delivery request")}`} className="ds-button-text inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-ds-sm bg-ds-primary px-6 uppercase text-ds-on-primary hover:bg-ds-primary-hover">Email us</a>
            </div>
          </div>
        ) : (
        <form noValidate onSubmit={onSubmit} className="space-y-10 bg-ds-surface border border-ds-border p-8 md:p-12 rounded-ds-lg">

          {/* Patient */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
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
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              Pickup
            </legend>
            <Field label="Pickup address" required error={errors.pickupAddress}>
              <AddressAutocomplete
                value={form.pickupAddress}
                onChange={(v) => upd("pickupAddress", v)}
                onSelect={(sel: AddressSelection) => {
                  upd("pickupAddress", sel.address);
                  if (sel.city) upd("pickupCity", sel.city);
                  setPickupMeta({ zip: sel.zip, state: sel.state, lat: sel.lat, lng: sel.lng });
                }}
                placeholder="Street, suite/unit"
                className={inputCls}
              />
            </Field>
            <Field label="Building / Doctor's office / Suite (optional)" error={errors.pickupAddressDetails}>
              <input
                className={inputCls}
                value={form.pickupAddressDetails ?? ""}
                onChange={(e) => upd("pickupAddressDetails", e.target.value)}
                placeholder="e.g. Dr. Patel's office, Baptist MOB Suite 304, side entrance"
              />
              <p className="mt-1 text-xs text-ds-text-2">Building name, doctor or facility name, suite, gate code, or pickup notes.</p>
            </Field>
            <div className="grid md:grid-cols-3 gap-6">
              <Field label="City" required error={errors.pickupCity}>
                <input className={inputCls} value={form.pickupCity} onChange={(e) => upd("pickupCity", e.target.value)} list="fl-cities" />
              </Field>
              <Field label="Date" required error={errors.pickupDate}>
                <DatePickerField
                  value={form.pickupDate}
                  onChange={(v) => {
                    setForm((f) => ({
                      ...f,
                      pickupDate: v,
                      returnDate: !returnDateManual && f.tripType === "round_trip" ? v : f.returnDate,
                    }));
                  }}
                  booking
                  required
                />
              </Field>
              <Field label="Pickup time" required error={errors.pickupTime}>
                <TimePickerField
                  value={form.pickupTime}
                  pickupDate={form.pickupDate}
                  enforceLeadTime
                  onChange={(v) => {
                    setForm((f) => ({
                      ...f,
                      pickupTime: v,
                      returnPickupTime: f.tripType === "round_trip" && !f.returnPickupTime ? v : f.returnPickupTime,
                      additionalStops: f.additionalStops.map((s) => (s.pickupTime ? s : { ...s, pickupTime: v })),
                    }));
                  }}
                />
              </Field>
            </div>
            <Field label="Appointment time (drop-off arrival)" error={errors.appointmentTime}>
              <TimeSelect
                value={form.appointmentTime ?? ""}
                onChange={(v) => upd("appointmentTime", v)}
              />
              <p className="mt-1 text-xs text-ds-text-2">When the patient needs to be at the destination.</p>
            </Field>
          </fieldset>



          {/* Dropoff */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              Drop-off
            </legend>
            <Field label="Drop-off address" required error={errors.dropoffAddress}>
              <AddressAutocomplete
                value={form.dropoffAddress}
                onChange={(v) => upd("dropoffAddress", v)}
                onSelect={(sel: AddressSelection) => {
                  upd("dropoffAddress", sel.address);
                  if (sel.city) upd("dropoffCity", sel.city);
                  setDropoffMeta({ zip: sel.zip, state: sel.state, lat: sel.lat, lng: sel.lng });
                }}
                className={inputCls}
              />
            </Field>
            <Field label="City" required error={errors.dropoffCity}>
              <input className={inputCls} value={form.dropoffCity} onChange={(e) => upd("dropoffCity", e.target.value)} list="fl-cities" />
            </Field>
            {!form.blackTie && (
              <PriceEstimate
                pickupZip={pickupMeta.zip}
                miles={estimatedMiles}
                transportType={form.transportType}
                legs={form.tripType === "round_trip" ? 2 : form.tripType === "multi_trip" ? 1 + form.additionalStops.length : 1}
                stops={form.tripType === "multi_trip" ? form.additionalStops.length : 0}
                tripTypeLabel={TRIP_TYPE_LABELS[form.tripType]}
              />
            )}
            {form.blackTie && (
              <div className="mt-2 rounded-ds-sm border border-ds-border bg-ds-membership p-4 text-sm">
                <p className="font-bold uppercase tracking-widest text-ds-accent-active text-xs mb-1">Manual quote</p>
                <p className="text-ds-text-2">
                  All Black Tie Transportation requests are quoted manually. Our team will review your
                  request and reply with a custom price before your reservation is confirmed.
                </p>
              </div>
            )}
          </fieldset>

          {/* Transport details */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              Transport details
            </legend>
            <div>
              <span className="block text-xs font-bold uppercase tracking-widest text-ds-text-2 mb-2">
                Trip type <span className="text-ds-accent-active">*</span>
              </span>
              <div className="grid md:grid-cols-3 gap-3">
                {(["one_way", "round_trip", "multi_trip"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        tripType: t,
                        roundTrip: t === "round_trip",
                        // Default the return leg time to the pickup time when switching to round trip
                        returnPickupTime:
                          t === "round_trip" && !f.returnPickupTime ? f.pickupTime : f.returnPickupTime,
                        // Default the return date to the pickup date when switching to round trip
                        returnDate:
                          t === "round_trip"
                            ? (returnDateManual && f.returnDate ? f.returnDate : f.pickupDate)
                            : "",
                        // Clear stops when leaving multi-trip; otherwise keep them
                        additionalStops: t === "multi_trip" ? f.additionalStops : [],
                      }));
                      if (t !== "round_trip") setReturnDateManual(false);
                    }}
                    className={`p-4 border rounded-ds-sm text-sm font-bold uppercase tracking-wide transition-all ${
                      form.tripType === t
                        ? "border-primary bg-ds-action text-ds-on-action"
                        : "border-ds-border hover:border-ds-sky-border"
                    }`}
                  >
                    {TRIP_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ds-text-2">
                {form.tripType === "one_way" && "Single pickup to a single drop-off."}
                {form.tripType === "round_trip" && "Add the return pickup time so providers can plan the ride home."}
                {form.tripType === "multi_trip" && "Add one or more stops between the pickup and final drop-off."}
              </p>
            </div>

            {form.tripType === "round_trip" && (
              <div className="border border-dashed border-ds-border rounded-ds-sm p-4 grid md:grid-cols-2 gap-6">
                <Field label="Return date" required error={(errors as any).returnDate}>
                  <DatePickerField
                    value={form.returnDate ?? ""}
                    onChange={(v) => {
                      setReturnDateManual(true);
                      upd("returnDate", v);
                    }}
                    booking
                  />
                  <p className="mt-1 text-xs text-ds-text-2">
                    Defaults to your pickup date. Change it if the patient returns on a different day (e.g. surgery).
                  </p>
                </Field>
                <Field label="Return pickup time" required error={errors.returnPickupTime}>
                  <TimePickerField
                    value={form.returnPickupTime ?? ""}
                    pickupDate={form.returnDate || form.pickupDate}
                    enforceLeadTime
                    onChange={(v) => upd("returnPickupTime", v)}
                    helperText="When the patient is ready to be picked up after the appointment."
                  />
                </Field>
                <Field label="Return drop-off time" error={errors.returnDropoffTime}>
                  <TimeSelect
                    value={form.returnDropoffTime ?? ""}
                    onChange={(v) => upd("returnDropoffTime", v)}
                  />
                  <p className="mt-1 text-xs text-ds-text-2">Optional — expected arrival back home.</p>
                </Field>
                <Field label="Return pickup building" error={(errors as any).returnPickupBuilding}>
                  <input
                    className={inputCls}
                    value={form.returnPickupBuilding ?? ""}
                    onChange={(e) => upd("returnPickupBuilding", e.target.value)}
                    placeholder="e.g. Medical Arts Building B"
                  />
                </Field>
                <Field label="Return pickup doctor / office" error={(errors as any).returnPickupDoctor}>
                  <input
                    className={inputCls}
                    value={form.returnPickupDoctor ?? ""}
                    onChange={(e) => upd("returnPickupDoctor", e.target.value)}
                    placeholder="e.g. Dr. Smith"
                  />
                </Field>
                <Field label="Return pickup suite" error={(errors as any).returnPickupSuite}>
                  <input
                    className={inputCls}
                    value={form.returnPickupSuite ?? ""}
                    onChange={(e) => upd("returnPickupSuite", e.target.value)}
                    placeholder="e.g. Suite 210"
                  />
                </Field>
              </div>
            )}


            {form.tripType === "multi_trip" && (
              <div className="space-y-4 border border-dashed border-ds-border rounded-ds-sm p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-ds-text-2">
                    Additional stops
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      upd("additionalStops", [
                        ...form.additionalStops,
                        { address: "", city: "", pickupTime: form.pickupTime ?? "", note: "" },
                      ])
                    }
                    disabled={form.additionalStops.length >= 10}
                    className="text-xs font-bold uppercase tracking-wide text-ds-primary hover:underline disabled:opacity-50"
                  >
                    + Add stop
                  </button>
                </div>
                {form.additionalStops.length === 0 && (
                  <p className="text-xs text-ds-text-2">No stops yet. Add at least one stop between pickup and drop-off.</p>
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
                    <TimePickerField
                      value={stop.pickupTime ?? ""}
                      pickupDate={form.pickupDate}
                      enforceLeadTime
                      onChange={(v) => {
                        const next = [...form.additionalStops];
                        next[i] = { ...next[i], pickupTime: v };
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
                      className="px-3 py-3 border border-ds-border rounded-ds-sm text-xs font-bold uppercase tracking-wide hover:bg-ds-error-soft hover:border-ds-error hover:text-ds-error"
                    >
                      Remove
                    </button>
                    {(errors[`additionalStops.${i}.address`] ||
                      errors[`additionalStops.${i}.city`] ||
                      errors[`additionalStops.${i}.pickupTime`]) && (
                      <span className="md:col-span-4 text-xs text-ds-error">
                        {errors[`additionalStops.${i}.address`] ||
                          errors[`additionalStops.${i}.city`] ||
                          errors[`additionalStops.${i}.pickupTime`]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <TripLegsPreview className="mt-2" legs={buildLegs(form)} />
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
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
              Recurring trip
            </legend>
            <p className="text-xs text-ds-text-2 -mt-2">
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
                  <DatePickerField
                    value={form.recurrenceEndDate ?? ""}
                    onChange={(v) => upd("recurrenceEndDate", v)}
                    min={form.pickupDate || new Date().toISOString().slice(0, 10)}
                    booking
                  />
                </Field>
              )}
            </div>
          </fieldset>

          {/* Billing information */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold uppercase tracking-widest text-ds-primary mb-2">
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
              <div className="space-y-4 pl-6 border-l-2 border-ds-border">
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

          <p className="ds-body rounded-ds-sm bg-ds-sky p-4 text-ds-on-surface">
            Want to track requests and save details for next time? <a href={LINKS.createAccount} className="font-semibold text-ds-link underline underline-offset-4">Create an account</a> — it's optional.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-8 py-5 bg-ds-action text-ds-on-action font-bold rounded-ds-sm text-sm tracking-widest uppercase hover:bg-ds-action-hover transition-all disabled:opacity-60"
          >
            {submitting ? "SUBMITTING…" : "SUBMIT TRIP REQUEST"}
          </button>
          <p className="text-xs text-ds-text-2 text-center">
            By submitting you agree to be contacted about this trip. Submitting is a request, not a confirmed booking.
          </p>
        </form>
        )}
      </div>
    </section>
  );
}
