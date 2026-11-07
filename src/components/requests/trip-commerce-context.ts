import { createContext } from 'react';
import type { RideRequestInput, DeliveryRequestInput } from '@/lib/request-schemas';
export type CommerceFormData = RideRequestInput | DeliveryRequestInput;
export const TripCommerceContext = createContext<{
  onChange: (form: CommerceFormData) => void;
  quote: { draftId: string; id: string } | null;
  business: boolean;
} | null>(null);