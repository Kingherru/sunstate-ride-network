import { expect,test } from 'bun:test';
import {verifyWebhook} from '../src/lib/stripe.server';
test('sandbox signature, malformed timestamp, wrong secret and tamper fail closed',async()=>{
 const old=process.env['PAYMENTS_SANDBOX_WEBHOOK_SECRET'];process.env['PAYMENTS_SANDBOX_WEBHOOK_SECRET']='isolated_synthetic_test_secret';
 try{
  const body=JSON.stringify({id:'evt_synthetic',livemode:false,type:'payment_intent.succeeded',data:{object:{id:'pi_synthetic'}}});const t=String(Math.floor(Date.now()/1000));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('isolated_synthetic_test_secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${body}`));const signature=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const req=(text=body,time=t,sig=signature)=>new Request('http://localhost/webhook',{method:'POST',headers:{'stripe-signature':`t=${time},v1=${sig}`},body:text});
  expect((await verifyWebhook(req(),'sandbox')).type).toBe('payment_intent.succeeded');
  await expect(verifyWebhook(req(body,'NaN'),'sandbox')).rejects.toThrow();
  await expect(verifyWebhook(req(body+' '),'sandbox')).rejects.toThrow();
  await expect(verifyWebhook(req(body,t,'0'.repeat(64)),'sandbox')).rejects.toThrow();
 }finally{if(old===undefined)delete process.env['PAYMENTS_SANDBOX_WEBHOOK_SECRET'];else process.env['PAYMENTS_SANDBOX_WEBHOOK_SECRET']=old;}
});