import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listIntegrations, upsertIntegration, deleteIntegration } from "@/lib/integrations.functions";
import { EmbedCodePanel } from "./EmbedCodePanel";
import { ProviderWebhooksPanel } from "./ProviderWebhooksPanel";

type Vendor = "hibambi" | "routegenie" | "duetride";

const VENDORS: { id: Vendor; label: string; blurb: string }[] = [
  { id: "duetride", label: "Duet", blurb: "Send trips to Duet and receive driver arrival, pickup, drop-off and completion updates back automatically." },
  { id: "hibambi", label: "hiBambi", blurb: "Push outbound trips and ingest inbound trips from hiBambi." },
  { id: "routegenie", label: "RouteGenie", blurb: "Push outbound trips and ingest inbound trips from RouteGenie." },
];

const DUET_EVENT_SLUGS = [
  "ride-scheduled", "ride-unscheduled", "will-call-initiated", "on-the-way",
  "pickup-arrived", "pickup-completed", "dropoff-arrived", "dropoff-completed",
  "ride-canceled", "ride-rejected", "no-show", "gps-event",
];

export function IntegrationsPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["integrations"],
    queryFn: () => listIntegrations(),
  });
  const items = q.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">External integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect your dispatch software so trips you send/receive on My Florida NEMT sync automatically.
          Inbound webhooks reject all payloads until a verified signature scheme is wired for the vendor.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {VENDORS.map((v) => {
          const existing = items.find((i: any) => i.vendor === v.id);
          return (
            <VendorCard
              key={v.id}
              vendor={v.id}
              label={v.label}
              blurb={v.blurb}
              existing={existing}
              onChange={() => qc.invalidateQueries({ queryKey: ["integrations"] })}
            />
          );
        })}
      </div>
      <div className="bg-muted/40 border border-border rounded-sm p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-bold text-foreground mb-1">Webhook URLs (give these to the vendor):</p>
        <p>Inbound hiBambi: <code className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/integrations/hibambi/webhook</code></p>
        <p>Inbound RouteGenie: <code className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/integrations/routegenie/webhook</code></p>
        <p className="pt-2 font-bold text-foreground">Duet event endpoints (one per event, Bearer = your webhook secret):</p>
        <p className="font-mono break-all">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/integrations/duet/events/&#123;event&#125;
        </p>
        <p>Events: {DUET_EVENT_SLUGS.join(", ")}</p>
      </div>

      <EmbedCodePanel />
      <div className="border-t border-border pt-6">
        <ProviderWebhooksPanel />
      </div>
    </div>
  );
}

function VendorCard({ vendor, label, blurb, existing, onChange }: {
  vendor: Vendor; label: string; blurb: string; existing: any; onChange: () => void;
}) {
  const isDuet = vendor === "duetride";
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [tpId, setTpId] = useState(String(existing?.config?.transportationProviderId ?? ""));
  const [baseUrl, setBaseUrl] = useState(String(existing?.config?.baseUrl ?? ""));
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);

  const save = useMutation({
    mutationFn: () => upsertIntegration({
      data: {
        vendor,
        api_key: apiKey,
        webhook_secret: webhookSecret || undefined,
        enabled,
        config: isDuet
          ? {
              transportationProviderId: tpId.trim(),
              baseUrl: baseUrl.trim() || undefined,
              ...(apiSecret ? { apiSecret } : {}),
            }
          : undefined,
      },
    }),
    onSuccess: () => { toast.success(`${label} saved`); setApiKey(""); setWebhookSecret(""); setApiSecret(""); onChange(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });
  const remove = useMutation({
    mutationFn: () => deleteIntegration({ data: { vendor } }),
    onSuccess: () => { toast.success(`${label} disconnected`); onChange(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="bg-card border border-border rounded-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-extrabold">{label}</h3>
        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-sm ${existing?.enabled ? "bg-accent/15 text-accent" : existing ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
          {existing ? (existing.enabled ? "Connected" : "Saved") : "Not connected"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{blurb}</p>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="font-bold">API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={existing ? "•••••••• (saved)" : "Paste API key"}
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background"
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold">Webhook secret (optional)</span>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={existing?.webhook_secret ? "•••••••• (saved)" : "For verifying inbound webhooks"}
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background"
          />
        </label>
        {isDuet && (
          <>
            <label className="block text-sm">
              <span className="font-bold">API secret</span>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={existing?.config?.apiSecretEncrypted ? "•••••••• (saved)" : "Duet apiSecret"}
                className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background"
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold">Transportation provider ID</span>
              <input
                value={tpId}
                onChange={(e) => setTpId(e.target.value)}
                placeholder="Your Duet transportation provider ID"
                className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background"
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold">API base URL (optional)</span>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.duetride.com"
                className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-background"
              />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable sync
        </label>
        <div className="flex gap-2">
          <button
            disabled={save.isPending || !apiKey}
            onClick={() => save.mutate()}
            className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : existing ? "Update" : "Connect"}
          </button>
          {existing && (
            <button
              disabled={remove.isPending}
              onClick={() => { if (confirm(`Disconnect ${label}?`)) remove.mutate(); }}
              className="text-sm font-bold text-destructive hover:underline"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
