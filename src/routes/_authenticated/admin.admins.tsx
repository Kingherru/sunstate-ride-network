import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listRegularAdmins, promoteRegularAdmin, setRegularAdminPermissions, revokeRegularAdmin, type RegularAdmin } from "@/lib/admin-management.functions";
import { ADMIN_SECTIONS, PRESETS, PRESET_LABELS, type AdminPreset, type AccessLevel } from "@/lib/admin-permissions";
import { PageHead } from "@/components/portal/PortalShell";
import { DsEmpty } from "@/components/ds/feedback";
import { DsButton } from '@/components/ds/controls';
import { StatusPill, humanStatus } from '@/components/ds/status';

const groupCls = 'portal-business-section p-4';
const headCls = 'ds-subheading uppercase text-ds-primary';

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
  const [selectedId, setSelectedId] = useState<string | null>(admins[0]?.userId ?? null);

  async function onPromote(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await promote({ data: { email } }); toast.success("Administrator added with no access. Assign permissions below."); setEmail(""); router.invalidate(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Administrators">Only you, the Master Admin, can add, change or remove regular administrators. New administrators start with no sections and no accounts.</PageHead>
      <div className="portal-business-form grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5">
          <section aria-labelledby="current-admins" className="portal-business-section">
            <h2 id="current-admins" className={`${headCls} portal-business-heading`}>Administrators <span className="ds-support font-normal normal-case">({admins.length})</span></h2>
            {admins.length === 0 ? <DsEmpty title="No regular administrators" /> : <ul className="divide-y divide-ds-border">{admins.map(a => <li key={a.userId}>
              <DsButton variant="ghost" className="w-full justify-start rounded-none px-4 py-3 text-left" data-admin-selected={selectedId === a.userId} aria-pressed={selectedId === a.userId} onClick={() => setSelectedId(a.userId)}>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="ds-body block break-words font-semibold">{a.name || a.email}</span>
                  <span className="ds-caption block break-all">{a.email}</span>
                  <span className="ds-caption block font-mono">{a.mfnId}</span>
                  <span className="ds-caption block">{PRESET_LABELS[a.preset as AdminPreset]} · {a.scope === 'all' ? 'All eligible accounts' : a.scope === 'selected' ? `${a.workspaceIds.length} selected accounts` : 'No account access'}</span>
                  <StatusPill status={a.active ? 'Active' : 'Suspended'} tone={a.active ? 'green' : 'red'} />
                </span>
              </DsButton>
            </li>)}</ul>}
          </section>
          <section aria-labelledby="add-admin" className="portal-business-section">
            <h2 id="add-admin" className={`${headCls} portal-business-heading`}>Add administrator</h2>
            <div className="portal-business-body">
            <p className="ds-support mt-1">Promotes an existing account. New administrators start with No Access and no account scope.</p>
            <form onSubmit={onPromote} className="mt-4 space-y-3">
              <div><label htmlFor="promote-email" className="portal-label">Email of an existing account</label>
                <input id="promote-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="portal-input" /></div>
              <DsButton type="submit" disabled={busy} className="w-full">Add administrator</DsButton>
            </form>
            </div>
          </section>
          <section aria-labelledby="perm-history" className="portal-business-section">
            <h2 id="perm-history" className={`${headCls} portal-business-heading`}>Recent permission history</h2>
            {audit.length === 0 ? <DsEmpty title="No changes yet" /> : (
              <ul className="max-h-[32rem] divide-y divide-ds-border overflow-y-auto">{audit.map((r: any) => (
                <li key={r.id} className="ds-support min-w-0 px-4 py-3 sm:px-5"><span className="block font-semibold text-ds-on-surface">{humanStatus(r.action)}</span><span className="ds-caption">{new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</span>
                  {r.metadata?.new && <span className="mt-1 block break-words font-mono text-xs">{JSON.stringify(r.metadata.new)}</span>}</li>
              ))}</ul>
            )}
            <p className="ds-caption border-t border-ds-border px-4 py-2 sm:px-5">History is append-only and cannot be edited.</p>
          </section>
        </aside>
        <div className="min-w-0">
          {admins.length === 0 ? <section className="portal-business-section"><DsEmpty title="No administrator selected" /></section> : admins.map(a => <div key={a.userId} hidden={a.userId !== (admins.some(v => v.userId === selectedId) ? selectedId : admins[0]?.userId)}><AdminCard admin={a} workspaces={workspaces as any[]} /></div>)}
        </div>
      </div>
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
    <section className="portal-business-section p-4 sm:p-5" aria-labelledby={`adm-${id}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 id={`adm-${id}`} className="ds-subheading break-words text-ds-primary">{admin.name || admin.email}</h3>
          <p className="ds-support break-all">{admin.email} · <span className="font-mono">{admin.mfnId}</span>{admin.isTest && " · Test account"}</p>
        </div>
        <StatusPill status={active ? 'Active' : 'Suspended'} tone={active ? 'green' : 'red'} />
      </div>
      <p className="ds-support mt-2 text-ds-text-2">{scope === 'selected' ? `${ws.size} selected accounts` : scope === 'all' ? 'All eligible accounts' : 'No account access'} · {Object.values(eff).filter(v => v === 'manage').length} Manage / {Object.values(eff).filter(v => v === 'read').length} Read-only sections</p>
      <div className={`${groupCls} mt-4 space-y-4`}>
        <h4 className="ds-label border-b border-ds-border pb-3 uppercase text-ds-primary">Permission preset / custom access</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`preset-${id}`} className="portal-label">Preset</label>
            <select id={`preset-${id}`} className="portal-input" value={preset} onChange={(e) => { const p = e.target.value as AdminPreset; setPreset(p); if (p !== "custom") setSections(PRESETS[p] as any); }}>
              {(Object.keys(PRESET_LABELS) as AdminPreset[]).map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
            </select>
          </div>
          <div><span className="portal-label">Administrator status</span><label className="ds-body flex min-h-11 items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (uncheck to suspend)</label></div>
        </div>
        <fieldset className="min-w-0">
          <legend className="portal-label">Sections {preset !== "custom" && "(switch to Custom to edit)"}</legend>
          <table data-read-only={preset !== 'custom'} className="portal-permission-matrix hidden w-full border-collapse lg:table">
            <thead><tr className="ds-label text-left text-ds-primary"><th scope="col" className="py-2 pr-3">Section</th>{(['none','read','manage'] as AccessLevel[]).map(l => <th key={l} scope="col" className="w-24 px-2 py-2 text-center">{l === 'none' ? 'No access' : l === 'read' ? 'Read-only' : 'Manage'}</th>)}</tr></thead>
            <tbody className="divide-y divide-ds-border">{ADMIN_SECTIONS.map((s) => (
              <tr key={s.key}><th scope="row" className="ds-support py-2 pr-3 text-left font-semibold text-ds-on-surface">{s.label}</th>
                {(['none','read','manage'] as AccessLevel[]).map(l => <td key={l} className="px-2 py-2 text-center"><input type="radio" aria-label={`${s.label}: ${l}`} name={`${id}-${s.key}`} disabled={preset !== "custom"} checked={(eff[s.key] ?? 'none') === l} onChange={() => setSections((m) => ({ ...m, [s.key]: l }))} /></td>)}</tr>
            ))}</tbody>
          </table>
          <div className="grid gap-2 lg:hidden">
            {ADMIN_SECTIONS.map((s) => (
              <div key={s.key} className="grid gap-1 rounded-ds-sm bg-ds-surface px-3 py-2">
                <label htmlFor={`${id}-${s.key}`} className="ds-support min-w-0 font-semibold text-ds-on-surface">{s.label}</label>
                <select id={`${id}-${s.key}`} disabled={preset !== "custom"} className="portal-input" value={eff[s.key] ?? "none"}
                  onChange={(e) => setSections((m) => ({ ...m, [s.key]: e.target.value as AccessLevel }))}>
                  <option value="none">No access</option><option value="read">Read-only</option><option value="manage">Manage</option>
                </select>
              </div>
            ))}
          </div>
          <p className="ds-caption mt-2">Security settings and administrator management always stay with the Master Admin.</p>
        </fieldset>
      </div>
      <div className={`${groupCls} mt-4 space-y-3`}>
        <h4 className="ds-label border-b border-ds-border pb-3 uppercase text-ds-primary">Covered accounts</h4>
        <div className="max-w-sm">
          <label htmlFor={`scope-${id}`} className="portal-label">Accounts this administrator may act on</label>
          <select id={`scope-${id}`} className="portal-input" value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="none">None</option><option value="selected">Selected accounts</option><option value="all">All eligible accounts</option>
          </select>
        </div>
        {scope === "selected" && (
          <fieldset>
            <legend className="portal-label">Selected accounts</legend>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-ds-sm bg-ds-surface p-2 sm:grid-cols-2">
              {workspaces.map((w) => (
                <label key={w.id} className="ds-support flex min-w-0 items-center gap-2 break-words">
                  <input type="checkbox" checked={ws.has(w.id)} onChange={(e) => setWs((s) => { const n = new Set(s); e.target.checked ? n.add(w.id) : n.delete(w.id); return n; })} />
                  <span className="min-w-0"><span className="block font-mono">{w.mfn_id}</span>{w.display_name || w.account_type}{w.is_test_account && " (test)"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
      <div className="portal-business-actions mt-4">
        <DsButton onClick={onSave}>Save permissions</DsButton>
      </div>
      <div className="portal-business-actions mt-4">
        {!confirmRevoke ? <DsButton variant="ghost" className="portal-danger-control" onClick={() => setConfirmRevoke(true)}>Remove administrator</DsButton>
          : <div role="alertdialog" aria-label="Confirm administrator removal" className="flex w-full flex-wrap items-center gap-3 rounded-ds-sm ds-status-yellow px-3 py-2"><span className="ds-support font-semibold">Remove this administrator's access? History is kept.</span><DsButton className="portal-danger-control" onClick={onRevoke}>Confirm removal</DsButton><DsButton variant="ghost" onClick={() => setConfirmRevoke(false)}>Cancel</DsButton></div>}
      </div>
    </section>
  );
}
