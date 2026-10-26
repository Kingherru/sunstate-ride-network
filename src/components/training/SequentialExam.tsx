import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { DsButton, DsInput } from '@/components/ds/controls';
import { checkMyCourseAnswer } from '@/lib/courses.functions';
export function SequentialExam({ enrollmentId, questions, onSubmit, submitting, preview = false }: {
  enrollmentId: string; questions: { id: string; prompt: string; choices: unknown }[];
  onSubmit: (answers: Record<string, number>, name: string) => void; submitting: boolean; preview?: boolean;
}) {
  const check = useServerFn(checkMyCourseAnswer);
  const [index, setIndex] = useState(0), [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const q = questions[index];
  if (!q) return <p>No test questions are available.</p>;
  const choices = Array.isArray(q.choices) ? q.choices as string[] : [];
  async function submitAnswer() {
    if (selected === null) return;
    if (preview) { setError('Preview only — tests cannot be submitted.'); return; }
    setBusy(true); setError('');
    try {
      const result = await check({ data: { enrollmentId, questionId: q.id, answer: selected } });
      setAnswers(prev => ({ ...prev, [q.id]: selected })); setFeedback(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to check answer'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <label className="block ds-label">Name on certificate<DsInput className="mt-2" value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label>
    <p className="ds-support">Question {index + 1} of {questions.length}</p>
    <fieldset className="rounded-ds border border-ds-sky-border bg-ds-sky p-5"><legend className="ds-subheading px-1 text-ds-primary">{q.prompt}</legend><div className="space-y-3">{choices.map((choice, i) => <label key={i} className="flex items-start gap-3 ds-body"><input type="radio" name={q.id} checked={selected === i} disabled={!!feedback} onChange={() => setSelected(i)} className="mt-1 !min-h-0 !p-0" />{choice}</label>)}</div></fieldset>
    {feedback && <div className={`rounded-ds border p-4 ${feedback.correct ? 'border-ds-green-border bg-ds-green' : 'border-ds-peach-border bg-ds-peach'}`}><p className="ds-label">{feedback.correct ? 'Correct' : 'Not quite'}</p><p className="ds-body mt-1">{feedback.explanation}</p></div>}
    {error && <p role="alert" className="text-ds-error">{error}</p>}
    {!feedback ? <DsButton disabled={selected === null || busy || !name.trim()} onClick={submitAnswer}>{busy ? 'Checking…' : 'Submit answer'}</DsButton> : <DsButton disabled={submitting} onClick={() => { if (index + 1 === questions.length) onSubmit(answers, name.trim()); else { setIndex(i => i + 1); setSelected(null); setFeedback(null); } }}>{index + 1 === questions.length ? (submitting ? 'Submitting…' : 'View results') : 'Next question'}<ArrowRight className="size-4" /></DsButton>}
    <DsButton variant="ghost" onClick={() => { setIndex(0); setAnswers({}); setSelected(null); setFeedback(null); }}><RotateCcw className="size-4" />Restart test</DsButton>
  </div>;
}