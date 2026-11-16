import { cn } from '@/lib/utils';

export type NotificationTone = 'attention' | 'positive' | 'warning';
export function notificationIndicatorTone(tone: string): NotificationTone {
  return tone === 'red' || tone === 'important' ? 'attention' : tone === 'yellow' ? 'warning' : 'positive';
}
/** Counts remain exact in the accessible name; large visual counts keep a stable circle. */
export function NotificationIndicator({ tone = 'positive', count, label, className }: {
  tone?: NotificationTone; count?: number; label: string; className?: string;
}) {
  if (count != null && count <= 0) return null;
  return <span role="img" aria-label={count == null ? label : `${count} ${label}`}
    data-notification-indicator={tone} data-notification-count={count}
    className={cn('portal-notification-indicator', count == null ? 'portal-notification-dot' : 'portal-notification-count', className)}>
    {count != null && <span aria-hidden>{count > 99 ? '99+' : count}</span>}
  </span>;
}