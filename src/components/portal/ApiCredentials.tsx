import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DsButton } from "@/components/ds/controls";
import { listApiCredentials, createApiCredential, renameApiCredential, rotateApiCredential, revokeApiCredential } from "@/lib/provider-ops.functions";
import { usePortalQuery, usePortalPreview } from "./preview-data";

const SCOPES = [{ v: "exports:read", l: "Read exports" }, { v: "schedule:read", l: "Read schedule" }] as const;

/** Owner/admin-only API credentials. The full secret is shown once; only a hash is stored. Keys do not imply a connected vendor. */
export function ApiCredentials() {
  const preview = usePortalPreview(); const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["api-credentials"], queryFn: () => listApiCredentials() });
  const [name, setName] = useState(""); const [scopes, setScopes] = useState<string[]>(["exports:read"]);
  const [secret, setSecret] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const d = q.data as Awaited<ReturnType<typeof listApiCredentials>> | undefined;
  const refresh = () => qc.invalidateQueries({ queryKey: ["api-credentials"] });
  async function run(fn: () => Promise<unknown>, ok: string) {
    if (preview.active) { toast.info("Preview only — no key was created."); return; }
    setBusy(true); try { const r: any = await fn(); if (r?.secret) setSecret(r.secret); toast.success(ok); refresh(); } catch { toast.error("This action is unavailable."); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-ds border border-ds-sky-border bg-ds-sky p-4">
    <h2 className="ds-subheading uppercase text-ds-primary">API credentials</h2>
    <p className="ds-support">Keys are read-only and limited to exports and schedule data. A key alone does not mean any dispatch software is connected.</p>
    {secret && <div role="alert" className="space-y-2 rounded-ds border border-ds-action bg-ds-surface p-3">
      <p className="ds-label text-ds-primary">Copy and store this key now. It will never be shown again.</p>
      <code className="block break-all rounded-ds-sm bg-ds-sky p-2 text-xs">{secret}</code>
      <div className="flex gap-2"><DsButton variant="secondary" onClick={() => navigator.clipboard?.writeText(secret).then(() => toast.success("Copied"))}>Copy</DsButton><DsButton variant="ghost" onClick={() => setSecret(null)}>I saved it</DsButton></div>
    </div>}
    <details className="rounded-ds border border-ds-sky-border bg-ds-sky p-3">
      <summary className="ds-label cursor-pointer text-ds-primary">API documentation (read-only, version 2026-11-v1)</summary>
      <div className="mt-2 space-y-2 ds-support break-words">
        <p>Send your key only in the header <code>Authorization: Bearer &lt;key&gt;</code>. Keys in web addresses are refused. Your business is responsible for protecting and rotating its key; revoke it here immediately if exposed.</p>
        <p><strong>Read schedule</strong> (schedule:read): <code>GET /api/public/provider/v1/schedule?start=YYYY-MM-DD&amp;end=YYYY-MM-DD&amp;page=1&amp;page_size=100</code> — JSON list of your business's trips: reference, date/time, trip type, service, status, assignment, driver, vehicle, pickup and destination.</p>
        <p><strong>Read exports</strong> (exports:read): <code>GET /api/public/provider/v1/exports/trips?start=…&amp;end=…</code> — the same fields as CSV. Excel and PDF stay available from the export buttons in the portal.</p>
        <p>Ranges up to 31 days, up to 200 rows per page, 60 requests per minute per key. No diagnosis, notes, billing, payment, documents or other businesses' records are ever returned. Creating a key does not mean any dispatch software is connected.</p>
      </div>
    </details>
    {d && !d.allowed ? <p className="ds-support">API credentials can be managed by provider workspace owners and admins only.</p> : <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="ds-label">Integration name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="portal-input mt-1" placeholder="e.g. Dispatch export" /></label>
        <fieldset className="ds-label"><legend>Scopes</legend><div className="mt-2 flex flex-wrap gap-3">{SCOPES.map((s) => <label key={s.v} className="flex items-center gap-2 font-normal"><input type="checkbox" checked={scopes.includes(s.v)} onChange={(e) => setScopes((v) => e.target.checked ? [...v, s.v] : v.filter((x) => x !== s.v))} />{s.l}</label>)}</div></fieldset>
      </div>
      <DsButton disabled={busy || name.trim().length < 2 || scopes.length === 0} onClick={() => run(() => createApiCredential({ data: { name: name.trim(), scopes: scopes as ("exports:read" | "schedule:read")[] } }).then((r) => { setName(""); return r; }), "Key created")}>Create key</DsButton>
      <ul className="space-y-2">{(d?.keys ?? []).map((k: any) => <li key={k.id} className="rounded-ds border border-ds-sky-border bg-ds-surface p-3">
        <p className="ds-label break-words text-ds-primary">{k.name} <span className={k.status === "active" ? "ds-caption" : "ds-caption text-ds-error"}>· {k.status === "active" ? "Active" : "Revoked"}</span></p>
        <p className="ds-caption font-mono">{k.key_prefix}…{k.key_last4} · {(k.scopes ?? []).join(", ")}</p>
        <p className="ds-caption">Created {new Date(k.created_at).toLocaleString()} by {k.created_by_mfn_id ?? "Not available"} · Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}{k.rotated_at ? ` · Rotated ${new Date(k.rotated_at).toLocaleString()}` : ""}{k.revoked_at ? ` · Revoked ${new Date(k.revoked_at).toLocaleString()} by ${k.revoked_by_mfn_id ?? "Not available"}` : ""}</p>
        {k.status === "active" && <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <button className="font-bold text-ds-primary hover:underline" disabled={busy} onClick={() => { const n = window.prompt("New name", k.name)?.trim(); if (n && n.length >= 2) run(() => renameApiCredential({ data: { id: k.id, name: n } }), "Renamed"); }}>Rename</button>
          <button className="font-bold text-ds-primary hover:underline" disabled={busy} onClick={() => window.confirm("Rotate this key? The current key stops working immediately.") && run(() => rotateApiCredential({ data: { id: k.id } }), "Key rotated")}>Rotate</button>
          <button className="font-bold text-ds-error hover:underline" disabled={busy} onClick={() => window.confirm("Revoke this key? This cannot be undone; history is kept.") && run(() => revokeApiCredential({ data: { id: k.id } }), "Key revoked")}>Revoke</button>
        </div>}
      </li>)}</ul>
      {(d?.events ?? []).length > 0 && <details><summary className="ds-label cursor-pointer text-ds-primary">Key history</summary>{(d?.events ?? []).map((e: any) => <p key={e.id} className="ds-caption mt-1">{new Date(e.created_at).toLocaleString()} · {e.event} · {e.actor_mfn_id ?? "Not available"}{e.detail ? ` · ${e.detail}` : ""}</p>)}</details>}
    </>}
  </section>;
}
