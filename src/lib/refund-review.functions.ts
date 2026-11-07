import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const getRefundReversalReview = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:master}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if (!master) throw new Error('Master Admin only.');
  const {data:rows,error}=await context.supabase.from('fin_admin_actions').select('id,action,amount_cents,reason,created_at,responsibility_evidence,policy_acceptance_id').not('responsibility_evidence','is',null).order('created_at',{ascending:false}).limit(100);
  if(error)throw new Error('Review unavailable.');
  const {data:invoices,error:invoiceError}=await context.supabase.from('trip_invoice_documents').select('id,mfn_id,status,total_cents,created_at').order('created_at',{ascending:false}).limit(100);
  if(invoiceError)throw new Error('Invoice oversight unavailable.');
  return {rows:rows??[],invoices:invoices??[]};
});