import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { rideRequestSchema, submitRideRequest, type RideRequestInput } from "@/lib/forms.functions";
import { resolveEmbedToken } from "@/lib/embed-tokens.functions";
import { CITY_LIST } from "@/lib/cities";
import { TimeSelect } from "@/components/ui/time-picker-field";

export const Route = createFileRoute("/embed/request-a-ride/$token")({
  head: () => ({
    meta: [
      { title: "Request a Ride" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const res = await resolveEmbedToken({ data: { token: params.token } });
    if (!res.ok) throw notFound();
    return res;
  },
  component: EmbedRequestForm,
});

const empty: RideRequestInput = {
  patientFirstName: "", patientLastName: "", patientPhone: "", patientEmail: "",
  pickupAddress: "", pickupAddressDetails: "", pickupCity: "",
  pickupDate: "", pickupTime: "", appointmentTime: "",
  dropoffAddress: "", dropoffCity: "",
  transportType: "ambulatory", tripType: "one_way", roundTrip: false,
  returnPickupTime: "", returnDropoffTime: "", additionalStops: [],
  mobilityNotes: "", specialInstructions: "", recurrence: "none", recurrenceEndDate: "",
  billingSource: "account", createAccount: false, blackTie: false,
};

const inputCls = "w-full bg-card border border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function EmbedRequestForm() {
  const { token } = Route.useParams();
  const loaderData = Route.useLoaderData() as { providerName: string };
  const submit = useServerFn(submitRideRequest);
  const [form, setForm] = useState<RideRequestInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const upd = <K extends keyof RideRequestInput>(k: K, v: RideRequestInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const withToken = { ...form, embedToken: token };
    const parsed = rideRequestSchema.safeParse(withToken);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] = i.message;
      setErrors(errs);
      toast.error("Please fix highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({ data: parsed.data });
      if (res.ok) { setDone(true); setForm(empty); toast.success("Request submitted"); }
      else toast.error(res.error ?? "Could not submit");
    } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-extrabold mb-2">Request received</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {loaderData.providerName} will contact you shortly to confirm your ride.
        </p>
        <button onClick={() => setDone(false)} className="text-sm font-bold text-primary hover:underline">Book another ride</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold">Request a Ride</h1>
        <p className="text-xs text-muted-foreground">Booked through {loaderData.providerName}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="First name*" className={inputCls} value={form.patientFirstName} onChange={(e) => upd("patientFirstName", e.target.value)} />
          <input required placeholder="Last name*" className={inputCls} value={form.patientLastName} onChange={(e) => upd("patientLastName", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Phone*" className={inputCls} value={form.patientPhone} onChange={(e) => upd("patientPhone", e.target.value)} />
          <input placeholder="Email" className={inputCls} value={form.patientEmail} onChange={(e) => upd("patientEmail", e.target.value)} />
        </div>
        <input required placeholder="Pickup address*" className={inputCls} value={form.pickupAddress} onChange={(e) => upd("pickupAddress", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select required className={inputCls} value={form.pickupCity} onChange={(e) => upd("pickupCity", e.target.value)}>
            <option value="">Pickup city*</option>
            {CITY_LIST.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
          </select>
          <input required type="date" className={inputCls} value={form.pickupDate} onChange={(e) => upd("pickupDate", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect required className={inputCls} value={form.pickupTime} onChange={(v) => upd("pickupTime", v)} />
          <TimeSelect placeholder="Appointment time" className={inputCls} value={form.appointmentTime ?? ""} onChange={(v) => upd("appointmentTime", v)} />
        </div>
        <input required placeholder="Drop-off address*" className={inputCls} value={form.dropoffAddress} onChange={(e) => upd("dropoffAddress", e.target.value)} />
        <select required className={inputCls} value={form.dropoffCity} onChange={(e) => upd("dropoffCity", e.target.value)}>
          <option value="">Drop-off city*</option>
          {CITY_LIST.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
        </select>
        <select className={inputCls} value={form.transportType} onChange={(e) => upd("transportType", e.target.value as any)}>
          <option value="ambulatory">Ambulatory</option>
          <option value="wheelchair">Wheelchair</option>
          <option value="gurney">Gurney</option>
        </select>
        <textarea placeholder="Mobility notes / instructions" className={inputCls} rows={3} value={form.specialInstructions} onChange={(e) => upd("specialInstructions", e.target.value)} />
        {Object.keys(errors).length > 0 && (
          <p className="text-xs text-destructive">Please complete required fields.</p>
        )}
        <button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground font-bold px-4 py-3 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {submitting ? "Submitting…" : "Request Ride"}
        </button>
      </form>
    </div>
  );
}
