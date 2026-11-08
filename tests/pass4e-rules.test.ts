import {describe,it,expect} from 'vitest';
import {businessVisibilityInput,searchableBusiness} from '../src/lib/business-visibility-rules';
import {patientStage,patientTimeline,patientTripGroup} from '../src/lib/patient-timeline';
describe('Business audience and patient timeline boundaries',()=>{
 it('requires active explicit opt-in, never infers consent',()=>{expect(searchableBusiness('provider',true,null)).toBe(false);expect(searchableBusiness('facility',true,false)).toBe(false);expect(searchableBusiness('facility',true,true)).toBe(true);expect(searchableBusiness('provider',false,true)).toBe(false);});
 it('never lists Patient/Personal accounts',()=>expect(searchableBusiness('private_pay',true,true)).toBe(false));
 it('requires audience-specific plain confirmation',()=>{expect(businessVisibilityInput.safeParse({workspaceId:'00000000-0000-4000-8000-000000000001',audience:'public',enabled:true,confirmed:false}).success).toBe(false);expect(businessVisibilityInput.safeParse({workspaceId:'00000000-0000-4000-8000-000000000001',audience:'both',enabled:true,confirmed:true}).success).toBe(false);});
 it('does not infer payment due without an invoice',()=>{expect(patientStage('received')).toBe('Pending');expect(patientStage('received',true)).toBe('Waiting on Payment');});
 it('never treats provider selection as confirmation',()=>expect(patientStage('provider_selected')).toBe('Pending'));
 it('uses actual events, never fabricates timed completion',()=>{expect(patientTimeline([{action:'received',at:'2020-01-01T12:00:00Z'}])).toEqual([{action:'received',at:'2020-01-01T12:00:00Z',label:'Pending'}]);expect(patientTimeline([{action:'completed',at:'not-a-date'}])).toEqual([]);});
 it('separates completed and canceled history',()=>{expect(patientTripGroup(patientStage('completed'))).toBe('completed');expect(patientTripGroup(patientStage('declined'))).toBe('canceled');});
});