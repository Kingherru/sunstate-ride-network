import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { getOnboarding, saveOnboardingSection } from '@/lib/onboarding.functions';
import { usePortalPreview, usePortalQuery, previewBlocked } from '@/components/portal/preview-data';
import { DsButton, DsField, DsInput } from '@/components/ds/controls';
import { getBusinessSettings, saveBusinessSettings } from '@/lib/business-settings.functions';

const empty = { display_name: '', legal_business_name: '', business_phone: '', dispatch_phone: '', business_address: '', mailing_address: '', operating_hours: '' };
export function BusinessContactSettings({ workspaceId }: { workspaceId?: string }) {
  const preview = usePortalPreview();
  const get = useServerFn(getOnboarding);
  const save = useServerFn(saveOnboardingSection);
  const getBusiness = useServerFn(getBusinessSettings);
  const saveBusiness = useServerFn(saveBusinessSettings);
  const q = usePortalQuery({ queryKey: ['account-onboarding'], queryFn: () => get(), enabled: !workspaceId });
  const business = usePortalQuery({ queryKey: ['workspace-business-settings',workspaceId], queryFn: () => getBusiness({data:{workspaceId:workspaceId ?? ''}}), enabled: !!workspaceId });
  const [fields, setFields] = useState(empty);
  const [busy, setBusy] = useState(false);
  const workspace = workspaceId ? business.data : q.data?.workspace;
  useEffect(() => { if (!workspace) return; setFields({ display_name: workspace.display_name, legal_business_name: workspace.legal_business_name ?? '', business_phone: workspace.business_phone ?? '', dispatch_phone: workspace.dispatch_phone ?? '', business_address: workspace.business_address ?? '', mailing_address: workspace.mailing_address ?? '', operating_hours: workspace.operating_hours ?? '' }); }, [workspace]);
  if (preview.active) return <p className="ds-support">Preview only. Business contact changes are unavailable.</p>;
  if (workspaceId ? business.isLoading : q.isLoading) return <p className="ds-support" role="status">Loading business contacts…</p>;
  if (!workspace || workspace.account_type === 'private_pay') return <p className="ds-support">Business contacts unavailable.</p>;
  return <form className="portal-business-section portal-business-form" onSubmit={async e => { e.preventDefault(); if (preview.active) return previewBlocked(); setBusy(true); try { if(workspaceId) await saveBusiness({ data: { workspaceId, details: fields } }); else await save({ data: { section: 'business', ...fields, npi: '', medicaid_number: '' } }); toast.success('Business contacts saved.'); if(workspaceId) await business.refetch(); else await q.refetch(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save'); } finally { setBusy(false); } }}>
    <h2 className="portal-business-heading ds-subheading uppercase">Business &amp; contact information</h2>
    <p className="ds-caption px-4 pt-3" role="status">{fields.legal_business_name && fields.business_phone && fields.business_address ? 'Business contact setup complete.' : 'Setup incomplete — add missing legal business name, main phone or private address when available.'}</p>
    <div className="portal-business-body grid gap-4 sm:grid-cols-2">{(Object.entries({ display_name: 'Public business / provider name', legal_business_name: 'Legal business name', business_phone: 'Main phone', dispatch_phone: 'Dispatch / coordination phone', business_address: 'Private business address', mailing_address:'Mailing address — if different' }) as [keyof typeof fields, string][]).map(([key, label]) => <DsField key={key} label={label}>{p => <DsInput {...p} value={fields[key]} required={key === 'display_name'} maxLength={key.includes('address') ? 300 : 160} onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))} />}</DsField>)}<p className="ds-caption sm:col-span-2">Private contact address. Public Network service locations are managed separately.</p></div>
    <div className="portal-business-actions"><DsButton type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save business contacts'}</DsButton></div>
  </form>;
}