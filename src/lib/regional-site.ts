import {US_STATES, stateRegions} from './us-geography';
import {CONTACT_INFO} from './contact-info';
export type RegionalStatus='inactive'|'foundation_only'|'pilot_eligible'|'publicly_active';
export const REGIONAL_FOUNDATIONS=US_STATES.map(s=>({...s,country:'US',status:(s.code==='FL'?'publicly_active':'inactive') as RegionalStatus,regions:stateRegions(s.code)}));
export const FLORIDA_SITE={state:'FL',stateName:'Florida',displayName:'MY FLORIDA NEMT',domain:'myfloridanemt.com',canonical:'https://myfloridanemt.com',contact:CONTACT_INFO,coverage:'florida-map',navigation:['/','/florida-coverage','/book','/policies'],enabledRoutes:['/','/book','/florida-coverage','/policies'],policies:'/policies',regionalCopySource:'existing-florida-content',seoSource:'existing-route-heads',status:'publicly_active' as const};
export const NATIONAL_SITE_RESERVATION={domain:'mynnemt.com',displayName:null,status:'inactive' as const};
export const publicRegions=()=>REGIONAL_FOUNDATIONS.filter(r=>r.status==='publicly_active');
export function publicRegionContext(state:string){return state==='FL'?{available:true,site:FLORIDA_SITE,index:true}:{available:false,site:null,index:false};}
export const REGIONAL_READINESS_KEYS=['branding','geography','timezone','provider_eligibility','credentials','matching','coverage','seo','policy','payments_tax'] as const;
export function regionalConfigurationAllowed(master:boolean,status:string){return master&&['inactive','foundation_only'].includes(status);}