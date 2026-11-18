import { useEffect, useState } from 'react';
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
  const [value,setValue]=useState<InterfaceDensity>('standard');
  const [contrast,setContrast]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  function reset(){setValue(q.data?.interface_density??'standard');setContrast(q.data?.high_contrast??false);setMessage('');}
  useEffect(reset,[q.data]);
  const dirty=value!==(q.data?.interface_density??'standard')||contrast!==(q.data?.high_contrast??false);
  const valid=['compact','standard','comfortable','extra_large'].includes(value);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(preview.active||busy||!q.data||!dirty||!valid)return;
    setBusy(true);setMessage('');
    try{await save({data:{interface_density:value,high_contrast:contrast}});await qc.invalidateQueries({queryKey:['portal-preferences']});setMessage('Changes saved.');toast.success('Accessibility settings saved.');}
    catch{setMessage('Could not save. Your saved accessibility settings are unchanged.');toast.error('Could not save accessibility settings.');}finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Accessibility</h2><div className="portal-business-body space-y-5"><DsCheckbox label="High Contrast Mode" disabled={busy||!q.data||q.isError} checked={contrast} onChange={e=>setContrast(e.target.checked)}/><DsField label="Text size">{p=><DsSelect {...p} disabled={busy||!q.data||q.isError} value={value} onChange={e=>setValue(e.target.value as InterfaceDensity)}><option value="compact">Smaller</option><option value="standard">Default</option><option value="comfortable">Large</option><option value="extra_large">Extra Large</option></DsSelect>}</DsField><DsButton type="button" variant="secondary" disabled={busy||!q.data||q.isError} onClick={()=>{setValue('standard');setContrast(false);}}>Reset to Default</DsButton>{q.isError&&<p role="alert" className="ds-support">Accessibility settings unavailable.</p>}<p role="status" className="ds-caption">{preview.active?'Preview mode — nothing is saved.':message||(dirty?'Unsaved changes.':'')}</p></div><div className="portal-business-actions"><DsButton type="submit" disabled={preview.active||busy||!q.data||!dirty||!valid}>{busy?'Saving…':'Save Changes'}</DsButton><DsButton type="button" variant="ghost" disabled={busy||!dirty} onClick={reset}>Cancel</DsButton></div></form>;
}
