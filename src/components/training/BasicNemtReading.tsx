import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DsButton } from '@/components/ds/controls';
import { NEMT_PAGES } from '@/lib/training/basic-nemt-materials';
export function BasicNemtReading({ onExam }: { onExam?: () => void }) {
  const [index, setIndex] = useState(0);
  const page = NEMT_PAGES[index];
  if (!page) return null;
  return <div className="space-y-5"><p className="ds-support">Reading {index + 1} of {NEMT_PAGES.length} · About 5 minutes</p><h3 className="ds-subheading text-ds-primary">{page.title}</h3>{page.body.map((p, i) => <p key={i} className="ds-body">{p}</p>)}{page.bullets && <ul className="list-disc space-y-2 pl-5 ds-body">{page.bullets.map(b => <li key={b}>{b}</li>)}</ul>}{page.tip && <div className="rounded-ds border border-ds-sky-border bg-ds-sky p-4 ds-body"><strong>Florida NEMT Tip: </strong>{page.tip}</div>}{page.remember && <p className="ds-body"><strong>Remember: </strong>{page.remember}</p>}<div className="flex flex-wrap justify-between gap-3"><DsButton variant="ghost" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ArrowLeft className="size-4" />Back</DsButton>{index + 1 < NEMT_PAGES.length ? <DsButton onClick={() => setIndex(i => i + 1)}>Next page<ArrowRight className="size-4" /></DsButton> : onExam && <DsButton onClick={onExam}>Start final exam<ArrowRight className="size-4" /></DsButton>}</div></div>;
}