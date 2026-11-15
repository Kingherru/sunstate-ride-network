import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const patientPeopleInput=z.object({patientId:z.string().uuid(),links:z.object({contactIds:z.array(z.string().uuid()).max(30),businessIds:z.array(z.string().uuid()).max(30)}).strict(),family:z.object({enabled:z.boolean(),contactId:z.string().uuid().optional(),consentBasis:z.enum(['patient','authorized_representative']),consentReference:z.string().trim().max(300),categories:z.array(z.enum(['upcoming','history','day_before','day_of','schedule_change','completion'])),fields:z.array(z.enum(['reference','status','pickup_date','pickup_time'])),recipientConfirmed:z.boolean(),reviewConfirmed:z.boolean()}).strict().nullable()}).strict();
export const savePatientPeople=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>patientPeopleInput.parse(v)).handler(async({data,context})=>{
 const {error}=await context.supabase.rpc('save_patient_relationship_preparation',{_patient:data.patientId,_links:data.links,_family:data.family});
 if(error)throw new Error('Relationships unavailable. Confirm consent and choose active records in this account.');return {ok:true as const};
});