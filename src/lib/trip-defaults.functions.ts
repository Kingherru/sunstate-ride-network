import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {approvedPatientDefaults,type BasicTripDefaults} from './trip-defaults.rules';
export const getTripDefaults=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:members}=await context.supabase.from('workspace_members').select('workspace_id,role,is_contractor,workspaces!inner(account_type,status,is_test_account,display_name,business_phone,business_address)').eq('user_id',context.userId).is('removed_at',null);
 const eligible=(members??[]).filter(m=>!m.is_contractor && ['owner','admin'].includes(m.role) && m.workspaces.status==='active' && !m.workspaces.is_test_account);
 const ws=eligible.length===1?eligible[0]:null;
 if(!ws)return {workspaceId:null,accountType:null,defaults:null};
 if(ws.workspaces.account_type!=='private_pay')return {workspaceId:ws.workspace_id,accountType:ws.workspaces.account_type,defaults:null};
 const [{data:person},{data:patients}]=await Promise.all([
 context.supabase.from('user_profiles').select('phone').eq('user_id',context.userId).maybeSingle(),
 context.supabase.from('saved_patients').select('first_name,last_name,phone,email,mobility').eq('owner_id',context.userId).eq('active',true).eq('kind','patient').limit(2)]);
 const p=patients?.length===1?patients[0]:null;
 return {workspaceId:ws.workspace_id,accountType:'private_pay',defaults:p?approvedPatientDefaults({...p,phone:p.phone||person?.phone}):null};
});
export const getLinkedPatientTripDefaults=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({sourceId:z.string().uuid(),patientId:z.string().uuid()}).strict().parse(i)).handler(async({data,context})=>{
 const {data:out,error}=await context.supabase.rpc('linked_patient_trip_defaults',{_source:data.sourceId,_patient:data.patientId});
 if(error || !out)throw new Error('Patient not available');
 return out as unknown as BasicTripDefaults;
});
export const getFacilityAuthorizedPatients=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({sourceId:z.string().uuid()}).strict().parse(i)).handler(async({data,context})=>{
 const {data:rows,error}=await context.supabase.rpc('list_facility_authorized_patients',{_source:data.sourceId});
 if(error)throw new Error('Patient not available');
 return rows as unknown as (BasicTripDefaults & {savedPatientId:string;facilityMfnId:string})[];
});