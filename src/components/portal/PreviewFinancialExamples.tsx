import { useState } from 'react';
import { DsButton } from '@/components/ds/controls';
import { StatusPill } from '@/components/ds/status';
import { usePortalPreview } from './preview-data';

const examples = {
  drivers: [
    { reference: 'Example trip 001', party: 'Example driver · Awaiting trip completion review', amount: '$85.00', status: 'Pending' },
    { reference: 'Example trip 002', party: 'Example contractor · Recorded completed-trip earnings', amount: '$95.00', status: 'Completed' },
  ],
  network: [
    { reference: 'Example referral 001', party: 'Example receiving provider · Held for settlement review', amount: '$140.00', status: 'Held' },
    { reference: 'Example referral 002', party: 'Example receiving provider · Eligibility recorded, release disabled', amount: '$180.00', status: 'Available' },
    { reference: 'Example referral 003', party: 'Example receiving provider · Historical payment illustration', amount: '$120.00', status: 'Paid' },
  ],
  provider: [
    { reference: 'Example held earnings', party: 'Settlement evidence pending · Not a bank balance', amount: '$140.00', status: 'Held' },
    { reference: 'Example available earnings', party: 'Recorded eligibility · Payout execution unavailable', amount: '$180.00', status: 'Available' },
  ],
  payouts: [
    { reference: 'Example payment 001', party: 'Historical payment illustration · No transfer was made', amount: '$120.00', status: 'Paid' },
    { reference: 'Example refund review', party: 'Refund responsibility review · No refund was issued', amount: '$60.00', status: 'Needs review' },
  ],
};
export function PreviewFinancialExamples({ section }: { section: keyof typeof examples }) {
  const preview = usePortalPreview();
  const [visible, setVisible] = useState(true);
  if (!preview.active || preview.kind !== 'provider') return null;
  return <section className="space-y-4">
    <div className="portal-toolbar"><p className="ds-caption">Preview examples only · Financial execution OFF</p><DsButton variant="ghost" size="sm" onClick={() => setVisible(v => !v)}>{visible ? 'Remove examples' : 'Show examples'}</DsButton></div>
    {visible ? <ul className="divide-y divide-ds-border">{examples[section].map(row => <li key={row.reference} className="grid min-w-0 gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="min-w-0"><h2 className="ds-label text-ds-primary">{row.reference}</h2><p className="ds-support mt-1">{row.party}</p></div><span className="portal-money shrink-0">{row.amount}</span><StatusPill status={row.status}/></li>)}</ul> : <p className="ds-support py-5">No preview examples shown.</p>}
  </section>;
}