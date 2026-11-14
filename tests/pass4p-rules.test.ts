import { describe,it,expect } from 'vitest';
import { contractorServicesAllowed,documentState,delaySchema,textSizeSchema,providerSubtypeSchema } from '../src/lib/pass4p-rules';
describe('Pass 4P policies',()=>{
 it('contractor allows ambulatory capability only',()=>expect(contractorServicesAllowed('independent_contractor',['ambulatory'])).toBe(true));
 it('contractor rejects wheelchair',()=>expect(contractorServicesAllowed('independent_contractor',['wheelchair'])).toBe(false));
 it('contractor rejects stretcher',()=>expect(contractorServicesAllowed('independent_contractor',['stretcher'])).toBe(false));
 it('business services remain supported',()=>expect(contractorServicesAllowed('nemt_business',['ambulatory','wheelchair','stretcher'])).toBe(true));
 it('absence is missing evidence',()=>expect(documentState()).toBe('Missing'));
 it('upload alone never satisfies a requirement',()=>expect(documentState({doc_path:'credentials/owner/file.pdf'})).toBe('Under Review / Unable to Validate'));
 it('expired evidence fails',()=>expect(documentState({doc_path:'private',expires_at:'2026-01-01'},'2026-11-14')).toBe('Expired'));
 it('threshold presets are valid',()=>[5,10,15].forEach(v=>expect(delaySchema.parse(v)).toBe(v)));
 it('custom threshold has safe range',()=>{expect(delaySchema.safeParse(0).success).toBe(false);expect(delaySchema.safeParse(121).success).toBe(false);expect(delaySchema.safeParse(7.5).success).toBe(false);});
 it('text sizes are closed validated values',()=>{for(const v of ['compact','standard','comfortable','extra_large'])expect(textSizeSchema.parse(v)).toBe(v);expect(textSizeSchema.safeParse('huge').success).toBe(false);});
 it('subtype cannot be a permission role',()=>expect(providerSubtypeSchema.safeParse('admin').success).toBe(false));
});