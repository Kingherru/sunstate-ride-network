import type { ComponentProps, ReactNode } from 'react';
import { SegTabs } from './SegTabs';

/** Primary navigation and its existing content share one responsive shell. */
export function PortalTabbedLayout<T extends string>({ children, ...tabs }: ComponentProps<typeof SegTabs<T>> & { children: ReactNode }) {
  return <div className="portal-tabbed-layout">
    <SegTabs {...tabs} variant="rail" />
    <div role="tabpanel" aria-label={tabs.options.find(option => option.value === tabs.value)?.label} className="portal-tabbed-content portal-business-form">{children}</div>
  </div>;
}