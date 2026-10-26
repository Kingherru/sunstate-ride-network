import { useState } from "react";
import { ArrowLeft, MessageSquare, X } from "lucide-react";
import { DsButton } from "@/components/ds/controls";

/** Explicit opt-in examples: in-memory only, never mixed into real queries. */
export function SampleConversations({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [visible, setVisible] = useState(initiallyOpen);
  const [selected, setSelected] = useState<number | null>(null);
  const samples = [
    { name: "Coastal Transport (Example)", subject: "Network introduction", messages: ["Hello, our team serves the Tampa Bay area. Are you accepting new business connections?", "Yes, we are happy to discuss coverage and availability. Please keep introductions free of patient information."] },
    { name: "Account Support (Example)", subject: "Schedule question", messages: ["Where can I review my upcoming transportation requests?", "Your trip history lists requests and their current status. Please contact your assigned provider for schedule changes."] },
  ];
  if (!visible) return <DsButton variant="ghost" size="sm" onClick={() => setVisible(true)}><MessageSquare className="size-4" aria-hidden />Show example conversations</DsButton>;
  const active = selected === null ? null : samples[selected];
  return <section aria-label="Example conversations" className="mb-5 rounded-ds border border-ds-primary/15 bg-ds-sky p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="ds-subheading text-ds-primary">Example conversations</h3><DsButton variant="ghost" size="sm" onClick={() => { setVisible(false); setSelected(null); }}><X className="size-4" aria-hidden />Remove examples</DsButton></div>
    <p className="ds-support mb-4 text-ds-text-2">Sample messages only — not sent to anyone.</p>
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div className={active ? "hidden md:block" : ""}>{samples.map((s, i) => <DsButton key={s.name} variant="ghost" className="mb-2 h-auto w-full flex-col items-start text-left" onClick={() => setSelected(i)}><span>{s.name}</span><span className="ds-support font-normal">{s.subject}</span></DsButton>)}</div>
      <div className={active ? "min-w-0" : "hidden md:block"}>{active ? <><DsButton variant="ghost" size="sm" className="mb-3 md:hidden" onClick={() => setSelected(null)}><ArrowLeft className="size-4" aria-hidden />Back to conversations</DsButton><h4 className="ds-label mb-3">{active.subject}</h4>{active.messages.map((body, i) => <p key={body} className={`ds-body mb-3 rounded-ds-sm p-3 ${i ? "ml-6 bg-ds-surface" : "mr-6 bg-ds-primary-soft"}`}>{body}</p>)}</> : <p className="ds-support p-3 text-ds-text-2">Select an example conversation.</p>}</div>
    </div>
  </section>;
}