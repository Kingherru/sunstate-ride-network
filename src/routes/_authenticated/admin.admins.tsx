import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listRegularAdmins, promoteRegularAdmin, setRegularAdminPermissions, revokeRegularAdmin, type RegularAdmin } from "@/lib/admin-management.functions";
import { ADMIN_SECTIONS, PRESETS, PRESET_LABELS, type AdminPreset, type AccessLevel } from "@/lib/admin-permissions";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { DsEmpty } from "@/components/ds/feedback";
import { DsButton } from '@/components/ds/controls';

export const Route = createFileRoute("/_authenticated/admin/admins")({
  head: () => ({ meta: [{ title: "Administrators — MY FLORIDA NEMT Admin" }, { name: 'description', content: 'Manage administrator permissions and account scope.' }, { property: 'og:title', content: 'Administrators — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Manage administrator permissions and account scope.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => listRegularAdmins(),
  component: AdminsPage,
});

function AdminsPage() {
  const { admins, workspaces, audit } = Route.useLoaderData();
  const router = useRouter();
  const promote = useServerFn(promoteRegularAdmin);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPromote(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await promote({ data: { email } }); toast.success("Administrator added with no access. Assign permissions below."); setEmail(""); router.invalidate(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Administrators">Only you, the Master Admin, can add, change or remove regular administrators. New administrators start with no sections and no accounts.</PageHead>
      <section className={`${panelCls} mb-6 p-4 sm:p-5`}>
        <form onSubmit={onPromote} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="promote-email" className="portal-label">Email of an existing account</label>
            <input id="promote-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="portal-input" />
          </div>
          <DsButton type="submit" disabled={busy} className="whitespace-nowrap">Add administrator</DsButton>
        </form>
      </section>
      {admins.length === 0 ? <section className={panelCls}><DsEmpty title="No regular administrators" /></section> :
        <div className="space-y-4">{admins.map((a) => <AdminCard key={a.userId} admin={a} workspaces={workspaces as any[]} />)}</div>}
      <section className={`${panelCls} mt-6`}>
        <h2 className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">Permission history</h2>
        {audit.length === 0 ? <DsEmpty title="No changes yet" /> : (
          <ul className="divide-y divide-ds-border">{audit.map((r: any) => (
            <li key={r.id} className="ds-support px-4 py-2 sm:px-5"><span className="font-semibold text-ds-on-surface">{r.action.replace(/_/g, " ")}</span> · {new Date(r.created_at).toLocaleString()}
              {r.metadata?.new && <span className="block break-words font-mono text-xs">{JSON.stringify(r.metadata.new)}</span>}</li>
          ))}</ul>
        )}
      </section>
    </>
  );
}

function AdminCard({ admin, workspaces }: { admin: RegularAdmin; workspaces: { id: string; mfn_id: string; display_name: string | null; account_type: string; is_test_account: boolean }[] }) {
  const router = useRouter();
  const save = useServerFn(setRegularAdminPermissions);
  const revoke = useServerFn(revokeRegularAdmin);
  const [preset, setPreset] = useState<AdminPreset>(admin.preset as AdminPreset);
  const [sections, setSections] = useState<Record<string, AccessLevel>>(admin.sections as any);
  const [scope, setScope] = useState(admin.scope as "none" | "selected" | "all");
  const [ws, setWs] = useState<Set<string>>(new Set(admin.workspaceIds));
  const [active, setActive] = useState(admin.active);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const eff = preset === "custom" ? sections : (PRESETS[preset] as Record<string, AccessLevel>);
  const id = admin.userId.slice(0, 8);

  async function onSave() {
    try {
      await save({ data: { userId: admin.userId, preset, sections: eff as any, scope, workspaceIds: [...ws], active } });
      toast.success("Permissions saved."); router.invalidate();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function onRevoke() {
    try { await revoke({ data: { userId: admin.userId } }); toast.success("Administrator access removed."); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <section className={`${panelCls} p-4 sm:p-5`} aria-labelledby={`adm-${id}`}>
      <h2 id={`adm-${id}`} className="ds-subheading break-words text-ds-primary">{admin.name || admin.email}</h2>
      <p className="ds-support break-all">{admin.email} · <span className="font-mono">{admin.mfnId}</span>{admin.isTest && " · Test account"}</p>
      <p className="ds-support mt-2 text-ds-text-2">{active ? 'Active' : 'Disabled'} · {scope === 'selected' ? `${ws.size} selected accounts` : scope === 'all' ? 'All eligible accounts' : 'No account access'} · {Object.values(eff).filter(v => v === 'manage').length} Manage / {Object.values(eff).filter(v => v === 'read').length} Read-only sections</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor={`preset-${id}`} className="portal-label">Preset</label>
          <select id={`preset-${id}`} className="portal-input" value={preset} onChange={(e) => { const p = e.target.value as AdminPreset; setPreset(p); if (p !== "custom") setSections(PRESETS[p] as any); }}>
            {(Object.keys(PRESET_LABELS) as AdminPreset[]).map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`scope-${id}`} className="portal-label">Account scope</label>
          <select id={`scope-${id}`} className="portal-input" value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="none">No accounts</option><option value="selected">Selected accounts</option><option value="all">All eligible accounts</option>
          </select>
        </div>
        <label className="ds-body flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (uncheck to suspend)</label>
      </div>
      <fieldset className="mt-4">
        <legend className="portal-label">Sections {preset !== "custom" && "(switch to Custom to edit)"}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_SECTIONS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 rounded-ds-sm bg-ds-surface-muted px-3 py-2">
              <label htmlFor={`${id}-${s.key}`} className="ds-support min-w-0 text-ds-on-surface">{s.label}</label>
              <select id={`${id}-${s.key}`} disabled={preset !== "custom"} className="portal-input !w-32 shrink-0 py-1" value={eff[s.key] ?? "none"}
                onChange={(e) => setSections((m) => ({ ...m, [s.key]: e.target.value as AccessLevel }))}>
                <option value="none">No access</option><option value="read">Read-only</option><option value="manage">Manage</option>
              </select>
            </div>
          ))}
        </div>
        <p className="ds-support mt-2">Security settings and administrator management always stay with the Master Admin.</p>
      </fieldset>
      {scope === "selected" && (
        <fieldset className="mt-4">
          <legend className="portal-label">Accounts</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
            {workspaces.map((w) => (
              <label key={w.id} className="ds-support flex items-center gap-2 break-words">
                <input type="checkbox" checked={ws.has(w.id)} onChange={(e) => setWs((s) => { const n = new Set(s); e.target.checked ? n.add(w.id) : n.delete(w.id); return n; })} />
                <span className="font-mono">{w.mfn_id}</span> {w.display_name || w.account_type}{w.is_test_account && " (test)"}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <DsButton onClick={onSave}>Save permissions</DsButton>
        {!confirmRevoke ? <DsButton variant="ghost" onClick={() => setConfirmRevoke(true)}>Remove administrator</DsButton>
          : <><DsButton onClick={onRevoke}>Confirm removal</DsButton><DsButton variant="ghost" onClick={() => setConfirmRevoke(false)}>Cancel</DsButton></>}
      </div>
    </section>
  );
}
