import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const EVENT_OPTIONS = [
  { id: "payment.received", label: "Payment received" },
  { id: "payment.failed", label: "Payment failed" },
  { id: "membership.updated", label: "Membership updated" },
  { id: "provider.approved", label: "Provider approved" },
  { id: "report.daily", label: "Daily report" },
  { id: "*", label: "All events (wildcard)" },
];

type Row = {
  id: string;
  label: string;
  url: string;
  signing_secret: string;
  events: string[];
  enabled: boolean;
  description: string | null;
};

export function PlatformWebhooksPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["platform-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_webhook_endpoints" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-2">Admin · integrations</p>
        <h2 className="text-2xl font-extrabold tracking-tight">Platform webhooks</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Register trusted platform-wide outbound webhook subscribers for internal automation,
          payments, notifications, and reporting. <strong>Never</strong> add a subscriber that would
          expose one provider's data to another — provider-scoped events belong in each Provider
          Portal's own webhooks, not here. Signed with HMAC-SHA256 in the
          <code className="mx-1 font-mono">X-Webhook-Signature</code> header.
        </p>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm">Add platform endpoint</button>
      </div>

      {creating && <NewForm onClose={() => setCreating(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["platform-webhooks"] })} />}

      {(q.data ?? []).length === 0 ? (
        <div className="bg-muted/40 border border-border rounded-sm p-4 text-sm text-muted-foreground">No platform webhooks configured.</div>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((row) => <Card key={row.id} row={row} onChange={() => qc.invalidateQueries({ queryKey: ["platform-webhooks"] })} />)}
        </div>
      )}
    </div>
  );
}

function NewForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>(["*"]);

  const save = useMutation({
    mutationFn: async () => {
      if (!/^https:\/\//i.test(url)) throw new Error("URL must start with https://");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("platform_webhook_endpoints" as any).insert({
        label: label.trim(), url: url.trim(), description: description.trim() || null, events, enabled: true, created_by: u.user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Endpoint added"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="bg-card border border-border rounded-sm p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-sm"><span className="font-bold">Label</span><input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background" /></label>
        <label className="block text-sm"><span className="font-bold">HTTPS URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background" /></label>
      </div>
      <label className="block text-sm"><span className="font-bold">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background" placeholder="What is this used for?" /></label>
      <div>
        <span className="font-bold text-sm">Events</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {EVENT_OPTIONS.map((ev) => {
            const on = events.includes(ev.id);
            return (
              <button key={ev.id} type="button" onClick={() => setEvents(on ? events.filter((e) => e !== ev.id) : [...events, ev.id])}
                className={`text-xs font-bold px-3 py-1.5 rounded-sm border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                {ev.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={save.isPending || !label || !url || events.length === 0} onClick={() => save.mutate()} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm disabled:opacity-50">
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button onClick={onClose} className="text-sm font-bold hover:underline">Cancel</button>
      </div>
    </div>
  );
}

function Card({ row, onChange }: { row: Row; onChange: () => void }) {
  const [reveal, setReveal] = useState(false);
  const toggle = useMutation({ mutationFn: async () => {
    const { error } = await supabase.from("platform_webhook_endpoints" as any).update({ enabled: !row.enabled }).eq("id", row.id); if (error) throw error;
  }, onSuccess: onChange });
  const rotate = useMutation({ mutationFn: async () => {
    const { data, error } = await supabase.rpc("gen_webhook_secret" as any); if (error) throw error;
    const { error: u } = await supabase.from("platform_webhook_endpoints" as any).update({ signing_secret: data }).eq("id", row.id); if (u) throw u;
  }, onSuccess: () => { toast.success("Secret rotated"); onChange(); } });
  const del = useMutation({ mutationFn: async () => {
    const { error } = await supabase.from("platform_webhook_endpoints" as any).delete().eq("id", row.id); if (error) throw error;
  }, onSuccess: () => { toast.success("Deleted"); onChange(); } });

  return (
    <div className="bg-card border border-border rounded-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-extrabold truncate">{row.label}</h4>
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-sm ${row.enabled ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{row.enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-1 truncate">{row.url}</div>
          {row.description && <div className="text-xs text-muted-foreground mt-1">{row.description}</div>}
          <div className="mt-2 flex flex-wrap gap-1">{row.events.map((e) => <span key={e} className="text-[10px] font-bold uppercase bg-muted px-2 py-0.5 rounded-sm">{e}</span>)}</div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <button onClick={() => toggle.mutate()} className="text-xs font-bold hover:underline">{row.enabled ? "Disable" : "Enable"}</button>
          <button onClick={() => rotate.mutate()} className="text-xs font-bold hover:underline">Rotate secret</button>
          <button onClick={() => { if (confirm("Delete endpoint?")) del.mutate(); }} className="text-xs font-bold text-destructive hover:underline">Delete</button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="font-bold">Signing secret:</span>
        <code className="font-mono bg-muted px-2 py-1 rounded-sm">{reveal ? row.signing_secret : `${row.signing_secret.slice(0, 12)}••••••••`}</code>
        <button onClick={() => setReveal((s) => !s)} className="font-bold hover:underline">{reveal ? "Hide" : "Reveal"}</button>
        <button onClick={() => { navigator.clipboard.writeText(row.signing_secret); toast.success("Copied"); }} className="font-bold hover:underline">Copy</button>
      </div>
    </div>
  );
}
