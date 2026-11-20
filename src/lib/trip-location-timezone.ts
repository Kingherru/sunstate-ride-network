import lookup from 'tz-lookup';
import {supportedTimezone} from './us-timezone';
/** Never infer an endpoint's timezone from the browser or the other endpoint. */
export function coordinateTimezone(lat:number|null,lng:number|null):string {
  if(lat===null||lng===null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return '';
  try{const zone=lookup(lat,lng);return supportedTimezone(zone)?zone:'';}catch{return '';}
}