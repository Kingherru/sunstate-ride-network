import { z } from 'zod';
export const CONTACT_TYPES = ['personal','patient','caregiver','facility','business','payer','broker','organization'] as const;
export const contactInput = z.object({
  id:z.string().uuid().optional(), contact_type:z.enum(CONTACT_TYPES),
  first_name:z.string().trim().max(80).default(''),last_name:z.string().trim().max(80).default(''),
  company_name:z.string().trim().max(160).default(''),phone:z.string().trim().max(32).default(''),
  email:z.union([z.string().trim().email().max(255),z.literal('')]).default(''),
  payer:z.string().trim().max(160).default(''),payer_id:z.string().uuid().nullish(),
  relationship:z.string().trim().max(80).default(''),active:z.boolean().default(true),
  billing_allowed:z.boolean().default(false),coordination_allowed:z.boolean().default(false),
  mobility_notes:z.string().trim().max(1000).default(''),notes:z.string().trim().max(1000).default(''),
  default_pickup_location_id:z.string().uuid().nullish(),default_dropoff_location_id:z.string().uuid().nullish(),
}).strict().refine(v=>Boolean(v.company_name || v.first_name && v.last_name),{message:'Enter a business name or first and last name.'});
export function sameRecordWorkspace(a:string|null,b:string|null){return Boolean(a && b && a===b);}