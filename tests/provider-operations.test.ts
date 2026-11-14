import {describe,it,expect} from 'vitest';
import {eligibleDriver,vehicleMissingFields,providerSubtypeChangeAllowed} from '../src/lib/provider-operations-rules';
import {validatedSignInPage} from '../src/lib/sign-in-preference-rules';
const driver={id:'driver',workspace_id:'own',status:'active',service_capabilities:['ambulatory'],license_expiry:'2027-01-01'};
describe('provider operations boundaries',()=>{
 it('subtype change requires owner confirmation and an established subtype',()=>{expect(providerSubtypeChangeAllowed(true,true,'independent_contractor')).toBe(true);expect(providerSubtypeChangeAllowed(false,true,'independent_contractor')).toBe(false);expect(providerSubtypeChangeAllowed(true,false,'independent_contractor')).toBe(false);expect(providerSubtypeChangeAllowed(true,true,'admin')).toBe(false);});
 it('driver selection cannot cross provider workspaces',()=>{expect(eligibleDriver(driver,'own','ambulatory','2026-11-14')).toBe(true);expect(eligibleDriver(driver,'other','ambulatory','2026-11-14')).toBe(false);});
 it('inactive, expired, vacation and unsupported drivers are unavailable',()=>{expect(eligibleDriver({...driver,status:'inactive'},'own','ambulatory','2026-11-14')).toBe(false);expect(eligibleDriver(driver,'own','wheelchair','2026-11-14')).toBe(false);expect(eligibleDriver(driver,'own','ambulatory','2027-02-01')).toBe(false);expect(eligibleDriver({...driver,vacation_start:'2026-11-13',vacation_end:'2026-11-15'},'own','ambulatory','2026-11-14')).toBe(false);});
 it('missing vehicle year and plate remain missing, never fabricated',()=>{expect(vehicleMissingFields({make:'Ford',model:'Transit',capacity:4,vehicle_category:'ambulatory',service_capabilities:['ambulatory']})).toEqual(['Model year','License plate']);});
 it('a removed login destination is not authorized by its saved preference',()=>{expect(validatedSignInPage('/portal/fleet',[{to:'/portal'}])).toBeNull();});
});