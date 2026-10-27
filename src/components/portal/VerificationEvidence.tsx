import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Check, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getVerificationSummary, getVerificationDetails, saveVerificationDetails } from '@/lib/provider-verification.functions';
import { DsButton, DsField, DsInput, DsSelect, DsCheckbox } from '@/components/ds/controls';
import { usePortalPreview, usePortalQuery } from './preview-data';

export function VerificationEvidence({ workspaceId, editable = false }: { workspaceId: string; editable?: boolean }) {
  const preview = usePortalPreview(); const summary = useServerFn(getVerificationSummary);
  const q = usePortalQuery({ queryKey: ['verification-evidence', workspaceId], queryFn: () => summary({ data: { workspaceId } }), enabled: !preview.active });
  if (preview.active) return <p className="ds-support">No evidence in this preview.</p>;
  return <section className="space-y-4">
    {q.isLoading && <p className="ds-support">Loading requirements…</p>}
    {!!q.error && <p role="alert" className="ds-support text-ds-error">{q.error instanceof Error ? q.error.message : 'Verification evidence unavailable.'}</p>}
    {q.data && <>
      <p className="ds-support">{q.data.paused_reason ? `Requirements: ${q.data.paused_reason.replaceAll('_', ' ')}` : 'All verification requirements complete.'}</p>
      <ul className="grid gap-2 sm:grid-cols-2">{q.data.requirements.map(r => <li key={r.label} className="flex items-start gap-2 ds-body">{r.complete ? <Check className="size-4 shrink-0 text-ds-primary mt-1" /> : <AlertCircle className="size-4 shrink-0 text-ds-warning mt-1" />}<span>{r.label}<span className="block ds-caption">{r.complete ? 'Complete' : 'Missing'}</span></span></li>)}</ul>
      <h3 className="ds-label text-ds-primary">Document checklist</h3>
      <ul className="divide-y divide-ds-border">{q.data.documents.map(d => <li key={d.kind} className="flex flex-wrap justify-between gap-2 py-2 ds-body"><span>{d.label}</span><span className={d.status === 'Expired' || d.status === 'Missing' ? 'ds-caption text-ds-error' : 'ds-caption text-ds-primary'}>{d.status}</span></li>)}</ul>
      <p className="ds-caption">Provider-attested documents are not authenticated by MY FLORIDA NEMT. Private files and payment details are not shown.</p>
    </>}
    {editable && <BusinessEvidenceEditor workspaceId={workspaceId} />}
  </section>;
}

function BusinessEvidenceEditor({ workspaceId }: { workspaceId: string }) {
  const get = useServerFn(getVerificationDetails); const save = useServerFn(saveVerificationDetails); const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['verification-details', workspaceId], queryFn: () => get({ data: { workspaceId } }) });
  const [busy, setBusy] = useState(false);
  return <details className="pt-3"><summary className="ds-label text-ds-primary cursor-pointer">Business requirement details</summary>
    {q.data && <form key={q.data.legal_name as string ?? 'empty'} className="grid gap-4 sm:grid-cols-2 pt-4" onSubmit={async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true);
      try {
        await save({ data: { workspaceId, legal_name: String(f.get('legal_name') ?? ''), dba: String(f.get('dba') ?? ''), business_type: String(f.get('business_type')) as 'llc', representative: String(f.get('representative') ?? ''), business_address: String(f.get('business_address') ?? ''), service_location: String(f.get('service_location') ?? ''), registration_number: String(f.get('registration_number') ?? ''), after_hours: f.has('after_hours'), minimum_notice_hours: Number(f.get('minimum_notice_hours')), accepted_payers: f.getAll('accepted_payers') as ('private_pay' | 'facility' | 'broker' | 'medicaid' | 'workers_comp')[], local_permit_required: f.has('local_permit_required'), professional_liability_required: f.has('professional_liability_required'), cargo_required: f.has('cargo_required'), program_credentials_required: f.has('program_credentials_required'), attested: f.has('attested') as true, network_rules_acknowledged: f.has('network_rules_acknowledged') as true } });
        await qc.invalidateQueries({ queryKey: ['verification-evidence'] }); await qc.invalidateQueries({ queryKey: ['provider-badges'] }); toast.success('Business requirements saved.');
      } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
    }}>
      {([['legal_name','Legal business name'],['dba','DBA (if applicable)'],['representative','Authorized representative'],['business_address','Business address'],['service_location','Service location or base'],['registration_number','Florida registration / DBA number']] as const).map(([name,label]) => <DsField key={name} label={label}>{p => <DsInput {...p} name={name} defaultValue={String(q.data?.[name] ?? '')} required={!['dba','registration_number'].includes(name)} maxLength={300} />}</DsField>)}
      <DsField label="Business type">{p => <DsSelect {...p} name="business_type" defaultValue={String(q.data?.business_type ?? 'llc')}><option value="llc">LLC</option><option value="corporation">Corporation</option><option value="partnership">Partnership</option><option value="sole_proprietor">Sole proprietor</option><option value="independent_contractor">Independent contractor</option></DsSelect>}</DsField>
      <DsField label="Minimum notice (hours)">{p => <DsInput {...p} name="minimum_notice_hours" type="number" min={0} max={720} defaultValue={Number(q.data?.minimum_notice_hours ?? 0)} required />}</DsField>
      <DsCheckbox name="after_hours" label="After-hours availability" defaultChecked={q.data.after_hours === true} />
      <fieldset className="sm:col-span-2 space-y-2"><legend className="ds-label">Accepted payer types</legend><div className="flex flex-wrap gap-3">{['private_pay','facility','broker','medicaid','workers_comp'].map(value => <DsCheckbox key={value} name="accepted_payers" value={value} label={value.replaceAll('_',' ')} defaultChecked={Array.isArray(q.data?.accepted_payers) && q.data.accepted_payers.includes(value)} />)}</div></fieldset>
      {([['local_permit_required','Transportation / local permit applies'],['professional_liability_required','Professional liability required by service or contract'],['cargo_required','Cargo coverage required by service or contract'],['program_credentials_required','Medicaid / AHCA / broker or other program participation claimed']] as const).map(([name,label]) => <DsCheckbox key={name} name={name} label={label} defaultChecked={q.data?.[name] !== false} />)}
      <div className="sm:col-span-2 space-y-3"><DsCheckbox required name="network_rules_acknowledged" label="I acknowledge Network payment, completion and conduct rules." /><DsCheckbox required name="attested" label="I attest that these details and applicability selections are accurate." /><DsButton type="submit" disabled={busy}><Save className="size-4" />{busy ? 'Saving…' : 'Save requirement details'}</DsButton></div>
    </form>}
    {!!q.error && <p className="ds-support text-ds-error">Business details unavailable.</p>}
  </details>;
}