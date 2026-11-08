import { useDetailColumns } from './DetailPresentation';
const tones = {
  identity: 'bg-ds-sky border-ds-sky-border',
  contact: 'bg-ds-surface border-ds-sky-border',
  trip: 'bg-ds-surface border-ds-sky-border',
  service: 'bg-ds-sky border-ds-sky-border',
  payment: 'bg-ds-surface border-ds-sky-border',
  notes: 'bg-ds-sky border-ds-sky-border',
  warning: 'bg-ds-surface border-ds-error border-2',
};
export function DetailSection({ title, tone = 'identity', children }: { title: string; tone?: keyof typeof tones; children: React.ReactNode }) {
  const columns = useDetailColumns();
  return <section data-detail-section style={{'--detail-columns': columns.map(v => `${v}fr`).join(' ')} as React.CSSProperties} className={`min-w-0 h-full rounded-ds border p-4 sm:p-6 ${tones[tone]}`}><h2 className="ds-subheading uppercase text-ds-primary">{title}</h2><div className="min-w-0 mt-2 break-words">{children}</div></section>;
}