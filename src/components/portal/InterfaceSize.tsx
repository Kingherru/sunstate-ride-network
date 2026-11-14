import { useState } from 'react';
import { DsButton, DsCheckbox, DsField, DsSelect } from '@/components/ds/controls';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPortalPreferences, savePortalPreferences, type InterfaceDensity, type PortalPreferences } from '@/lib/portal-preferences.functions';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';

export function InterfaceSize() {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const get = useServerFn(getPortalPreferences);
  const save = useServerFn(savePortalPreferences);
  const q = usePortalQuery({ queryKey: ['portal-preferences'], queryFn: () => get() });
  const value = ((q.data as PortalPreferences | undefined)?.interface_density ?? 'standard') as InterfaceDensity;
  const [busy,setBusy]=useState(false);
  async function change(patch: {interface_density?: InterfaceDensity; high_contrast?: boolean}) {
    if (preview.active) return previewBlocked();
    setBusy(true);
    try { await save({ data: patch }); await qc.invalidateQueries({ queryKey: ['portal-preferences'] }); toast.success('Accessibility settings saved.'); }
    catch { toast.error('Could not save interface size.'); } finally {setBusy(false);}
  }
  return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Accessibility</h2><div className="portal-business-body space-y-5"><DsCheckbox label="High Contrast Mode" disabled={busy||preview.active||q.isError} checked={q.data?.high_contrast ?? false} onChange={e=>void change({high_contrast:e.target.checked})}/><DsField label="Text size">{p=><DsSelect {...p} disabled={busy||preview.active||q.isError} value={value} onChange={e=>void change({interface_density:e.target.value as InterfaceDensity})}><option value="compact">Smaller</option><option value="standard">Default</option><option value="comfortable">Large</option><option value="extra_large">Extra Large</option></DsSelect>}</DsField><DsButton variant="secondary" disabled={busy||preview.active||q.isError} onClick={()=>void change({interface_density:'standard',high_contrast:false})}>Reset to Default</DsButton>{q.isError&&<p role="alert" className="ds-support">Accessibility settings unavailable. Please try again.</p>}</div></section>;
}
