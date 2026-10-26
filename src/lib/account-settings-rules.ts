import { z } from 'zod';

export const personalSettingsInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(32),
  preferences: z.object({ in_app: z.boolean(), email: z.boolean() }).strict(),
}).strict();

/** Approximate straight-line distance, never a driving-distance promise. */
export function approximateMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function serviceCompatibility(distance: number | null, radius: number | null, county: string | undefined, counties: string[]) {
  if (county && counties.some((v) => v.toLowerCase() === county.toLowerCase())) return 'Covered county';
  if (distance === null || radius === null) return 'Not confirmed';
  return distance <= radius ? 'Within service radius' : 'Outside service radius';
}