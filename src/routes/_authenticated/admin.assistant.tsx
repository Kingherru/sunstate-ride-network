import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { PageHead } from '@/components/portal/PortalShell';
import { DsButton } from '@/components/ds/controls';
import { askAdminAssistant } from '@/lib/ai-assistant.functions';

type Task = 'note_to_trip' | 'summarize' | 'training' | 'draft_message' | 'ask';
const TASKS: { id: Task; label: string; placeholder: string }[] = [
  { id: 'note_to_trip', label: 'Note to trip', placeholder: 'Paste a quick note, e.g. "Wheelchair pickup Tue 9am 12 Oak St to Tampa General, return 1pm"' },
  { id: 'summarize', label: 'Summarize request', placeholder: 'Paste trip or request details to summarize…' },
  { id: 'training', label: 'Training explainer', placeholder: 'Which training topic should be explained?' },
  { id: 'draft_message', label: 'Draft a message', placeholder: 'Who is it for and what should it say?' },
  { id: 'ask', label: 'Ask anything', placeholder: 'Ask a question…' },
];

export const Route = createFileRoute('/_authenticated/admin/assistant')({
  head: () => ({ meta: [{ title: 'AI Assistant — MY FLORIDA NEMT' }, { name: 'description', content: 'Master Admin AI assistant for notes, summaries, training and drafts.' }, { property: 'og:title', content: 'AI Assistant — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Protected admin AI assistant.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: Assistant,
});

function Assistant() {
  const ask = useServerFn(askAdminAssistant);
  const [task, setTask] = useState<Task>('note_to_trip');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const current = TASKS.find(t => t.id === task)!;

  async function run() {
    setBusy(true); setError(''); setAnswer('');
    try {
      const r = await ask({ data: { task, text } });
      if ('error' in r && r.error) setError(r.error); else setAnswer(r.text ?? '');
    } catch { setError('The AI could not answer. Please try again.'); }
    finally { setBusy(false); }
  }

  return <>
    <PageHead title="AI assistant" />
    <p className="ds-support mb-4">Results are suggestions only. Nothing is saved, sent, submitted or charged.</p>
    <div role="tablist" className="mb-4 flex flex-wrap gap-2">
      {TASKS.map(t => <DsButton key={t.id} role="tab" aria-selected={task === t.id} size="sm" variant={task === t.id ? 'secondary' : 'ghost'} onClick={() => setTask(t.id)}>{t.label}</DsButton>)}
    </div>
    <textarea aria-label={current.label} value={text} onChange={e => setText(e.target.value)} placeholder={current.placeholder} maxLength={8000} rows={6} className="w-full rounded-ds-sm border border-ds-border bg-ds-surface p-3 text-ds-text" />
    <DsButton className="mt-3" disabled={busy || !text.trim()} onClick={run}>{busy ? 'THINKING…' : 'ASK AI'}</DsButton>
    {error && <p role="alert" className="mt-4 text-ds-error">{error}</p>}
    {answer && <article className="mt-5 whitespace-pre-wrap rounded-ds border border-ds-sky-border bg-ds-sky p-5 text-ds-text">{answer}</article>}
  </>;
}
