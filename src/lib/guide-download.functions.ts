import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {STARTUP_GUIDE,verifiedGuidePurchase} from './digital-guide';
export const downloadPurchasedGuide=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 try{
 const {data:course}=await context.supabase.from('courses').select('id').eq('slug',STARTUP_GUIDE.slug).eq('product_kind','digital_guide').maybeSingle();
 if(!course)throw new Error('Guide unavailable.');
 const {data:purchase}=await context.supabase.from('course_enrollments').select('id,user_id,stripe_session_id,status').eq('user_id',context.userId).eq('course_id',course.id).maybeSingle();
 if(!purchase?.stripe_session_id||!['active','completed'].includes(purchase.status))throw new Error('A successful guide purchase is required.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:gate}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','digital_guide_delivery').maybeSingle();
 if(gate?.enabled!==true)return {error:'Guide delivery is not enabled. Private upload and approved purchase terms are required.'};
 const {createStripeClient}=await import('./stripe.server');const stripe=createStripeClient('live');
 const session=await stripe.checkout.sessions.retrieve(purchase.stripe_session_id,{expand:['payment_intent']});
 const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:100});
 const priceMatches=!lines.has_more&&lines.data.some(l=>l.price?.lookup_key===STARTUP_GUIDE.priceKey&&l.price.unit_amount===5000&&l.price.currency==='usd'&&l.quantity===1);
 const intent=typeof session.payment_intent==='object'?session.payment_intent:null;
 if(!intent||intent.status!=='succeeded')throw new Error('Payment evidence unavailable.');
 const charges=await stripe.charges.list({payment_intent:intent.id,limit:100});
 if(charges.has_more||!charges.data.length)throw new Error('Payment review required.');
 if(!verifiedGuidePurchase({ownerId:session.metadata?.userId??'',userId:context.userId,complete:session.status==='complete',paid:session.payment_status==='paid',environment:session.livemode?'live':'sandbox',priceMatches,refunded:charges.data.some(c=>c.amount_refunded>0||c.disputed)}))throw new Error('Successful non-reversed purchase required.');
 const {data:link,error}=await supabaseAdmin.storage.from(STARTUP_GUIDE.bucket).createSignedUrl(STARTUP_GUIDE.path,60,{download:'MY-FLORIDA-NEMT-30-Day-Startup-Guide.pdf'});
 if(error||!link)throw new Error('Private file unavailable.');
 const {error:audit}=await supabaseAdmin.from('digital_guide_download_events').insert({user_id:context.userId,course_id:course.id,enrollment_id:purchase.id,action:'signed_access_issued'});
 if(audit)throw new Error('Download evidence unavailable.');return {url:link.signedUrl};
 }catch{return {error:'Guide download unavailable. A verified successful purchase and configured private delivery are required.'};}
});