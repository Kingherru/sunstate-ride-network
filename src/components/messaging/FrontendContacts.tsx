import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { DemoConversations } from './DemoConversations';
import { listFrontendContacts, markFrontendContactRead } from '@/lib/admin-contacts.functions';

const CAT: Record<string, string> = { business_inquiry: 'New business inquiry', website_problem: 'Website problem', general_question: 'General question' };
const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

export function FrontendContacts({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(listFrontendContacts);
  const mark = useServerFn(markFrontendContactRead);
  const q = useQuery({ queryKey: ['frontend-contacts'], queryFn: () => load() });
  const [open, setOpen] = useState<string | null>(null);
  if (q.isPending) return <p role="status">Loading contacts…</p>;
  if (q.error) return <p role="alert" className="text-ds-error">Contacts unavailable.</p>;
  const rows = q.data ?? [];
  if (!rows.length) return <><p className="ds-support">No website contact messages yet.</p><DemoConversations kind="contacts" /></>;
  return (
    <ul className="divide-y divide-ds-border rounded-ds border border-ds-border bg-ds-surface">
      {rows.map((c) => (
        <li key={c.id}>
          <button className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-ds-hover" aria-expanded={open === c.id}
            onClick={async () => { setOpen(open === c.id ? null : c.id); if (!c.read_at && canManage) { await mark({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ['frontend-contacts'] }); qc.invalidateQueries({ queryKey: ['frontend-contacts-unread'] }); } }}>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">{!c.read_at && <span aria-label="Unread" className="inline-block h-2 w-2 rounded-full bg-ds-error" />}{c.subject || 'No subject'}</span>
              <span className="ds-support block">{c.name}{c.business_name ? ` · ${c.business_name}` : ''} · {CAT[c.category ?? ''] ?? 'Not Provided'}</span>
            </span>
            <span className="ds-caption whitespace-nowrap">{fmt(c.created_at)}</span>
          </button>
          {open === c.id && (
            <div className="border-t border-ds-border bg-ds-sky px-4 py-3">
              <dl className="grid gap-1 sm:grid-cols-2">
                <div><dt className="ds-label inline">Email: </dt><dd className="inline">{c.email}</dd></div>
                <div><dt className="ds-label inline">Phone: </dt><dd className="inline">{c.phone || 'Not Provided'}</dd></div>
                <div><dt className="ds-label inline">Source: </dt><dd className="inline">{c.source === 'public_contact_form' ? 'Contact Us form' : 'Earlier website form'}</dd></div>
              </dl>
              <p className="mt-2 whitespace-pre-wrap">{c.message}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
