import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {STARTUP_GUIDE} from './digital-guide';
import {z} from 'zod';
import {resourceEntitled,type ResourceEvidence} from './resource-entitlement';
export const downloadPurchasedGuide=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({action:z.enum(['open','download']).default('download')}).parse(v??{})).handler(async({context,data})=>{
 try{
 const {data:person}=await context.supabase.from('user_profiles').select('status,is_test_account,deleted_at').eq('user_id',context.userId).maybeSingle();
 if(!person||person.status!=='active'||person.is_test_account||person.deleted_at)throw new Error('Account unavailable.');
 const {data:course}=await context.supabase.from('courses').select('id,private_file_path,price_cents,resource_download_allowed').eq('slug',STARTUP_GUIDE.slug).eq('product_kind','digital_guide').maybeSingle();
 if(!course)throw new Error('Guide unavailable.');
 const {data:purchase}=await context.supabase.from('course_enrollments').select('id,user_id,stripe_session_id,status,resource_payment_evidence').eq('user_id',context.userId).eq('course_id',course.id).maybeSingle();
 if(!purchase?.stripe_session_id||!['active','completed'].includes(purchase.status))throw new Error('A successful guide purchase is required.');
 if(!resourceEntitled(purchase.resource_payment_evidence as ResourceEvidence|null,context.userId,course.id,purchase.stripe_session_id,course.price_cents))return {error:'Verified completed, non-refunded purchase evidence is not available. Payment verification setup requires owner approval.'};
 if(data.action==='download'&&!course.resource_download_allowed)return {error:'Download is not permitted by the current product policy.'};
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 if(course.private_file_path!==STARTUP_GUIDE.path)throw new Error('Private edition unavailable.');
 const {data:link,error}=await supabaseAdmin.storage.from(STARTUP_GUIDE.bucket).createSignedUrl(STARTUP_GUIDE.path,60,data.action==='download'?{download:'MY-FLORIDA-NEMT-30-Day-Planning-Guide.pdf'}:undefined);
 if(error||!link)throw new Error('Private file unavailable.');
 const {error:audit}=await supabaseAdmin.from('digital_guide_download_events').insert({user_id:context.userId,course_id:course.id,enrollment_id:purchase.id,action:data.action==='open'?'authorized_open':'authorized_download'});
 if(audit)throw new Error('Download evidence unavailable.');return {url:link.signedUrl,downloadAllowed:course.resource_download_allowed};
 }catch{return {error:'Guide download unavailable. A verified successful purchase and configured private delivery are required.'};}
});