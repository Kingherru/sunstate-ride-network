import { z } from 'zod';
export const CONTRACTOR_MEMBERSHIP = { id:'contractor_membership',title:'Independent Contractor Membership',priceCents:2000,interval:'month',stripePriceId:null,trialDays:0 } as const;
export const contractorSteps = ['Identity & contact','Primary vehicle & capabilities','Insurance & driver license','W-9 & additional requirements','Service area & radius','Availability & hours','Membership & visibility review'] as const;
export const requirementSchema = z.object({id:z.string().uuid().optional(),label:z.string().trim().min(2).max(120),kind:z.enum(['document','acknowledgment','expiration_date']),notes:z.string().trim().max(500),active:z.boolean()}).strict();
export type ContractorEvidence = {complete:boolean;documents:boolean;expired:boolean;vehicle:boolean;area:boolean;availability:boolean;subscription:boolean;email:boolean;hold:boolean;visible:boolean;additional:boolean};
export function contractorEligibility(e:ContractorEvidence){
 const reasons:string[]=[];
 if(e.hold)reasons.push('Restricted / safety hold');
 if(!e.complete||!e.email||!e.vehicle||!e.area||!e.availability)reasons.push('Incomplete');
 if(e.expired)reasons.push('Expired');
 if(!e.documents||!e.additional)reasons.push('Evidence missing');
 if(e.documents)reasons.push('Evidence present / unable to establish legal sufficiency');
 if(!e.subscription)reasons.push('Subscription inactive');
 if(!e.visible)reasons.push('Network visibility off');
 const eligible=!e.hold&&e.complete&&e.email&&e.vehicle&&e.area&&e.availability&&e.documents&&e.additional&&!e.expired&&e.subscription;
 if(eligible)reasons.push('Eligible for ambulatory opportunities');
 return {eligible,discoverable:eligible&&e.visible,reasons};
}
export function contractorAssignmentAllowed(service:string,eligible:boolean,relationship:{business:string;contractor:string;active:boolean}|null,business:string,contractor:string){return service==='ambulatory'&&eligible&&!!relationship?.active&&relationship.business===business&&relationship.contractor===contractor;}
export function publicContractorFields(row:Record<string,unknown>){
 const keys=['workspace_id','business_name','mfn_id','provider_subtype','counties','cities','zips','hours','service_types','service_radius_miles','vehicle_category','looking_for_work','seeking_contractors','evidence_language','public_center_lat','public_center_lng'] as const;
 return Object.fromEntries(keys.map(k=>[k,row[k]]));
}