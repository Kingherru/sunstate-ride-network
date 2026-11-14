import { useServerFn } from '@tanstack/react-start';
import { DsButton } from '@/components/ds/controls';
import { getWorkspaceConnectPreparation } from '@/lib/financial-preparation.functions';
import { usePortalQuery } from './preview-data';
export function ConnectPreparation({workspaceId}:{workspaceId:string}) {
  const get=useServerFn(getWorkspaceConnectPreparation);
  const q=usePortalQuery({queryKey:['connect-preparation',workspaceId],queryFn:()=>get({data:{workspaceId,environment:'sandbox'}})});
  const d=q.data;
  return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Stripe Connect — test preparation</h2><div className="portal-business-body space-y-3">
    <p className="ds-body">{q.isError?'Readiness unavailable':d?.state??'Not started'}</p>
    <ul className="ds-support space-y-1"><li>Customer payments: {d?.customerReady?'Stripe readiness recorded':'Not ready'}</li><li>Network payouts: {d?.networkReady?'Stripe readiness recorded':'Not ready'}</li><li>Connect event verification: {d?.signingConfigured?'Configured':'Secure configuration required'}</li></ul>
    <p className="ds-support">Setup is unavailable until the owner confirms payout liability and Stripe Accounts v2 with Express Dashboard access is configured. Policy review and verified configuration are also required. No connected account, Account Link or payment is created.</p>
  </div></section>;
}