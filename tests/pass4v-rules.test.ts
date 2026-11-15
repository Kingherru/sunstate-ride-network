import {describe,it,expect} from 'vitest';
import {contactInput} from '../src/lib/contact-rules';
import {patientStage} from '../src/lib/patient-timeline';
import {normalizeSelection,commerceTotals} from '../src/lib/commerce-rules';
import {patientDetailFields} from '../src/lib/patient-detail-presentation';
describe('Pass 4V safe operations',()=>{
 it('one contact supports family and payer roles',()=>{const c=contactInput.parse({contact_type:'personal',first_name:'Demo',last_name:'Person',contact_roles:['family','payer']});expect(c.contact_roles).toEqual(['family','payer']);});
 it('rejects unsupported contact roles',()=>expect(contactInput.safeParse({contact_type:'personal',company_name:'Demo',contact_roles:['admin']}).success).toBe(false));
 it('maps payment pending to Waiting on Payment without changing source state',()=>expect(patientStage('payment_pending')).toBe('Waiting on Payment'));
 it('maps denied to the existing declined display group',()=>expect(patientStage('denied')).toBe('Declined'));
 it('preserves $20 provider base and $10 Network pricing',()=>expect(commerceTotals({base:true,network:true,courses:[]},false).recurringCents).toBe(3000));
 it('keeps $20 contractor exclusive of business memberships',()=>{const s=normalizeSelection({base:true,network:true,contractor:true,courses:[]},{baseActive:false,addonActive:false,ownedCourseIds:[]});expect(s.base).toBe(false);expect(s.network).toBe(false);expect(commerceTotals(s,false).recurringCents).toBe(2000);});
 it('prevents duplicate Network add-ons',()=>expect(normalizeSelection({base:false,network:true,courses:[]},{baseActive:true,addonActive:true,ownedCourseIds:[]}).network).toBe(false));
 it('patient details exclude internal notes and private rates',()=>{const fields=patientDetailFields({pickup_address:'Demo pickup',special_instructions:'private internal note',base_price_cents:1234});expect(fields.some(f=>f.value==='private internal note'||f.value==='1234')).toBe(false);expect(fields.find(f=>f.label==='Pickup')?.value).toBe('Demo pickup');});
});