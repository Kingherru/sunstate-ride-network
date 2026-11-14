import { z } from 'zod';
export const textSizeSchema = z.enum(['compact','standard','comfortable','extra_large']);
export const providerSubtypeSchema = z.enum(['nemt_business','independent_contractor']);
export const delaySchema = z.number().int().min(1).max(120);
export const vehicleCategories = [{value:'ambulatory',label:'Standard ambulatory vehicle'},{value:'wheelchair',label:'Wheelchair-accessible van'},{value:'stretcher',label:'Stretcher/gurney-capable vehicle'},{value:'other',label:'Other approved transportation vehicle'}];
export function contractorServicesAllowed(subtype: string, services: string[], delivery = false) { return subtype !== 'independent_contractor' || (!delivery && services.every(s => s === 'ambulatory')); }
export function documentState(c?: { kind?: string; doc_path?: string | null; expires_at?: string | null; effective_at?: string | null; accuracy_attested_at?: string | null; lifecycle_state?: string | null }, today = new Date().toISOString().slice(0,10)) {
  if (!c?.doc_path) return 'Missing';
  if (c.expires_at && c.expires_at < today) return 'Expired';
  if (!c.accuracy_attested_at || (c.kind!=='w9' && (!c.effective_at || !c.expires_at)) || (c.effective_at && c.effective_at > today) || !['current','active'].includes(c.lifecycle_state ?? '')) return 'Under Review / Unable to Validate';
  return 'Present';
}