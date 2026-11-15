import { z } from 'zod';
import {REGIONS} from './coverage';
export const pilotConfigSchema = z.object({
  enabled:z.boolean(), emergencyStop:z.boolean(), senders:z.array(z.string().uuid()).max(100), receivers:z.array(z.string().uuid()).max(100),
  services:z.array(z.enum(['ambulatory','wheelchair','stretcher'])).max(3), cities:z.array(z.string().trim().min(1).max(100)).max(100), zips:z.array(z.string().regex(/^\d{5}$/)).max(100),
  maxCandidates:z.number().int().min(1).max(25), responseMinutes:z.number().int().min(5).max(1440), maxRadius:z.union([z.literal(20),z.literal(50),z.literal(100),z.literal(200)]), inApp:z.boolean(),
  counties:z.array(z.string().refine(c=>REGIONS.some(r=>r.counties.includes(c)))).max(67).default([]),regions:z.array(z.string().refine(s=>REGIONS.some(r=>r.slug===s))).max(7).default([]),
}).strict();
export type PilotConfig=z.infer<typeof pilotConfigSchema>;
export const EMPTY_PILOT:PilotConfig={enabled:false,emergencyStop:false,senders:[],receivers:[],services:[],cities:[],zips:[],counties:[],regions:[],maxCandidates:5,responseMinutes:60,maxRadius:20,inApp:false};
export function pilotAllows(c:PilotConfig,sender:string,receiver:string,service:string){return c.enabled&&!c.emergencyStop&&c.inApp&&c.senders.includes(sender)&&c.receivers.includes(receiver)&&c.services.includes(service as PilotConfig['services'][number])&&sender!==receiver;}
export function selectedExportIds(ids:string[]){return z.array(z.string().uuid()).min(1).max(500).parse([...new Set(ids)]);}