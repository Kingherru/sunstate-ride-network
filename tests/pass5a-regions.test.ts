import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {US_STATES,US_TIMEZONES,COUNTY_EQUIVALENT_TYPES,EVIDENCE_TYPES,stateRegions,geographySchema,serviceAreaSchema,regionalMatch} from '../src/lib/us-geography';
import {REGIONS} from '../src/lib/coverage';
import {publicRegions,publicRegionContext,NATIONAL_SITE_RESERVATION,regionalConfigurationAllowed} from '../src/lib/regional-site';
import {authoritativeInstant,operatingWindow,withinOperatingHours} from '../src/lib/us-timezone';
import {resolveLocalPickup} from '../src/lib/communication-rules';
import {mapRow} from '../src/lib/csv-import';
import {rideRequestSchema} from '../src/lib/request-schemas';
import {parseNoteShortcodes} from '../src/lib/note-shortcodes';
const area=(state='FL',extra:Record<string,unknown>={})=>geographySchema.parse({state,evidence:'authoritative',...extra});
const base=()=>({pickup:area('FL',{postalCode:'32801',countyEquivalent:'Orange',region:'central'}),destination:area(),areas:[area('FL',{postalCode:'32801',countyEquivalent:'Orange',region:'central',evidence:'provider_entered'})],crossState:false,eligibility:true,hours:true,gates:true});
describe('U.S. regional preservation and evidence',()=>{
 it('includes 50 states plus DC, no territory launch',()=>{expect(US_STATES).toHaveLength(51);expect(US_STATES.some(s=>s.code==='DC')).toBe(true);expect(publicRegions().map(s=>s.code)).toEqual(['FL']);});
 it('retains Florida seven regions and 67 unique counties',()=>{expect(REGIONS).toBe(stateRegions('FL'));expect(REGIONS).toHaveLength(7);expect(new Set(REGIONS.flatMap(r=>r.counties)).size).toBe(67);expect(stateRegions('LA')).toEqual([]);});
 it.each(['county','parish','borough','census_area','independent_city','other'])('supports county equivalent %s',type=>{expect(COUNTY_EQUIVALENT_TYPES.includes(type as typeof COUNTY_EQUIVALENT_TYPES[number])).toBe(true);expect(geographySchema.safeParse({state:'LA',countyType:type}).success).toBe(true);});
 it.each(EVIDENCE_TYPES)('retains evidence classification %s',evidence=>expect(area('FL',{evidence}).evidence).toBe(evidence));
 it('provider input cannot attest authoritative geography',()=>expect(serviceAreaSchema.safeParse({areas:[area()],radius:null,crossState:false}).success).toBe(false));
 it('regions belong to their state',()=>expect(serviceAreaSchema.safeParse({areas:[area('LA',{region:'central',evidence:'provider_entered'})],radius:null,crossState:false}).success).toBe(false));
 it('allows parish areas without fabricated regions',()=>expect(serviceAreaSchema.safeParse({areas:[area('LA',{countyType:'parish',countyEquivalent:'Orleans',evidence:'provider_entered'})],radius:null,crossState:true}).success).toBe(true));
 it('additive migrations never backfill or alter existing saved times',()=>{for(const file of ['0137_us_regional_foundation.sql','0138_regional_matching_and_safe_projections.sql']){const sql=readFileSync(`drizzle/migrations/${file}`,'utf8');expect(sql).not.toMatch(/\b(DROP TABLE|DROP COLUMN|TRUNCATE|ALTER COLUMN)\b/i);expect(sql).not.toMatch(/^UPDATE\s+public\.(trips|ride_requests|workspaces|user_profiles)/im);}});
});
describe('conservative geography hierarchy and cross-state consent',()=>{
 it('ranks approved exact evidence ahead of ZIP',()=>expect(regionalMatch({...base(),preciseDistance:4,distanceAuthoritative:true})?.rank).toBe(120));
 it('ZIP outranks county',()=>expect(regionalMatch(base())?.rank).toBe(100));
 it('county equivalent outranks configured region',()=>{const i=base();i.pickup.postalCode='';expect(regionalMatch(i)?.rank).toBe(40);});
 it('region matches only configured state regions',()=>{const i=base();i.pickup.postalCode='';i.pickup.countyEquivalent='';expect(regionalMatch(i)?.rank).toBe(20);});
 it('state-only never means nearby',()=>{const i=base();i.pickup.postalCode='';i.pickup.countyEquivalent='';i.pickup.region='';expect(regionalMatch(i)).toBeNull();expect(regionalMatch({...i,allowStateOnly:true})).toEqual({rank:5,label:'State service-area match — not nearby',nearby:false});});
 it('cross-state requires consent and destination coverage',()=>{const i={...base(),destination:area('GA')};expect(regionalMatch(i)).toBeNull();expect(regionalMatch({...i,crossState:true})).toBeNull();expect(regionalMatch({...i,crossState:true,areas:[...i.areas,area('GA')]} )?.rank).toBe(100);});
 it.each(['eligibility','hours','gates'] as const)('missing %s fails closed',gate=>expect(regionalMatch({...base(),[gate]:false})).toBeNull());
 it.each(['approximate','generalized','user_selected','provider_entered','unverified'])('does not match %s pickup evidence',evidence=>expect(regionalMatch({...base(),pickup:area('FL',{evidence})})).toBeNull());
});
describe('U.S. timezone engine',()=>{
 it.each(['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'])('supports %s',zone=>{expect(US_TIMEZONES.includes(zone as typeof US_TIMEZONES[number])).toBe(true);expect(authoritativeInstant('2026-11-20','09:00',zone,'authoritative')).not.toBeNull();});
 it.each(['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage'])('rejects DST gap and fold %s',zone=>{expect(authoritativeInstant('2026-03-08','02:30',zone,'authoritative')).toBeNull();expect(authoritativeInstant('2026-11-01','01:30',zone,'authoritative')).toBeNull();});
 it('Honolulu has no DST fold',()=>expect(authoritativeInstant('2026-11-01','01:30','Pacific/Honolulu','authoritative')).not.toBeNull());
 it('requires authoritative timezone',()=>expect(authoritativeInstant('2026-11-20','09:00','America/Chicago','user_selected')).toBeNull());
 it('compares cross-zone instants',()=>expect(resolveLocalPickup('2026-11-20','09:00','America/New_York')).toBe(resolveLocalPickup('2026-11-20','06:00','America/Los_Angeles')));
 it('overnight hours span calendar dates',()=>{const w=operatingWindow('2026-11-20','22:00','06:00','America/Chicago');expect(w&&w.to-w.from).toBe(8*3600000);expect(withinOperatingHours(Date.parse('2026-11-21T07:00:00Z'),'2026-11-20','22:00','06:00','America/Chicago','authoritative')).toBe(true);});
 it('ambiguous overnight boundary blocks hours',()=>expect(operatingWindow('2026-11-01','01:30','06:00','America/Chicago')).toBeNull());
});
describe('public gating, admin boundaries and draft regional mapping',()=>{
 it('unsupported states never index or advertise availability',()=>expect(publicRegionContext('TX')).toEqual({available:false,site:null,index:false}));
 it('national name undecided and domain inactive',()=>expect(NATIONAL_SITE_RESERVATION).toEqual({domain:'mynnemt.com',displayName:null,status:'inactive'}));
 it('only Master can prepare inactive configurations',()=>{expect(regionalConfigurationAllowed(false,'foundation_only')).toBe(false);expect(regionalConfigurationAllowed(true,'foundation_only')).toBe(true);expect(regionalConfigurationAllowed(true,'publicly_active')).toBe(false);});
 it('import mapping carries explicit states and zones without default guesses',()=>{const row=mapRow('passenger',{pickup_state:'LA',dropoff_state:'MS',pickup_timezone:'America/Chicago',pickup_county:'Orleans'});expect(row.pickupState).toBe('LA');expect(row.dropoffState).toBe('MS');expect(row.pickupTimezone).toBe('America/Chicago');expect(mapRow('passenger',{}).pickupState).toBeUndefined();});
 it('notes only parse explicit regional codes',()=>{const n=parseNoteShortcodes('PUSTATE: LA\nDOSTATE: MS\nPUTZ: America/Chicago\nPUCOUNTY: Orleans');expect(n.payload.pickupState).toBe('LA');expect(n.payload.dropoffState).toBe('MS');expect(n.payload.pickupTimezone).toBe('America/Chicago');expect(n.payload.pickupCounty).toBe('Orleans');});
 it('draft validation tolerates missing timezone',()=>{const p=rideRequestSchema.safeParse({patientFirstName:'Test',patientLastName:'Draft',patientPhone:'5555555555',pickupAddress:'123 Main St',pickupCity:'Orlando',pickupDate:new Date(Date.now()+86400000*10).toISOString().slice(0,10),pickupTime:'09:00',dropoffAddress:'321 Clinic Rd',dropoffCity:'Atlanta',transportType:'ambulatory',pickupState:'FL',dropoffState:'GA'});expect(p.success).toBe(true);});
});