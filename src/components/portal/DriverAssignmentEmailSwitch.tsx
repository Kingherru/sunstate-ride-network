import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { usePortalPreview } from './preview-data';

/** Business-wide master switch for driver assignment emails. Off by default; preview never saves. */
export function DriverAssignmentEmailSwitch({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const preview = usePortalPreview();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [value, setValue] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => {
    if (preview.active) { setSaved(false); return; }
    supabase.from('workspaces').select('driver_assignment_email_enabled').eq('id', workspaceId).maybeSingle()
      .then(({ data }) => { const v = Boolean(data?.driver_assignment_email_enabled); setSaved(v); setValue(v); });
  }, [workspaceId, preview.active]);
  const dirty = saved !== null && value !== saved;
  const save = async () => {
    if (preview.active || !dirty) return;
    setState('saving');
    const { error } = await supabase.rpc('set_driver_assignment_email', { _workspace: workspaceId, _enabled: value });
    if (error) { setState('error'); return; }
    setSaved(value); setState('saved');
  };
  return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Driver assignment emails</h2><div className="portal-business-body space-y-3">
    <label className="flex items-start gap-2"><input type="checkbox" checked={value} disabled={!canEdit || preview.active || saved === null} onChange={e => { setValue(e.target.checked); setState('idle'); }} /><span><span className="ds-label font-bold">Email drivers when they are assigned or reassigned</span><span className="block ds-caption">Off by default. A driver is emailed only when this is on, their own record opts in, and they have a valid email. Email delivery is not active yet, so turning this on does not send anything today. Text messages are not available.</span></span></label>
    <p className="ds-caption" aria-live="polite">Status: {saved === null ? 'Loading…' : saved ? 'On (delivery unavailable)' : 'Off'}{state === 'saving' ? ' · Saving…' : state === 'saved' ? ' · Saved' : state === 'error' ? ' · Could not save. Try again.' : dirty ? ' · Unsaved change' : ''}</p>
    {preview.active ? <p className="ds-support">Preview only. This setting cannot be saved.</p> : canEdit ? <div className="flex gap-2"><Button type="button" size="sm" disabled={!dirty || state === 'saving'} onClick={save}>Save Changes</Button><Button type="button" size="sm" variant="outline" disabled={!dirty} onClick={() => { setValue(Boolean(saved)); setState('idle'); }}>Cancel</Button></div> : <p className="ds-support">Only the business owner or an admin can change this.</p>}
  </div></section>;
}
