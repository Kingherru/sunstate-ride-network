import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { submitContact, contactSchema, type ContactInput } from "@/lib/forms.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — MyFloridaNemt.com" },
      {
        name: "description",
        content:
          "Get in touch with MyFloridaNemt.com. Call (800) 555-0199 or send a message to our dispatch and provider teams.",
      },
      { property: "og:title", content: "Contact MyFloridaNemt.com" },
      { property: "og:description", content: "Talk to our dispatch and provider teams." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const inputCls =
  "w-full bg-card border border-input rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40";

function ContactPage() {
  const submit = useServerFn(submitContact);
  const [form, setForm] = useState<ContactInput>({ name: "", email: "", phone: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({ data: parsed.data });
      if (res.ok) {
        setDone(true);
        toast.success("Message sent. We'll be in touch.");
      } else toast.error(res.error);
    } catch (err) {
      console.error(err);
      toast.error("Could not send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="py-20 lg:py-28 px-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.3fr] gap-16">
        <div>
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Contact
          </p>
          <h1 className="text-5xl font-extrabold tracking-tighter mb-6">Talk to us.</h1>
          <p className="text-muted text-lg mb-10">
            Dispatch is staffed 24/7. For same-day rides, the phone is fastest.
          </p>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted mb-2">
                Phone — 24/7 Dispatch
              </p>
              <a href="tel:8005550199" className="text-2xl font-extrabold text-primary font-mono">
                (800) 555-0199
              </a>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted mb-2">
                Email
              </p>
              <a href="mailto:myfloridanemt@gmail.com" className="text-lg font-bold text-primary">
                myfloridanemt@gmail.com
              </a>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted mb-2">
                Main Hub
              </p>
              <p className="text-lg font-bold">Orlando, Florida</p>
              <p className="text-sm text-muted">Serving statewide</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 lg:p-10">
          {done ? (
            <div className="py-12 text-center">
              <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-4">
                Message sent
              </p>
              <h2 className="text-3xl font-extrabold tracking-tighter mb-4">Thanks — we got it.</h2>
              <p className="text-muted">We'll reply within one business day.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <h2 className="text-2xl font-extrabold tracking-tighter mb-2">Send a message</h2>
              <input className={inputCls} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className={inputCls} type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="Subject (optional)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <textarea className={`${inputCls} min-h-[140px]`} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
