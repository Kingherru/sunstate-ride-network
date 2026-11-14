export const CONTRACTOR_DEMO_ID='00000000-0000-4000-8000-000000000041';
const BUSINESS='00000000-0000-4000-8000-000000000042';
const OTHER='00000000-0000-4000-8000-000000000043';
export const contractorFixtures:Record<string,unknown>={
 'contractor-context':{workspaceId:BUSINESS,subtype:'nemt_business'},
 'contractor-progress':{step:0,completed:[]},
 'contractor-eligibility':{eligible:true,discoverable:true,reasons:['Evidence present / unable to establish legal sufficiency','Eligible for ambulatory opportunities'],vehicle:true,documents:true,additional:true,subscription:true,email:true,area:true,availability:true},
 'contractor-requirements':{requirements:[],responses:[]},
 'contractor-directory':[
  {workspace_id:CONTRACTOR_DEMO_ID,business_name:'Demo Local Driver',mfn_id:'MFN-A-DEMO-C1',provider_subtype:'independent_contractor',counties:['Putnam'],cities:['Palatka'],zips:['32177'],hours:'Monday–Friday 8 AM–5 PM',service_types:['ambulatory'],service_radius_miles:50,vehicle_category:'Standard ambulatory vehicle',looking_for_work:true,seeking_contractors:false,evidence_language:'Current platform evidence; legal sufficiency not established',public_center_lat:29.6486,public_center_lng:-81.6376},
  {workspace_id:BUSINESS,business_name:'Demo Community NEMT',mfn_id:'MFN-A-DEMO-B1',provider_subtype:'nemt_business',counties:['Putnam'],cities:['Palatka'],zips:['32177'],hours:'Weekdays 6 AM–6 PM',service_types:['ambulatory'],service_radius_miles:100,vehicle_category:'NEMT business fleet',looking_for_work:false,seeking_contractors:true,evidence_language:'Eligible NEMT business',public_center_lat:29.6486,public_center_lng:-81.6376},
  {workspace_id:OTHER,business_name:'Demo Rural Driver',mfn_id:'MFN-A-DEMO-C2',provider_subtype:'independent_contractor',counties:['Alachua'],cities:['Gainesville'],zips:['32601'],hours:'Weekdays 9 AM–4 PM',service_types:['ambulatory'],service_radius_miles:30,vehicle_category:'Standard ambulatory vehicle',looking_for_work:true,seeking_contractors:false,evidence_language:'Current platform evidence; legal sufficiency not established',public_center_lat:29.6516,public_center_lng:-82.3248},
 ],
 'contractor-relationships':{pending:[{id:'00000000-0000-4000-8000-000000000044',inviter_workspace_id:OTHER,recipient_workspace_id:BUSINESS,status:'pending',expires_at:'2027-01-01T00:00:00Z',relationship_kind:'contractor_application'},{id:'00000000-0000-4000-8000-000000000045',inviter_workspace_id:BUSINESS,recipient_workspace_id:CONTRACTOR_DEMO_ID,status:'pending',expires_at:'2027-01-01T00:00:00Z',relationship_kind:'contractor_invitation'}],connections:[{id:'00000000-0000-4000-8000-000000000046',workspace_a:BUSINESS,workspace_b:CONTRACTOR_DEMO_ID,active:true},{id:'00000000-0000-4000-8000-000000000047',workspace_a:BUSINESS,workspace_b:OTHER,active:false}]},
 'contractor-assignment-options':[{workspace_id:CONTRACTOR_DEMO_ID,business_name:'Demo Local Driver'}],
};