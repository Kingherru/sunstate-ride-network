import type { ComponentType, ReactNode } from 'react';
/** Presentation only: callers retain the original link/action wrapper. */
export function ShortcutCardContent({ icon: Icon, title, description }: { icon: ComponentType<{ className?: string }>; title: ReactNode; description: ReactNode }) {
  return <div className="portal-shortcut-content" data-text-wrap>
    <div className="portal-shortcut-title"><Icon className="size-5 shrink-0 text-ds-accent" /><span className="ds-subheading uppercase text-ds-primary min-w-0">{title}</span></div>
    <p className="ds-support text-ds-muted">{description}</p>
  </div>;
}