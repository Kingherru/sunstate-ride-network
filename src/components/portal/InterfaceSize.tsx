import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPortalPreferences, savePortalPreferences, type InterfaceDensity, type PortalPreferences } from '@/lib/portal-preferences.functions';
import { SegTabs } from './SegTabs';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';

export function InterfaceSize() {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const get = useServerFn(getPortalPreferences);
  const save = useServerFn(savePortalPreferences);
  const q = usePortalQuery({ queryKey: ['portal-preferences'], queryFn: () => get() });
  const value = ((q.data as PortalPreferences | undefined)?.interface_density ?? 'standard') as InterfaceDensity;
  async function change(v: InterfaceDensity) {
    if (preview.active) return previewBlocked();
    try { await save({ data: { interface_density: v } }); await qc.invalidateQueries({ queryKey: ['portal-preferences'] }); toast.success('Interface size saved.'); }
    catch { toast.error('Could not save interface size.'); }
  }
  return <div className="space-y-2"><h3 className="ds-label text-ds-primary">Interface size</h3>
    <SegTabs label="Interface size" value={value} onChange={change} options={[{ value: 'compact', label: 'Compact' }, { value: 'standard', label: 'Standard' }, { value: 'comfortable', label: 'Comfortable' }]} /></div>;
}
