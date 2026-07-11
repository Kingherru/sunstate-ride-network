import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const EVENT_OPTIONS = [
  { id: "trip.assigned", label: "Trip assigned to you" },
  { id: "trip.status_changed", label: "Trip status changed" },
  { id: "driver.updated", label: "Driver updated" },
  { id: "reservation.created", label: "Reservation created" },
  { id: "*", label: "All events (wildcard)" },
];

type Row = {
  id: string;
  provider_user_id: string;
  label: string;
  url: string;
  signing_secret: string;
  events: string[];
  enabled: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
};

export function ProviderWebhooksPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["provider-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_webhook_endpoints" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold">Your webhook endpoints</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Register outbound webhooks to receive real-time events about <strong>your</strong> trips,
            drivers, and reservations only. Data is strictly isolated — you will never receive events
            belonging to another provider. Each endpoint gets a unique signing secret; verify the
            <code className="mx-1 font-mono">X-Webhook-Signature</code> HMAC-SHA256 header on every request.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="whitespace-nowrap bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90"
        >
          Add endpoint
        </button>
      </div>

      {showNew && <NewEndpointForm onClose={() => setShowNew(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["provider-webhooks"] })} />}

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="bg-muted/40 border border-border rounded-sm p-4 text-sm text-muted-foreground">
          No webhook endpoints configured.
        </div>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((row) => (
            <EndpointCard key={row.id} row={row} onChange={() => qc.invalidateQueries({ queryKey: ["provider-webhooks"] })} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewEndpointForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["trip.assigned"]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!/^https:\/\//i.test(url)) throw new Error("URL must start with https://");
      const { error } = await supabase.from("provider_webhook_endpoints" as any).insert({
        provider_user_id: u.user.id,
        label: label.trim(),
        url: url.trim(),
        events,
        enabled: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Endpoint added"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="bg-card border border-border rounded-sm p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-bold">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background" placeholder="e.g. Internal ops sync" />
        </label>
        <label className="block text-sm">
          <span className="font-bold">HTTPS URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background" placeholder="https://example.com/webhook" />
        </label>
      </div>
      <div>
        <span className="font-bold text-sm">Events</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {EVENT_OPTIONS.map((ev) => {
            const on = events.includes(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => setEvents(on ? events.filter((e) => e !== ev.id) : [...events, ev.id])}
                className={`text-xs font-bold px-3 py-1.5 rounded-sm border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
              >
                {ev.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={save.isPending || !label || !url || events.length === 0} onClick={() => save.mutate()} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm disabled:opacity-50">
          {save.isPending ? "Saving…" : "Save endpoint"}
        </button>
        <button onClick={onClose} className="text-sm font-bold hover:underline">Cancel</button>
      </div>
    </div>
  );
}

function EndpointCard({ row, onChange }: { row: Row; onChange: () => void }) {
  const [showSecret, setShowSecret] = useState(false);
  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("provider_webhook_endpoints" as any).update({ enabled: !row.enabled }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e: any) => toast.error(e.message),
  });
  const rotate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gen_webhook_secret" as any);
      if (error) throw error;
      const { error: uErr } = await supabase.from("provider_webhook_endpoints" as any).update({ signing_secret: data }).eq("id", row.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => { toast.success("Secret rotated"); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("provider_webhook_endpoints" as any).delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-extrabold truncate">{row.label}</h4>
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-sm ${row.enabled ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
              {row.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-1 truncate">{row.url}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {row.events.map((e) => (
              <span key={e} className="text-[10px] font-bold uppercase bg-muted px-2 py-0.5 rounded-sm">{e}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <button onClick={() => toggle.mutate()} className="text-xs font-bold hover:underline">
            {row.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => rotate.mutate()} className="text-xs font-bold hover:underline">Rotate secret</button>
          <button onClick={() => { if (confirm("Delete endpoint?")) del.mutate(); }} className="text-xs font-bold text-destructive hover:underline">Delete</button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="font-bold">Signing secret:</span>
        <code className="font-mono bg-muted px-2 py-1 rounded-sm">
          {showSecret ? row.signing_secret : `${row.signing_secret.slice(0, 12)}••••••••`}
        </code>
        <button onClick={() => setShowSecret((s) => !s)} className="font-bold hover:underline">
          {showSecret ? "Hide" : "Reveal"}
        </button>
        <button onClick={() => { navigator.clipboard.writeText(row.signing_secret); toast.success("Copied"); }} className="font-bold hover:underline">Copy</button>
      </div>
    </div>
  );
}
