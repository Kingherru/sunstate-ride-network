import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { pageHead, PageHero } from "@/components/public/page-kit";
import { DsButton, DsField, DsInput, DsSelect, DsTextarea } from "@/components/ds/controls";
import { submitContact } from "@/lib/forms.functions";

export const Route = createFileRoute("/contact")({
  head: () => pageHead("/contact", "Contact Us | MY FLORIDA NEMT", "Send MY FLORIDA NEMT a business inquiry, report a website problem or ask a general question.", "Contact Us"),
  component: ContactPage,
});

const CATEGORIES = [
  { value: "business_inquiry", label: "New business inquiry" },
  { value: "website_problem", label: "Website problem" },
  { value: "general_question", label: "General question" },
] as const;

function ContactPage() {
  const send = useServerFn(submitContact);
  const [f, setF] = useState({ category: "general_question", name: "", businessName: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy"); setErr("");
    try {
      const r = await send({ data: f });
      if (r.ok) setState("done"); else { setState("error"); setErr(r.error); }
    } catch { setState("error"); setErr("Please check the form and try again."); }
  }

  return (
    <>
      <PageHero crumb="Contact Us" showCrumbs title="CONTACT US" intro="Business inquiries, website problems and general questions." />
      <section className="bg-ds-sky py-12">
        <div className="mx-auto max-w-2xl px-4">
          {state === "done" ? (
            <div role="status" className="rounded-ds border border-ds-border bg-ds-surface p-6"><h2 className="ds-subheading uppercase text-ds-primary">Message received</h2><p className="mt-2">Thank you. Our team will review your message.</p></div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4 rounded-ds border border-ds-border bg-ds-surface p-6" noValidate={false}>
              <p role="note" className="rounded-ds-sm border border-ds-border bg-ds-sky p-3 ds-support">Please do not include medical information, diagnoses, patient names or trip details. To request a ride, use Book a Trip.</p>
              <DsField label="What is this about?">{(p) => <DsSelect {...p} value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</DsSelect>}</DsField>
              <div className="grid gap-4 sm:grid-cols-2">
                <DsField label="Name">{(p) => <DsInput {...p} required maxLength={120} value={f.name} onChange={set("name")} autoComplete="name" />}</DsField>
                <DsField label="Business name (if applicable)">{(p) => <DsInput {...p} maxLength={160} value={f.businessName} onChange={set("businessName")} autoComplete="organization" />}</DsField>
                <DsField label="Email">{(p) => <DsInput {...p} type="email" required maxLength={200} value={f.email} onChange={set("email")} autoComplete="email" />}</DsField>
                <DsField label="Phone (optional)">{(p) => <DsInput {...p} type="tel" maxLength={30} value={f.phone} onChange={set("phone")} autoComplete="tel" />}</DsField>
              </div>
              <DsField label="Subject">{(p) => <DsInput {...p} required maxLength={200} value={f.subject} onChange={set("subject")} />}</DsField>
              <DsField label="Message">{(p) => <DsTextarea {...p} required minLength={5} maxLength={2000} rows={6} value={f.message} onChange={set("message")} />}</DsField>
              <div aria-hidden className="hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label></div>
              {state === "error" && <p role="alert" className="text-ds-error">{err}</p>}
              <DsButton type="submit" disabled={state === "busy"}>{state === "busy" ? "SENDING…" : "SEND MESSAGE"}</DsButton>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
