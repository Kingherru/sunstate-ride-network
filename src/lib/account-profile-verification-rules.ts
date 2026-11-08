export type ProfileEvidence={type:'private_pay'|'facility'|'hospital'|'provider';active:boolean;emailConfirmed:boolean;firstName:string;lastName:string;phone:string;policyCurrent:boolean;accountFor?:'self'|'other';patientFirst?:string;patientLast?:string;relationship?:string;mobility?:string;businessName?:string;facilityType?:string;address?:string};
export function qualifyingAccountProfile(e:ProfileEvidence):boolean {
 if(e.type==='provider')return false;
 const digits=e.phone.replace(/\D/g,'');
 if(!e.active || !e.emailConfirmed || !e.firstName.trim() || !e.lastName.trim() || digits.length<7 || digits.length>15 || !e.policyCurrent)return false;
 if(e.type==='private_pay')return Boolean(['self','other'].includes(e.accountFor??'') && e.patientFirst?.trim() && e.patientLast?.trim() && ['ambulatory','wheelchair','stretcher'].includes(e.mobility??'') && (e.accountFor==='self'||e.relationship?.trim()));
 return Boolean(e.businessName?.trim() && ['general_facility','medical_facility','hospital','broker','insurance_company','group_home','nursing_home','medical_courier','other_organization'].includes(e.facilityType??'') && (e.address?.trim().length??0)>=3);
}