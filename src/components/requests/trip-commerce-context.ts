import { createContext, type ReactNode } from 'react';
import type { RideRequestInput, DeliveryRequestInput } from '@/lib/request-schemas';
/** Arrival edit provenance is draft-only; request submission uses the canonical request form. */
export type CommerceFormData = (RideRequestInput | DeliveryRequestInput) & {dropoffTimeEdited?: boolean};
export const TripCommerceContext = createContext<{
  onChange: (form: CommerceFormData) => void;
  quote: { draftId: string; id: string } | null;
  business: boolean;
  provider?: boolean;
  submissionBlocked: boolean;
  draftId?: string | null;
  onDraftSaved?: (id: string) => void;
  invoiceSlot?: ReactNode;
  invoiceBottomSlot?: ReactNode;
  workspaceId?: string;
  draftExtras?: { showInvoiceToLinkedAccount: boolean };
  /** Route-derived total miles; null = routing unavailable (Review Required). */
  onRouteMiles?: (route: { status: 'idle' | 'loading' | 'ok' | 'unavailable'; miles: number | null }) => void;
} | null>(null);