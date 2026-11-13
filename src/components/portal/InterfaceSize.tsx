import { useState } from 'react';
import { DsButton } from '@/components/ds/controls';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPortalPreferences, savePortalPreferences, type InterfaceDensity, type PortalPreferences } from '@/lib/portal-preferences.functions';
import { SegTabs } from './SegTabs';
import { SignInPreference } from './SignInPreference';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';

export function InterfaceSize() {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const get = useServerFn(getPortalPreferences);
  const save = useServerFn(savePortalPreferences);
  const q = usePortalQuery({ queryKey: ['portal-preferences'], queryFn: () => get() });
  const value = ((q.data as PortalPreferences | undefined)?.interface_density ?? 'standard') as InterfaceDensity;
  const [busy,setBusy]=useState(false);
  async function change(v: InterfaceDensity) {
    if (preview.active) return previewBlocked();
    setBusy(true);
    try { await save({ data: { interface_density: v } }); await qc.invalidateQueries({ queryKey: ['portal-preferences'] }); toast.success('Interface size saved.'); }
    catch { toast.error('Could not save interface size.'); } finally {setBusy(false);}
  }
  return <div className="space-y-4"><SignInPreference /><h3 className="ds-label text-ds-primary">Interface size</h3>
    <div className="flex flex-wrap gap-2">{(['compact','standard','comfortable'] as InterfaceDensity[]).map(v=><DsButton key={v} disabled={busy||preview.active} variant={v===value?'secondary':'ghost'} aria-pressed={v===value} onClick={()=>change(v)}>{v[0].toUpperCase()+v.slice(1)}</DsButton>)}</div></div>;
}
