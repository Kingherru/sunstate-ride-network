import {describe,it,expect} from 'bun:test';
import {verifiedGuidePurchase,STARTUP_GUIDE} from '../src/lib/digital-guide';
import {invoiceEvidenceMatches} from '../src/lib/customer-payment-evidence';
import {commerceTotals,normalizeSelection} from '../src/lib/commerce-rules';
describe('Paid guide private access',()=>{
 const proof={ownerId:'owner',userId:'owner',complete:true,paid:true,environment:'live',priceMatches:true,refunded:false};
 it('requires authenticated purchaser identity',()=>expect(verifiedGuidePurchase({...proof,userId:'other'})).toBe(false));
 it('requires actual successful payment',()=>expect(verifiedGuidePurchase({...proof,paid:false})).toBe(false));
 it('does not unlock paid PDF from test evidence',()=>expect(verifiedGuidePurchase({...proof,environment:'sandbox'})).toBe(false));
 it('rejects reversed payments',()=>expect(verifiedGuidePurchase({...proof,refunded:true})).toBe(false));
 it('accepts matching live evidence only',()=>expect(verifiedGuidePurchase(proof)).toBe(true));
 it('keeps approved guide at $50 one-time',()=>expect(STARTUP_GUIDE.priceCents).toBe(5000));
});
describe('Exact invoice reconciliation boundary',()=>{
 const p={expectedIntent:'pi_a',intent:'pi_a',expectedAccount:'acct_a',account:'acct_a',expectedAmount:7000,amount:7000,currency:'usd',expectedEnvironment:'sandbox',environment:'sandbox',acceptanceId:'acceptance'};
 it('rejects unrelated connected account',()=>expect(invoiceEvidenceMatches({...p,account:'acct_other'})).toBe(false));
 it('rejects amount mismatch',()=>expect(invoiceEvidenceMatches({...p,amount:6999})).toBe(false));
 it('rejects missing acceptance',()=>expect(invoiceEvidenceMatches({...p,acceptanceId:null})).toBe(false));
 it('accepts exact authoritative bindings',()=>expect(invoiceEvidenceMatches(p)).toBe(true));
});
describe('Shared guide cart',()=>{
 const guide={id:'guide',slug:STARTUP_GUIDE.slug,title:STARTUP_GUIDE.title,price_cents:5000,price_id:STARTUP_GUIDE.priceKey,product_kind:'digital_guide'};
 it('retains $20 plus $10 recurring and $50 one-time',()=>expect(commerceTotals({base:true,network:true,courses:[guide]},false)).toEqual({recurringCents:3000,oneTimeCents:5000,dueTodayCents:8000}));
 it('does not allow add-on without base',()=>expect(normalizeSelection({base:false,network:true,courses:[guide]},{baseActive:false,addonActive:false,ownedCourseIds:[]}).network).toBe(false));
 it('does not duplicate a guide',()=>expect(normalizeSelection({base:false,network:false,courses:[guide,guide]},{baseActive:false,addonActive:false,ownedCourseIds:[]}).courses.length).toBe(1));
});