import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const getAccountProfileVerification=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.rpc('my_account_profile_verification');
 if(error)throw new Error('Account status not available');
 return data as unknown as {status:'verified'|'incomplete';workspace_mfn_id:string;reasons:string[];version:string}[];
});