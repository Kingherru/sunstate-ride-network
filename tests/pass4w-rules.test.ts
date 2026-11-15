import {describe,it,expect} from 'vitest';
import {resourceEntitled} from '../src/lib/resource-entitlement';
import {reviewContact,contactDuplicate,guessContactColumn} from '../src/lib/contact-import';
import {applicableRate} from '../src/lib/payer-rate-selection';
import {recipientCurrent} from '../src/lib/family-recipient';
import {buildReadiness} from '../src/lib/launch-readiness';
import {canUploadCsvRequests} from '../src/lib/csv-access';
describe('stored digital entitlement',()=>{
 const e={state:'completed_paid',environment:'live',userId:'a',courseId:'g',sessionId:'s',verified:true,reversed:false,refunded:false,disputed:false,test:false,catalogPriceCents:5000};
 it('requires exact completed live purchase',()=>expect(resourceEntitled(e,'a','g','s',5000)).toBe(true));
 it.each(['refunded','reversed','disputed','test'] as const)('rejects %s',k=>expect(resourceEntitled({...e,[k]:true},'a','g','s',5000)).toBe(false));
 it('rejects another purchaser',()=>expect(resourceEntitled(e,'b','g','s',5000)).toBe(false));
 it('rejects enrollment without payment evidence',()=>expect(resourceEntitled(null,'a','g','s',5000)).toBe(false));
 it('rejects failed evidence',()=>expect(resourceEntitled({...e,state:'failed'},'a','g','s',5000)).toBe(false));
 it('rejects sandbox evidence',()=>expect(resourceEntitled({...e,environment:'sandbox'},'a','g','s',5000)).toBe(false));
});
describe('contact import review',()=>{
 it('flags missing name',()=>expect(reviewContact({email:'family@example.test'}).errors.length).toBeGreaterThan(0));
 it('flags invalid phone',()=>expect(reviewContact({first_name:'Test',last_name:'Person',phone:'abc123'}).errors.length).toBeGreaterThan(0));
 it('flags invalid email',()=>expect(reviewContact({first_name:'Test',last_name:'Person',email:'broken'}).errors.length).toBeGreaterThan(0));
 it('dedupes normalized email',()=>expect(contactDuplicate({email:' FAMILY@example.test '},{email:'family@example.test'})).toBe(true));
 it('does not merge different people solely on blank fields',()=>expect(contactDuplicate({},{first_name:'Test'})).toBe(false));
 it('maps phone without inferring accounts',()=>expect(guessContactColumn('Telephone')).toBe('phone'));
 it('permits one authorized provider manager import workspace',()=>expect(canUploadCsvRequests([{type:'provider',status:'active',role:'owner'}])).toBe(true));
 it('rejects multiple import workspaces',()=>expect(canUploadCsvRequests([{type:'provider',status:'active',role:'owner'},{type:'facility',status:'active',role:'owner'}])).toBe(false));
});
describe('payer version dates',()=>{
 const base={payer_id:null,effective_at:'2026-01-01T00:00:00Z',version:1};const payer={payer_id:'p',effective_at:'2026-11-01T00:00:00Z',effective_end:'2026-11-30',agreement_active:true,version:2};
 it('selects exact payer on trip date',()=>expect(applicableRate([base,payer],'p','2026-11-15')?.version).toBe(2));
 it('rejects future rates',()=>expect(applicableRate([payer],'p','2026-10-31')).toBeNull());
 it('rejects expired rates',()=>expect(applicableRate([payer],'p','2026-12-01')).toBeNull());
 it('inactive newest version does not revive older rates',()=>expect(applicableRate([payer,{...payer,agreement_active:false,version:3}],'p','2026-11-15')).toBeNull());
 it('does not select unrelated payer',()=>expect(applicableRate([payer],'other','2026-11-15')).toBeNull());
 it('standard fallback remains separate',()=>expect(applicableRate([base,payer],null,'2026-11-15')?.version).toBe(1));
});
describe('family recipient invalidation',()=>{
 it('changed email invalidates confirmation',()=>expect(recipientCurrent({recipientEmail:'old@example.test',emailConfirmed:true},'new@example.test',true)).toBe(false));
 it('checkbox preparation never confirms email',()=>expect(recipientCurrent({recipientEmail:'same@example.test',emailConfirmed:false},'same@example.test',true)).toBe(false));
 it('inactive contact never valid',()=>expect(recipientCurrent({recipientEmail:'same@example.test',emailConfirmed:true},'same@example.test',false)).toBe(false));
});
describe('readiness evidence',()=>{
 const i={prices:{},liveTokenPresent:false,mainSecret:false,connectSecret:false,flags:{},placeholderPhone:true,testAccounts:{total:7,disabled:7},settlementLedger:true,connectedAccounts:0};
 it('missing mapping is not ready',()=>expect(buildReadiness(i)[0].items[0].tone).toBe('red'));
 it('placeholder requires attention',()=>expect(buildReadiness(i).flatMap(g=>g.items).find(r=>r.label==='Public phone number')?.tone).toBe('red'));
 it('missing launch flag is off',()=>expect(buildReadiness(i).flatMap(g=>g.items).find(r=>r.label==='Family notification delivery')?.status).toBe('Prepared — OFF'));
});