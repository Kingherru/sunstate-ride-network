export function regionalSchedulingReason(i:{authorized:boolean;pickupState?:string|null;destinationState?:string|null;timeResolved:boolean;crossStateConsent:boolean;vehicleCompatible:boolean;driverCompatible:boolean;eligibility:'configured'|'not_configured'|'unavailable'}){
 if(!i.authorized)return 'Authorized scheduling access required';
 if(!i.pickupState||!i.destinationState)return 'Regional geography review required';
 if(!i.timeResolved)return 'Timezone review required';
 if(i.pickupState!==i.destinationState&&!i.crossStateConsent)return 'Cross-state service consent required';
 if(!i.vehicleCompatible||!i.driverCompatible)return 'Driver or vehicle service not supported';
 if(i.eligibility!=='configured')return 'State eligibility not configured';
 return null;
}