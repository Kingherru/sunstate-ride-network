import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { REFUND_DRAFT } from './refund-policy-draft';
export const getAdminPayoutReview = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const { requireAdminCan, getAdminWorkspaceScope } = await import('./admin-guard.server');
  await requireAdminCan(context,'payouts','read');
  const scope=await getAdminWorkspaceScope(context);
  const {data:master}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  const {data:settlements,error}=await context.supabase.rpc('network_list_settlements');
  if(error)throw new Error('Payout evidence unavailable.');
  // Existing RPC already applies account scopes; never use a privileged broad ledger.
  const rows=(settlements??[]) as unknown as import('./network-settlements.functions').SettlementRow[];
  let accountsQuery=context.supabase.from('provider_payout_accounts').select('workspace_id,environment,status,charges_enabled,payouts_enabled,details_submitted,identity_ready');
  if(!scope.all){ if(!scope.workspaceIds.length)return {rows:[],accounts:[],master:!!master,refunds:[],versions:[]};accountsQuery=accountsQuery.in('workspace_id',scope.workspaceIds); }
  const {data:accounts,error:accountError}=await accountsQuery;
  if(accountError)throw new Error('Connect evidence unavailable.');
  const {data:refunds,error:refundError}=master?await context.supabase.from('fin_admin_actions').select('id,action,amount_cents,reason,created_at,responsibility_evidence,policy_acceptance_id').not('responsibility_evidence','is',null).order('created_at',{ascending:false}).limit(100):{data:[],error:null};
  const {data:versions,error:versionError}=master?await context.supabase.from('refund_policy_versions').select('version,state,terms_version,matrix,effective_from,effective_through,created_at,source_version').order('created_at',{ascending:false}):{data:[],error:null};
  if(refundError||versionError)throw new Error('Refund review unavailable.');
  return {rows,accounts:accounts??[],master:!!master,refunds:refunds??[],versions:versions??[]};
});
/** Future owner draft persistence only; no approval/money endpoint. Not exercised on real data in this pass. */
export const retainRefundPolicyDraft=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:master}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!master)throw new Error('Master Admin required.');
 const {error}=await context.supabase.from('refund_policy_versions').upsert({version:REFUND_DRAFT.version,state:'draft',terms_version:REFUND_DRAFT.termsVersion,matrix:REFUND_DRAFT.matrix,created_by:context.userId},{onConflict:'version',ignoreDuplicates:true});
 if(error)throw new Error('Draft could not be retained.');return {ok:true as const,version:REFUND_DRAFT.version};
});