import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  submitProviderApplication,
  providerApplicationSchema,
  type ProviderApplicationInput,
} from "@/lib/forms.functions";
import { DOC_FIELDS, type DocKind } from "@/lib/provider-docs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "Become an NEMT Provider — Florida NEMT" },
      {
        name: "description",
        content:
          "Apply to join the Florida NEMT provider network. Upload your driver license, insurance, W-9, EIN letter, NPI, agreements, and vehicle photos. Get categorized by your service area and onboarded statewide.",
      },
      { property: "og:title", content: "Join the Florida NEMT Provider Network" },
      { property: "og:description", content: "Register your NEMT company, upload credentials, and start receiving trips." },
      { property: "og:url", content: "/providers" },
    ],
    links: [{ rel: "canonical", href: "/providers" }],
  }),
  component: ProvidersPage,
});

const inputCls =
  "w-full bg-card border border-input rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

const empty: ProviderApplicationInput = {
  firstName: "",
  lastName: "",
  email: "",
  dispatchEmail: "",
  phone: "",
  companyName: "",
  city: "",
  county: "",
  zipCode: "",
  preferredZipCodes: [],
  serviceTypes: ["ambulatory"],
  fleetSize: undefined,
  ein: "",
  npi: "",
  driverLicenseNumber: "",
  insuranceCarrier: "",
  insurancePolicyNumber: "",
  notes: "",
  documents: [],
};

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = /\.(pdf|jpe?g|png|webp|heic)$/i;
const CATEGORIES = ["Identity & Tax", "Insurance & Vehicle", "Agreements", "Photos"] as const;

function ProvidersPage() {
  const submit = useServerFn(submitProviderApplication);
  const [form, setForm] = useState<ProviderApplicationInput>(empty);
  const [zipInput, setZipInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [done, setDone] = useState(false);

  const toggleType = (t: "ambulatory" | "wheelchair" | "gurney") =>
    setForm((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(t)
        ? f.serviceTypes.filter((x) => x !== t)
        : [...f.serviceTypes, t],
    }));

  function addZips(raw: string) {
    const zips = raw
      .split(/[\s,]+/)
      .map((z) => z.trim())
      .filter((z) => /^\d{5}$/.test(z));
    if (zips.length === 0) return;
    setForm((f) => ({
      ...f,
      preferredZipCodes: Array.from(new Set([...f.preferredZipCodes, ...zips])).slice(0, 40),
    }));
    setZipInput("");
  }

  function removeZip(zip: string) {
    setForm((f) => ({ ...f, preferredZipCodes: f.preferredZipCodes.filter((z) => z !== zip) }));
  }

  async function handleFile(kind: DocKind, file: File) {
    if (!ALLOWED.test(file.name)) {
      toast.error("Only PDF, JPG, PNG, WEBP, or HEIC files are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be under 15 MB.");
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const id = crypto.randomUUID();
      const path = `applications/${new Date().toISOString().slice(0, 10)}/${id}-${kind}.${ext}`;
      const { error } = await supabase.storage.from("provider-docs").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) throw error;
      setForm((f) => ({
        ...f,
        documents: [
          ...f.documents.filter((d) => d.kind !== kind),
          { kind, path, filename: file.name, size: file.size },
        ],
      }));
      toast.success(`${file.name} uploaded.`);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  function removeDoc(kind: DocKind) {
    setForm((f) => ({ ...f, documents: f.documents.filter((d) => d.kind !== kind) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = providerApplicationSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form.");
      return;
    }
    const missing = DOC_FIELDS.filter((d) => d.required).find(
      (d) => !form.documents.some((doc) => doc.kind === d.kind),
    );
    if (missing) {
      toast.error(`Please upload your ${missing.label}.`);
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
    <section className="py-20 lg:py-28 px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_1.4fr] gap-16 items-start">
        <div className="lg:sticky lg:top-28">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            For NEMT Providers
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter mb-6">
            Join Florida's NEMT network.
          </h1>
          <p className="text-lg text-muted max-w-xl mb-10">
            Upload your credentials once. We categorize your company by city, county, and ZIP,
            verify documents, and start routing trips to your fleet.
          </p>
          <ul className="space-y-4 mb-10">
            {[
              "Auto-categorized by your city, county, and preferred ZIPs",
              "Secure document vault — license, insurance, W-9, EIN, NPI",
              "Required agreements: non-compete, NDA, HIPAA",
              "Statewide trip volume from one application",
            ].map((b) => (
              <li key={b} className="flex gap-4 text-base">
                <span className="mt-2 size-2 rounded-full bg-accent shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/training"
            className="font-bold text-primary underline underline-offset-8 hover:text-accent"
          >
            See required training →
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 lg:p-10">
          {done ? (
            <div className="py-12 text-center">
              <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-4">
                Application received
              </p>
              <h2 className="text-3xl font-extrabold tracking-tighter mb-4">
                Thanks — we'll be in touch.
              </h2>
              <p className="text-muted">
                Your documents are securely stored. A network onboarding lead will reach out within
                2 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-8">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tighter">Provider application</h2>
                <p className="text-sm text-muted mt-1">
                  All info encrypted in transit. Documents stored privately.
                </p>
              </div>

              <fieldset className="space-y-4">
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
                  Basic information
                </legend>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className={inputCls}
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
                <input
                  className={inputCls}
                  type="tel"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Email (login / primary contact)"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Dispatch email (where ride requests go)"
                  value={form.dispatchEmail ?? ""}
                  onChange={(e) => setForm({ ...form, dispatchEmail: e.target.value })}
                />
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
                  Company & service area
                </legend>
                <input
                  className={inputCls}
                  placeholder="Legal company name"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className={inputCls}
                    placeholder="Primary city (e.g. Orlando)"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="County (e.g. Orange)"
                    value={form.county ?? ""}
                    onChange={(e) => setForm({ ...form, county: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className={inputCls}
                    placeholder="ZIP code (5 digits)"
                    inputMode="numeric"
                    maxLength={5}
                    value={form.zipCode}
                    onChange={(e) => setForm({ ...form, zipCode: e.target.value.replace(/\D/g, "") })}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    placeholder="Fleet size"
                    value={form.fleetSize ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fleetSize: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted mb-2 block">
                    Preferred ZIP codes you'll serve
                  </label>
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="e.g. 32801, 32803, 32806"
                      value={zipInput}
                      onChange={(e) => setZipInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addZips(zipInput);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addZips(zipInput)}
                      className="px-4 py-3 border border-primary text-primary text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-primary hover:text-primary-foreground transition"
                    >
                      Add
                    </button>
                  </div>
                  {form.preferredZipCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {form.preferredZipCodes.map((z) => (
                        <button
                          type="button"
                          key={z}
                          onClick={() => removeZip(z)}
                          className="text-xs font-mono px-2 py-1 bg-primary/10 text-primary rounded-sm hover:bg-primary/20"
                        >
                          {z} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
                  Service types
                </legend>
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
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
                  Credentials
                </legend>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className={inputCls}
                    placeholder="Business EIN"
                    value={form.ein ?? ""}
                    onChange={(e) => setForm({ ...form, ein: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="NPI (if any)"
                    value={form.npi ?? ""}
                    onChange={(e) => setForm({ ...form, npi: e.target.value })}
                  />
                </div>
                <input
                  className={inputCls}
                  placeholder="Driver's license number"
                  value={form.driverLicenseNumber ?? ""}
                  onChange={(e) => setForm({ ...form, driverLicenseNumber: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    className={inputCls}
                    placeholder="Insurance carrier"
                    value={form.insuranceCarrier ?? ""}
                    onChange={(e) => setForm({ ...form, insuranceCarrier: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="Policy number"
                    value={form.insurancePolicyNumber ?? ""}
                    onChange={(e) => setForm({ ...form, insurancePolicyNumber: e.target.value })}
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-5">
                <legend className="text-xs font-bold uppercase tracking-widest text-muted mb-1">
                  Documents
                </legend>
                <p className="text-xs text-muted -mt-1">
                  PDF, JPG, PNG, WEBP, or HEIC · 15 MB max each. * = required.
                </p>
                {CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                      {cat}
                    </p>
                    <div className="space-y-2">
                      {DOC_FIELDS.filter((d) => d.category === cat).map((d) => {
                        const uploaded = form.documents.find((x) => x.kind === d.kind);
                        return (
                          <div
                            key={d.kind}
                            className="flex items-center justify-between gap-3 border border-border rounded-sm p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {d.label}{" "}
                                {d.required && <span className="text-accent">*</span>}
                              </p>
                              <p className="text-xs text-muted truncate">
                                {uploaded ? uploaded.filename : d.hint ?? "Not uploaded"}
                              </p>
                            </div>
                            {uploaded ? (
                              <button
                                type="button"
                                onClick={() => removeDoc(d.kind)}
                                className="text-xs font-bold uppercase tracking-widest text-accent hover:underline shrink-0"
                              >
                                Remove
                              </button>
                            ) : (
                              <label
                                className={`text-xs font-bold uppercase tracking-widest px-3 py-2 border border-primary text-primary rounded-sm cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all shrink-0 ${
                                  uploading === d.kind ? "opacity-60 pointer-events-none" : ""
                                }`}
                              >
                                {uploading === d.kind ? "Uploading…" : "Upload"}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleFile(d.kind, f);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </fieldset>

              <textarea
                className={`${inputCls} min-h-[90px]`}
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <button
                type="submit"
                disabled={submitting || uploading !== null}
                className="w-full px-6 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
