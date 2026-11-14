import { z } from 'zod';
export const serviceRoles = ['nemt_business','independent_contractor','medical_delivery_driver'] as const;
export const historyColumnsSchema = z.object({ hidden: z.array(z.enum(['date','patient','route','driver','payment','payout'])).max(6), widths: z.record(z.string(), z.number().int().min(100).max(480)) }).strict();
export function maskVin(vin: string | null | undefined) { return vin ? `•••••••••••••${vin.slice(-4)}` : 'Not recorded'; }
export function chooseDriver(preferred: string | null, lastCompleted: string | null, eligibleIds: string[]) { return preferred && eligibleIds.includes(preferred) ? preferred : lastCompleted && eligibleIds.includes(lastCompleted) ? lastCompleted : null; }
export function connectionEventKey(connectionId: string, recipientId: string) { return `accepted-connection:${connectionId}:${recipientId}`; }