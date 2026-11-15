import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { TripInvoice, InvoiceLine } from './trip-invoice-rules';
import {regionalInvoiceProjection} from './regional-projections';
import {tripTimeEvidence} from './regional-trip-times';
export const previewDraftInvoice=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({draftId:z.string().uuid(),pdf:z.boolean().default(false)}).strict().parse(v)).handler(async({data,context})=>{
 const {data:draft}=await context.supabase.from('trip_drafts').select('payload,customer_quote_history').eq('id',data.draftId).eq('user_id',context.userId).is('submitted_trip_id',null).maybeSingle();
 if(!draft)throw new Error('Draft invoice unavailable.');
 const history=Array.isArray(draft.customer_quote_history)?draft.customer_quote_history:[];
 const quote=history.at(-1) as {formFingerprint?:string;lines:InvoiceLine[];totalCents:number;version:number;terms?:string;workspaceId?:string;requestBinding?:Record<string,unknown>}|undefined;
 if(!quote)throw new Error('Review and lock a customer quote first.');
 const {data:fingerprint,error}=await context.supabase.rpc('customer_quote_fingerprint',{_form:draft.payload as never});
 if(error||!fingerprint||quote.formFingerprint!==fingerprint)throw new Error('Trip details changed; review a fresh quote.');
 const form=draft.payload as Record<string,unknown>;
 const binding=quote.requestBinding;
 if(binding){const bill=form.billingContact as {firstName?:string;lastName?:string;email?:string;phone?:string}|undefined;const expected={savedPatientId:form.savedPatientId??null,payerId:form.payerId??null,coordinationContactId:form.coordinationContactId??null,passengerCount:form.passengerCount??1,wheelchairPositions:form.wheelchairPositions??0,patientFirstName:form.patientFirstName,patientLastName:form.patientLastName,patientPhone:form.patientPhone,appointmentTime:form.appointmentTime??'',returnDropoffTime:form.returnDropoffTime??'',billingSource:form.billingSource??'account',billingFirstName:bill?.firstName??null,billingLastName:bill?.lastName??null,billingEmail:bill?.email??null,billingPhone:bill?.phone??null};if(Object.entries(expected).some(([key,value])=>binding[key]!==value))throw new Error('Patient, payer or schedule changed; review a fresh quote.');}
 const {data:provider}=quote.workspaceId?await context.supabase.from('workspaces').select('display_name').eq('id',quote.workspaceId).maybeSingle():{data:null};
 const bill=form.billingContact as {firstName?:string;lastName?:string}|undefined;
 const invoice:TripInvoice={regionalContext:regionalInvoiceProjection({...form,events:tripTimeEvidence(form)}),id:data.draftId,mfnId:'DRAFT — NOT ISSUED',requestId:data.draftId,requestNumber:'Unsubmitted trip draft',providerName:provider?.display_name??'Selected provider',billTo:bill?[bill.firstName,bill.lastName].filter(Boolean).join(' '):[form.patientFirstName,form.patientLastName].filter(Boolean).join(' '),providerPhone:null,lines:quote.lines,totalCents:quote.totalCents,paidCents:0,balanceCents:quote.totalCents,status:'draft',quoteVersion:quote.version,terms:quote.terms??'',dueAt:null,createdAt:new Date().toISOString(),canManage:false,canPay:false,paymentConfigured:false,history:[]};
 if(!data.pdf)return {invoice,base64:null};
 const {renderTripInvoicePdf}=await import('./trip-invoice-pdf');const bytes=await renderTripInvoicePdf(invoice);return {invoice,base64:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))};
});
