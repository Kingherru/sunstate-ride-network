import { RRule } from 'rrule';
import { z } from 'zod';
import { rideRequestSchema, type RideRequestInput } from './request-schemas';
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s+'T00:00:00Z'); return !isNaN(+d) && d.toISOString().slice(0,10)===s; }, 'Invalid calendar date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const occurrenceSchema = z.object({ date: day, pickupTime: time, appointmentTime: time.or(z.literal('')), dropoffDate:day.or(z.literal('')).optional(), dropoffTime:time.or(z.literal('')).optional(), tripType:z.enum(['one_way','round_trip']).optional(), returnTime: time.or(z.literal('')), returnDropoffTime: time.or(z.literal('')).default(''), returnDate: day.or(z.literal('')) }).strict();
export type Occurrence = z.infer<typeof occurrenceSchema>;
export const seriesRuleSchema = z.object({ mode: z.enum(['dates','daily','weekdays','weekly','biweekly','monthly']), start: day, end: day.or(z.literal('')), limit: z.number().int().min(1).max(100), weekdays: z.array(z.number().int().min(0).max(6)).max(7), dates: z.array(day).max(100), excluded: z.array(day).max(100) }).strict();
export type SeriesRule = z.infer<typeof seriesRuleSchema>;
export function generateOccurrences(input: SeriesRule, today: string): string[] {
  const rule=seriesRuleSchema.parse(input);
  if(rule.start<today || rule.end && rule.end<rule.start) throw new Error('Choose future dates and a valid end date.');
  if(rule.dates.length!==new Set(rule.dates).size) throw new Error('Duplicate selected dates.');
  const start=new Date(rule.start+'T00:00:00Z');
  const max=new Date(start); max.setUTCFullYear(max.getUTCFullYear()+2);
  const until=rule.end ? new Date(rule.end+'T00:00:00Z') : max;
  if(until>max) throw new Error('Schedules must end within two years.');
  let dates: string[];
  if(rule.mode==='dates') dates=[...rule.dates].sort();
  else {
    const freq=rule.mode==='monthly'?RRule.MONTHLY:rule.mode==='daily'?RRule.DAILY:RRule.WEEKLY;
    const selected=rule.mode==='weekdays'?[1,2,3,4,5]:rule.weekdays;
    if(['weekly','biweekly'].includes(rule.mode)&&!selected.length) throw new Error('Select at least one weekday.');
    const weekdays=[RRule.SU,RRule.MO,RRule.TU,RRule.WE,RRule.TH,RRule.FR,RRule.SA];
    dates=new RRule({freq,dtstart:start,until,count:1001,interval:rule.mode==='biweekly'?2:1,...(freq===RRule.WEEKLY?{byweekday:selected.map(i=>weekdays[i]).filter(v=>v!==undefined)}:{})}).all().map(d=>d.toISOString().slice(0,10));
  }
  return dates.filter(d=>d>=rule.start&&d>=today&&d<=until.toISOString().slice(0,10)&&!rule.excluded.includes(d)).slice(0,rule.limit);
}
export function occurrenceRequest(source: RideRequestInput, row: Occurrence): RideRequestInput {
  const shift=(date:string|undefined)=>{if(!date)return date;const offset=Date.parse(date+'T12:00:00Z')-Date.parse(source.pickupDate+'T12:00:00Z');return new Date(Date.parse(row.date+'T12:00:00Z')+offset).toISOString().slice(0,10);};
  const tripType=row.tripType??source.tripType;
  return rideRequestSchema.parse({...source,tripType,roundTrip:tripType==='round_trip',dropoffDate:row.dropoffDate??shift(source.dropoffDate),dropoffTime:row.dropoffTime??source.dropoffTime,additionalStops:source.additionalStops.map(stop=>({...stop,date:shift(stop.date)})),pickupDate:row.date,pickupTime:row.pickupTime,appointmentTime:row.appointmentTime,returnPickupTime:tripType==='round_trip'?row.returnTime:'',returnDropoffTime:tripType==='round_trip'?row.returnDropoffTime:'',returnDate:tripType==='round_trip'?row.returnDate||row.date:'',recurrence:'none',recurrenceEndDate:'',confirmedProviderDriverId:null,confirmedDriverEndTime:"",customerQuoteId:null,customerQuoteDraftId:null});
}
export function validateOccurrences(rows: Occurrence[], today: string): void {
  if(!rows.length||rows.length>100) throw new Error('Review between 1 and 100 trips.');
  const seen=new Set<string>();
  for(const raw of rows){const row=occurrenceSchema.parse(raw);if(row.date<today)throw new Error('Past occurrences cannot be created.');const key=row.date+'|'+row.pickupTime;if(seen.has(key))throw new Error('Duplicate date and pickup time.');seen.add(key);if(row.returnDate&&row.returnDate<row.date)throw new Error('Return date precedes pickup.');}
}
