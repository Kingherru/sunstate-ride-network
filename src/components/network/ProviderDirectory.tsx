import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, MapPin, BookmarkPlus, BookmarkCheck, Phone, Mail, Truck, CheckCircle2, MessageSquare, ArrowLeft, Clock, IdCard } from "lucide-react";
import { usePortalPreview, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import {
  listNetworkProviders,
  saveNetworkProvider,
  unsaveNetworkProvider,
  type NetworkProviderRow,
} from "@/lib/facility-providers.functions";
import { listMyMessagingWorkspaces, startOrOpenConversation, type MessagingWorkspace } from "@/lib/workspace-messages.functions";
import { cn } from "@/lib/utils";
import { DsButton } from '@/components/ds/controls';

/** Two-panel Provider Network directory: list on the left, selected provider
 *  profile on the right. On phones the list shows first and selecting a
 *  provider opens the profile with a Back to Providers action. */
function capabilityLabels(types: string[]) {
  return Array.from(new Set(types.map((s) => /ambulatory|^amb$/i.test(s) ? "Ambulatory" : /wheelchair|^wc$/i.test(s) ? "Wheelchair" : /gurney|stretcher|^str$/i.test(s) ? "Gurney/Stretcher" : /delivery/i.test(s) ? "Medical Delivery" : /pickup|drop.?off/i.test(s) ? "Pickup and Drop-off" : s)));
}
export function ProviderDirectory({ savedOnly = false, onSelect }: { savedOnly?: boolean; onSelect?: (v: NetworkProviderRow) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listNetworkProviders);
  const saveFn = useServerFn(saveNetworkProvider);
  const unsaveFn = useServerFn(unsaveNetworkProvider);
  const listMineFn = useServerFn(listMyMessagingWorkspaces);
  const startFn = useServerFn(startOrOpenConversation);
  const navigate = useNavigate();
  const preview = usePortalPreview();

  const [search, setSearch] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [medicalDelivery, setMedicalDelivery] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<NetworkProviderRow | null>(null);

  const filters = {
    search: search.trim() || undefined,
    service_type: serviceType.trim() || undefined,
    county: county.trim() || undefined,
    city: city.trim() || undefined,
    zip: zip.trim() || undefined,
    medical_delivery: medicalDelivery || undefined,
    accepting: accepting || undefined,
    saved_only: savedOnly,
  };

  const q = usePortalQuery({
    queryKey: ["network-providers", filters],
    queryFn: async () => {
      const r = await listFn({ data: filters });
      if (!r.ok) throw new Error(r.error);
      return r.results;
    },
  });

  // Workspaces the signed-in user may send network messages for. Never fetched
  // in preview mode — preview renders synthetic pages and makes no server calls.
  const myWorkspacesQuery = usePortalQuery({
    queryKey: ["messaging-workspaces"],
    queryFn: () => listMineFn(),
  });
  const myWorkspaces = (myWorkspacesQuery.data ?? []) as MessagingWorkspace[];
  const senderWorkspace = myWorkspaces[0] ?? null;

  async function toggleSave(row: NetworkProviderRow) {
    try {
      if (row.is_saved) {
        await unsaveFn({ data: { provider_workspace_id: row.workspace_id } });
        toast.success("Removed from saved");
      } else {
        await saveFn({ data: { provider_workspace_id: row.workspace_id } });
        toast.success("Saved to your providers");
      }
      qc.invalidateQueries({ queryKey: ["network-providers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function confirmMessage() {
    if (!messageTarget || !senderWorkspace) return;
    if (preview.active) { previewBlocked(); setMessageTarget(null); return; }
    try {
      const r = await startFn({ data: { senderWorkspaceId: senderWorkspace.id, targetWorkspaceId: messageTarget.workspace_id } });
      setMessageTarget(null);
      navigate({ to: "/portal/messaging", search: { c: r.conversationId } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not start that conversation.");
    }
  }

  const rows = q.data ?? [];
  const selected = rows.find((r) => r.workspace_id === selectedId) ?? null;

  const listPanel = (
    <div className="min-w-0 space-y-2">
      {!savedOnly && (
        <div className="space-y-2 rounded-sm border border-border bg-card p-3">
          <div className="portal-search">
            <Search className="size-4" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by company name" aria-label="Search by company name"
              className="w-full rounded-sm border border-border py-2 pr-3 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Service type" aria-label="Service type" className="w-full rounded-sm border border-border px-3 py-2 text-sm" />
            <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" aria-label="County" className="w-full rounded-sm border border-border px-3 py-2 text-sm" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City" className="w-full rounded-sm border border-border px-3 py-2 text-sm" />
            <input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} placeholder="ZIP" aria-label="ZIP code" className="w-full rounded-sm border border-border px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="inline-flex items-center gap-2 text-xs font-bold">
              <input type="checkbox" checked={medicalDelivery} onChange={(e) => setMedicalDelivery(e.target.checked)} /> Medical delivery
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold">
              <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} /> Accepting connections
            </label>
          </div>
          <p className="text-[11px] italic text-muted-foreground">Distance search isn't available yet — search by county, city or ZIP instead.</p>
        </div>
      )}

      {q.isLoading && <div className="p-3 text-sm text-muted-foreground">Loading…</div>}
      {!q.isLoading && rows.length === 0 && (
        <div className="rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
          {savedOnly ? "No saved providers yet. Use Find providers to search the network and save the ones you want." : "No network providers match these filters yet."}
        </div>
      )}

      <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto rounded-sm border border-border bg-card">
        {rows.map((r) => (
          <li key={r.workspace_id}>
            <button type="button" onClick={() => setSelectedId(r.workspace_id)}
              aria-current={selectedId === r.workspace_id ? "true" : undefined}
              className={cn("block w-full px-3 py-3 text-left hover:bg-muted/60", selectedId === r.workspace_id && "bg-muted")}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-extrabold">{r.business_name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    <CheckCircle2 className="size-3" /> Verified
                  </span>
                  {r.is_saved && <BookmarkCheck className="size-4 text-accent" aria-label="Saved" />}
                </span>
              </div>
              {(r.cities.length > 0 || r.counties.length > 0) && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" /> {[...r.cities, ...r.counties].slice(0, 3).join(", ")}
                </p>
              )}
              {r.service_types.length > 0 && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{capabilityLabels(r.service_types).slice(0, 3).join(", ")}{r.medical_delivery ? " · Medical delivery" : ""}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const profilePanel = selected ? (
    <ProviderProfile
      row={selected}
      canMessage={!onSelect && !preview.active && !!senderWorkspace && senderWorkspace.id !== selected.workspace_id}
      onSelect={onSelect ? () => onSelect(selected) : undefined}
      onMessage={() => setMessageTarget(selected)}
      onToggleSave={() => toggleSave(selected)}
      onBack={() => setSelectedId(null)}
    />
  ) : (
    <div className="hidden rounded-sm border border-border bg-card p-8 text-sm text-muted-foreground lg:block">
      Select a provider from the list to view their business profile.
    </div>
  );

  return (
    <div className="space-y-4">
      {!onSelect && <aside className="rounded-ds border border-ds-peach-border bg-ds-peach p-4 text-ds-primary"><h3 className="ds-label uppercase mb-2">Network Communication & Payment Reminder</h3><p className="ds-body">Communicate professionally and accept only trips you intend to complete. Accepted trips are final and should not be returned. Mark completed trips promptly and complete all required payments. Following these rules helps providers earn Super Verification and avoid account suspension or removal.</p></aside>}
      {/* Desktop: list left, profile right. Mobile: list first, profile replaces it. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(selected && "hidden lg:block")}>{listPanel}</div>
        <div className={cn("min-w-0", !selected && "hidden lg:block")}>{profilePanel}</div>
      </div>

      {messageTarget && senderWorkspace && (
        <MessageConfirmDialog
          sender={senderWorkspace}
          target={messageTarget}
          onCancel={() => setMessageTarget(null)}
          onConfirm={confirmMessage}
        />
      )}
    </div>
  );
}

/** Authorized public business profile only: no insurance files, policy
 *  numbers, home addresses, private contacts, driver records, patient
 *  information, internal pricing or payout data. */
function ProviderProfile({ row, canMessage, onMessage, onToggleSave, onBack, onSelect }: {
  row: NetworkProviderRow; canMessage: boolean; onMessage: () => void; onToggleSave: () => void; onBack: () => void; onSelect?: () => void;
}) {
  const services = capabilityLabels(row.service_types);
  if (row.medical_delivery && !services.some((s) => /delivery/i.test(s))) services.push("Medical Delivery");
  return (
    <article className="rounded-sm border border-border bg-card p-5">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary hover:underline lg:hidden">
        <ArrowLeft className="size-4" /> Back to Providers
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold">{row.business_name}</h3>
          {row.mfn_id && (
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><IdCard className="size-3.5" /> {row.mfn_id}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              <CheckCircle2 className="size-3" /> Verified
            </span>
            {row.medical_delivery && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                <Truck className="size-3" /> Medical delivery
              </span>
            )}
            {!row.accepting_connections && (
              <span className="rounded-sm bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">Not accepting</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onSelect && <DsButton type="button" size="sm" onClick={onSelect} disabled={!row.accepting_connections}>Select this provider</DsButton>}
          {canMessage && (
            <button onClick={onMessage} className="inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-bold hover:bg-muted">
              <MessageSquare className="size-4" /> Message provider
            </button>
          )}
          <button onClick={onToggleSave}
            className={cn("inline-flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-bold", row.is_saved ? "border border-border hover:bg-muted" : "bg-accent text-accent-foreground hover:bg-accent/90")}>
            {row.is_saved ? <><BookmarkCheck className="size-4" /> Remove from saved</> : <><BookmarkPlus className="size-4" /> Save provider</>}
          </button>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {(row.cities.length > 0 || row.counties.length > 0) && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Location</dt>
            <dd className="mt-0.5 flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" /> {[...row.cities, ...row.counties].slice(0, 4).join(", ")}</dd></div>
        )}
        {row.counties.length > 0 && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Service areas</dt><dd className="mt-0.5">{row.counties.join(", ")}</dd></div>
        )}
        {row.hours && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Operating days & hours</dt>
            <dd className="mt-0.5 flex items-center gap-1.5"><Clock className="size-3.5 shrink-0" /> {row.hours}</dd></div>
        )}
        {services.length > 0 && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Services</dt><dd className="mt-1 flex flex-wrap gap-1.5">{services.map((service) => <span key={service} className="rounded-ds-sm border border-ds-sky-border bg-ds-sky px-2 py-1 ds-caption text-ds-primary">{service}</span>)}</dd></div>
        )}
        <div><dt className="text-xs font-bold uppercase text-muted-foreground">Accepting Connections</dt><dd>{row.accepting_connections ? "Yes" : "No"}</dd></div>
        {row.business_contact_phone && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Business phone</dt>
            <dd className="mt-0.5"><a href={`tel:${row.business_contact_phone}`} className="inline-flex items-center gap-1.5 font-bold hover:underline"><Phone className="size-3.5" /> {row.business_contact_phone}</a></dd></div>
        )}
        {row.business_contact_email && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Business email</dt>
            <dd className="mt-0.5"><a href={`mailto:${row.business_contact_email}`} className="inline-flex items-center gap-1.5 break-all hover:underline"><Mail className="size-3.5 shrink-0" /> {row.business_contact_email}</a></dd></div>
        )}
      </dl>
      {row.description && <p className="mt-4 border-t border-border pt-4 text-sm text-foreground">{row.description}</p>}
    </article>
  );
}

function MessageConfirmDialog({ sender, target, onCancel, onConfirm }: {
  sender: MessagingWorkspace; target: NetworkProviderRow; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="message-provider-title" aria-describedby="message-provider-desc"
        className="w-full max-w-md rounded-sm border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h2 id="message-provider-title" className="text-base font-extrabold">Start a conversation?</h2>
        <p id="message-provider-desc" className="mt-2 text-sm text-muted-foreground">
          You'll message as <span className="font-bold text-foreground">{sender.name}</span> to{" "}
          <span className="font-bold text-foreground">{target.business_name}</span>
          {target.mfn_id && <> (MFN ID: <span className="font-mono">{target.mfn_id}</span>)</>}.
          If a conversation between your businesses already exists, it opens instead of creating a duplicate.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Do not include patient or protected health information in network introduction messages.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button autoFocus onClick={onCancel} className="rounded-sm border border-border px-3 py-2 text-xs font-bold hover:bg-muted">Cancel</button>
          <button onClick={onConfirm} className="rounded-sm bg-accent px-3 py-2 text-xs font-bold text-accent-foreground hover:bg-accent/90">Start conversation</button>
        </div>
      </div>
    </div>
  );
}
