import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { getOnboarding, saveOnboardingSection } from '@/lib/onboarding.functions';
import { usePortalPreview, usePortalQuery, previewBlocked } from '@/components/portal/preview-data';
import { DsButton, DsField, DsInput } from '@/components/ds/controls';

const empty = { display_name: '', legal_business_name: '', business_phone: '', dispatch_phone: '', business_address: '', operating_hours: '', npi: '', medicaid_number: '' };
export function BusinessContactSettings() {
  const preview = usePortalPreview();
  const get = useServerFn(getOnboarding);
  const save = useServerFn(saveOnboardingSection);
  const q = usePortalQuery({ queryKey: ['account-onboarding'], queryFn: () => get() });
  const [fields, setFields] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!q.data) return; const w = q.data.workspace; setFields({ display_name: w.display_name, legal_business_name: w.legal_business_name ?? '', business_phone: w.business_phone ?? '', dispatch_phone: w.dispatch_phone ?? '', business_address: w.business_address ?? '', operating_hours: w.operating_hours ?? '', npi: q.data.legacy?.npi ?? '', medicaid_number: q.data.legacy?.medicaid_number ?? '' }); }, [q.data]);
  if (preview.active) return <p className="ds-support">Preview only. Business contact changes are unavailable.</p>;
  if (q.isLoading) return <p className="ds-support" role="status">Loading business contacts…</p>;
  if (!q.data || q.data.workspace.account_type === 'private_pay') return null;
  const provider = q.data.workspace.account_type === 'provider';
  return <form className="portal-business-section portal-business-form" onSubmit={async e => { e.preventDefault(); if (preview.active) return previewBlocked(); setBusy(true); try { await save({ data: { section: 'business', ...fields, npi: provider ? fields.npi : '', medicaid_number: provider ? fields.medicaid_number : '' } }); toast.success('Business contacts saved.'); await q.refetch(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save'); } finally { setBusy(false); } }}>
    <h2 className="portal-business-heading ds-subheading uppercase">Business &amp; contact information</h2>
    <div className="portal-business-body grid gap-4 sm:grid-cols-2">{(Object.entries({ display_name: 'Display / facility name', legal_business_name: 'Legal business name', business_phone: 'Main phone', dispatch_phone: 'Dispatch / coordination phone', business_address: 'Private business address', operating_hours: 'Operating hours', ...(provider ? { npi: 'NPI', medicaid_number: 'Medicaid provider number' } : {}) }) as [keyof typeof fields, string][]).map(([key, label]) => <DsField key={key} label={label}>{p => <DsInput {...p} value={fields[key]} required={key === 'display_name'} maxLength={key === 'operating_hours' ? 500 : key === 'business_address' ? 300 : 160} onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))} />}</DsField>)}<p className="ds-caption sm:col-span-2">Private contact address. Public Network service locations are managed separately.</p></div>
    <div className="portal-business-actions"><DsButton type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save business contacts'}</DsButton></div>
  </form>;
}