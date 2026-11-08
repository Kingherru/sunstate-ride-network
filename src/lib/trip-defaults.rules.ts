export type BasicTripDefaults={patientFirstName?:string;patientLastName?:string;patientPhone?:string;patientEmail?:string;transportType?:'ambulatory'|'wheelchair'|'gurney';patientWorkspaceId?:string|null};
export function fillEmptyTripDefaults<T extends BasicTripDefaults>(current:T,defaults:BasicTripDefaults):T {
 const out={...current};
 for(const key of ['patientFirstName','patientLastName','patientPhone','patientEmail'] as const)if(!out[key] && defaults[key])out[key]=defaults[key];
 return out;
}
export function approvedPatientDefaults(p:{first_name:string;last_name:string;phone?:string|null;email?:string|null;mobility?:string|null}):BasicTripDefaults {
 return {patientFirstName:p.first_name,patientLastName:p.last_name,patientPhone:p.phone??'',patientEmail:p.email??'',transportType:p.mobility==='stretcher'?'gurney':p.mobility==='wheelchair'?'wheelchair':'ambulatory'};
}