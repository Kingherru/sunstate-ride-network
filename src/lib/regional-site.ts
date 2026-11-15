import {US_STATES, stateRegions} from './us-geography';
import {CONTACT_INFO} from './contact-info';
export type RegionalStatus='inactive'|'foundation_only'|'pilot_eligible'|'publicly_active';
export const REGIONAL_FOUNDATIONS=US_STATES.map(s=>({...s,country:'US',status:(s.code==='FL'?'publicly_active':'inactive') as RegionalStatus,regions:stateRegions(s.code)}));
export const FLORIDA_SITE={state:'FL',stateName:'Florida',displayName:'MY FLORIDA NEMT',domain:'myfloridanemt.com',canonical:'https://myfloridanemt.com',contact:CONTACT_INFO,coverage:'florida-map',navigation:['/','/florida-coverage','/book','/policies'],enabledRoutes:['/','/book','/florida-coverage','/policies'],policies:'/policies',regionalCopySource:'existing-florida-content',seoSource:'existing-route-heads',status:'publicly_active' as const};
export const NATIONAL_SITE_RESERVATION={domain:'mynnemt.com',displayName:null,status:'inactive' as const};
export const publicRegions=()=>REGIONAL_FOUNDATIONS.filter(r=>r.status==='publicly_active');
export function publicRegionContext(state:string){return state==='FL'?{available:true,site:FLORIDA_SITE,index:true}:{available:false,site:null,index:false};}
export const REGIONAL_READINESS_KEYS=['branding','geography','timezone','provider_eligibility','credentials','cross_state','directory','matching','coverage','seo','policy','payments_tax'] as const;
export function regionalConfigurationAllowed(master:boolean,status:string){return master&&['inactive','foundation_only'].includes(status);}
export const REGIONAL_WORKFLOW_EVIDENCE=[
 {key:'Booking forms',status:'Connected; new-record readback verification pending'},
 {key:'Multi-stop trips',status:'Explicit local events connected; legacy times unchanged'},
 {key:'Invoice views',status:'Safe shared state, ZIP and local-event projections connected'},
 {key:'Schedule views',status:'Verified event comparisons; legacy conflicts require timezone review'},
 {key:'Directory',status:'Generalized approved service areas only'},
 {key:'People / profile editors',status:'Private profiles and existing People controls connected'},
 {key:'Vehicle / driver boundaries',status:'Optional multi-area boundaries; radius requires verified distance'},
 {key:'Exports',status:'Selected audited reads; real generation not exercised'},
 {key:'Manual cross-state assignment',status:'Atomic evidence gates connected; non-Florida eligibility not configured'},
 {key:'Automatic matching',status:'Intentionally OFF'},
 {key:'Public state activation',status:'Intentionally OFF outside Florida'},
] as const;