import { expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const b:any={middleware:()=>b,inputValidator:()=>b,handler:(h:any)=>h};return b;}}));
vi.mock('../src/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
import { getTripInvoice, downloadTripInvoice, prepareSecureInvoicePayment } from '../src/lib/trip-invoices.functions';
import { saveTripDraft } from '../src/lib/trip-drafts.functions';
import { DEFAULT_PROVIDER_RESERVATION, PROVIDER_RESERVATION_TABS } from '../src/components/portal/provider-trip-navigation';
import { canAttachTripQuote, tripReviewKey, workspaceQuoteInput } from '../src/lib/trip-workspace-review';
import { currentCheckoutConsent } from '../src/lib/payment-policy';
import { linkedInvoiceVisible } from '../src/lib/invoice-visibility';
import { readSecureInvoice } from '../src/lib/invoice-access.functions';
import { previewDraftInvoice } from '../src/lib/draft-invoice.functions';
const privileged=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../src/integrations/supabase/client.server',()=>({supabaseAdmin:privileged}));
vi.mock('../src/lib/account-connections-token.server',()=>({hashInvitationToken:async()=> 'a'.repeat(64),constantTimeHashEqual:()=>true}));

it('defaults Reservations to Booked and preserves the requested lifecycle order',()=>{
  expect(DEFAULT_PROVIDER_RESERVATION).toBe('booked');
  expect(PROVIDER_RESERVATION_TABS.map(t=>t.value)).toEqual(['unconfirmed','drafts','booked','past','canceled','history']);
});
it('legacy invoices remain visible and explicit provider false hides linked customer copies',()=>{
  expect(linkedInvoiceVisible(undefined)).toBe(true);
  expect(linkedInvoiceVisible(null)).toBe(true);
  expect(linkedInvoiceVisible(true)).toBe(true);
  expect(linkedInvoiceVisible(false)).toBe(false);
});
it('a previously prepared secure link cannot bypass hidden customer invoice visibility',async()=>{
  privileged.from.mockImplementation((table:string)=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='trip_invoice_access_tokens'?{token_hash:'a'.repeat(64),expires_at:'2099-01-01',invoice_id:'invoice'}:{show_to_linked_accounts:false}})};return q;});
  expect(await (readSecureInvoice as any)({data:{token:'a'.repeat(64)}})).toEqual({error:'Invoice link unavailable or expired.'});
  expect(privileged.from.mock.calls.map(c=>c[0])).toEqual(['trip_invoice_access_tokens','trip_invoice_documents']);
});
it('draft PDF uses the existing renderer with owner filtering and no issued/payment identity',async()=>{
  const q:any={};for(const m of ['select','eq','is'])q[m]=vi.fn(()=>q);
  q.maybeSingle=async()=>({data:{payload:{patientFirstName:'Synthetic',patientLastName:'Passenger'},customer_quote_history:[{formFingerprint:'same',lines:[{label:'Pickup',cents:5000}],totalCents:5000,version:1}]}});
  const result=await (previewDraftInvoice as any)({data:{draftId:'draft',pdf:true},context:{userId:'owner',supabase:{from:()=>q,rpc:async()=>({data:'same'})}}});
  expect(q.eq).toHaveBeenCalledWith('user_id','owner');
  expect(atob(result.base64).slice(0,5)).toBe('%PDF-');
  expect(result.invoice).toMatchObject({status:'draft',paymentConfigured:false,canPay:false});
});
it.each(['linked patient','linked facility','unrelated user'])('a denied %s invoice projection cannot read or download',async()=>{
  const rpc=vi.fn(async()=>({data:null,error:null}));
  const args={data:{invoiceId:'invoice'},context:{supabase:{rpc}}};
  expect(await (getTripInvoice as any)(args)).toBeNull();
  await expect((downloadTripInvoice as any)(args)).rejects.toThrow('Invoice unavailable');
  expect(rpc).toHaveBeenCalledWith('get_trip_invoice_snapshot',{_invoice:'invoice'});
});
it('authorized manager invoice read retains financial data through the shared gated projection',async()=>{
  const invoice={totalCents:7000,canManage:true};
  const rpc=vi.fn(async(name:string)=>({data:name==='get_trip_invoice_snapshot'?invoice:[],error:null}));
  const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{enabled:false}})};
  expect(await (getTripInvoice as any)({data:{invoiceId:'invoice'},context:{supabase:{rpc,from:()=>q}}})).toMatchObject(invoice);
  expect(rpc).not.toHaveBeenCalledWith('invoice_viewed',expect.anything());
});
it('disabled secure payment preparation creates no payment and retains the blocker',async()=>{
  const rpc=vi.fn(async()=>({data:{totalCents:7000},error:null}));
  const result=await (prepareSecureInvoicePayment as any)({data:{invoiceId:'invoice',policyConsent:currentCheckoutConsent(true)},context:{supabase:{rpc}}});
  expect(result.creationAllowed).toBe(false);
  expect(result.error).toContain('not enabled');
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('draft visibility saves on the same owner-scoped unsubmitted draft, not a second record',async()=>{
  const q:any={};for(const m of ['update','eq','is','select'])q[m]=vi.fn(()=>q);
  q.maybeSingle=async()=>({data:{id:'draft'},error:null});q.insert=vi.fn();
  await (saveTripDraft as any)({data:{draft_id:'draft',payload:{showInvoiceToLinkedAccount:false}},context:{userId:'owner',supabase:{from:()=>q}}});
  expect(q.update.mock.calls[0][0].payload.showInvoiceToLinkedAccount).toBe(false);
  expect(q.eq).toHaveBeenCalledWith('user_id','owner');expect(q.is).toHaveBeenCalledWith('submitted_trip_id',null);expect(q.insert).not.toHaveBeenCalled();
});
it('missing mileage is never guessed and changed reviewed inputs cannot attach stale quotes',()=>{
  const form:any={transportType:'ambulatory',pickupDate:'2026-11-25',pickupTime:'09:00',tripType:'one_way',additionalStops:[],passengerCount:1};
  expect(workspaceQuoteInput(form,'','0')).toBeNull();
  expect(workspaceQuoteInput({...form,tripType:'round_trip'},'12','30')).toMatchObject({miles:12,waitMinutes:30,roundTrip:true});
  expect(canAttachTripQuote({currentKey:tripReviewKey(form,{miles:20}),confirmedKey:tripReviewKey(form,{miles:12}),quoteId:'quote',draftId:'draft',referral:false})).toBe(false);
});