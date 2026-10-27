import { useState } from 'react';
import { DsButton } from '@/components/ds/controls';

/** In-memory DEMO fixtures only: no real people, never stored, no send action. */
const FIXTURES = {
  messages: [
    { id: 'd1', title: 'Sample Facility Coordinator', meta: 'Account conversation', body: 'Hello, could you confirm the pickup window for tomorrow morning?' },
    { id: 'd2', title: 'Sample Provider Dispatcher', meta: 'Account conversation', body: 'Our team has updated the service area for the coming week.' },
  ],
  contacts: [
    { id: 'd3', title: 'New business inquiry', meta: 'Sample Visitor · Sample Business', body: 'We would like to learn how our clinic can request rides.' },
    { id: 'd4', title: 'Website problem', meta: 'Sample Visitor', body: 'The page did not load on my phone yesterday.' },
  ],
} as const;

export function DemoConversations({ kind }: { kind: keyof typeof FIXTURES }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section aria-label="Demo samples" className="mt-4 rounded-ds border border-ds-peach-border bg-ds-peach p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ds-peach-border pb-2">
        <p className="ds-label uppercase text-ds-primary">DEMO samples — not real messages, nothing can be sent</p>
        <DsButton size="sm" variant="ghost" onClick={() => setHidden(true)}>Remove samples</DsButton>
      </div>
      <ul className="mt-2 divide-y divide-ds-peach-border">
        {FIXTURES[kind].map((f) => (
          <li key={f.id} className="py-3">
            <p className="font-semibold"><span className="mr-2 rounded-ds-sm border border-ds-peach-border bg-ds-surface px-1.5 text-xs">DEMO</span>{f.title}</p>
            <p className="ds-support">{f.meta}</p>
            <p className="mt-1">{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
