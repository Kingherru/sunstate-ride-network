import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHead } from '@/components/portal/PortalShell';
import { DsInput } from '@/components/ds/controls';
import { listTrainingCompletions } from '@/lib/training/admin.functions';
export const Route = createFileRoute('/_authenticated/admin/training')({
  head: () => ({ meta: [{ title: 'Training Completion Records — MY FLORIDA NEMT' }, { name: 'description', content: 'Master Admin training certificate and completion records.' }, { property: 'og:title', content: 'Training Completion Records — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Protected training administration.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: TrainingAdmin,
});
function TrainingAdmin() {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['admin-training-completions'], queryFn: () => listTrainingCompletions() });
  const rows = (q.data ?? []).filter(c => `${c.cert_number} ${c.holder_name}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHead title="Training administration" /><DsInput aria-label="Search certificate or recipient" placeholder="Search certificate or recipient" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />{q.isPending ? <p role="status" className="mt-5">Loading completions…</p> : q.error ? <p role="alert" className="mt-5 text-ds-error">Completion records unavailable.</p> : <div className="mt-5 space-y-3">{!rows.length && <p>No completion records found.</p>}{rows.map(c => <article key={c.id} className="rounded-ds border border-ds-sky-border bg-ds-sky p-5"><h2 className="ds-subheading text-ds-primary">{c.courses?.title}</h2><p>{c.holder_name} · {c.cert_number}</p><p className="ds-support">{new Date(c.issued_at).toLocaleDateString()}</p><Link to="/verify/$token" params={{ token: c.verify_token }} className="text-ds-link underline">Verify certificate</Link></article>)}</div>}</>;
}