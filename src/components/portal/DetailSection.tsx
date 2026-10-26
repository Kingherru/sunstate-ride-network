const tones = {
  identity: 'bg-ds-sky border-ds-sky-border',
  contact: 'bg-ds-surface border-ds-sky-border',
  trip: 'bg-ds-peach border-ds-peach-border',
  service: 'bg-ds-sky border-ds-sky-border',
  payment: 'bg-ds-green border-ds-green-border',
  notes: 'bg-ds-membership border-ds-peach-border',
  warning: 'bg-ds-error-soft border-ds-error',
};
export function DetailSection({ title, tone = 'identity', children }: { title: string; tone?: keyof typeof tones; children: React.ReactNode }) {
  return <section className={`min-w-0 rounded-ds border p-4 sm:p-6 ${tones[tone]}`}><h2 className="ds-subheading uppercase text-ds-primary">{title}</h2><div className="min-w-0 mt-2 break-words">{children}</div></section>;
}