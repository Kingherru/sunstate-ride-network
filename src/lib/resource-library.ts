import { RESOURCES, type Resource } from './resources-content';
export const RESOURCE_CATEGORIES=['NEMT Business','Medicaid & Policy','Vehicles & Equipment','Accessibility','Florida Updates','National Updates','Patient/Facility Guidance'] as const;
export type ResourceCategory=typeof RESOURCE_CATEGORIES[number];
const classifications:Record<string,ResourceCategory>={
 'caregiver-appointment-checklist':'Patient/Facility Guidance',
 'wheelchair-transportation-what-to-expect':'Accessibility',
 'recurring-dialysis-transportation':'Patient/Facility Guidance',
 'organizing-nemt-team-members-and-contractors':'NEMT Business',
};
export const RESOURCE_LIBRARY=RESOURCES.map(r=>({...r,category:classifications[r.slug]??'Patient/Facility Guidance',scope:r.audience==='Providers'?'Florida' as const:'United States' as const,readingMinutes:readingMinutes(r)}));
function readingMinutes(r:Resource){return Math.max(1,Math.ceil(r.body.map(b=>'c'in b?b.c:b.items.join(' ')).join(' ').split(/\s+/).length/200));}
export function filterResources(query:string,category:string,scope:string){const q=query.trim().toLowerCase();return RESOURCE_LIBRARY.filter(r=>(category==='All'||r.category===category)&&(scope==='All'||r.scope===scope)&&(!q||`${r.title} ${r.description} ${r.category}`.toLowerCase().includes(q)));}