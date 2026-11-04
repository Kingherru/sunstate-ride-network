import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { DsButton } from '@/components/ds/controls';

/** Local presentation state only; unmounting a closed window restores defaults. */
export function useDetailWindow() {
  const [expanded, setExpanded] = useState(false);
  const label = expanded ? 'Restore window' : 'Expand window';
  return {
    windowProps: { 'data-detail-window': '', 'data-expanded': expanded },
    control: <DsButton type="button" variant="ghost" aria-label={label} title={label}
      aria-pressed={expanded} className="portal-window-control !size-11 !min-h-11 !p-0 shrink-0"
      onClick={() => setExpanded(value => !value)}>
      {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </DsButton>,
  };
}