import { createContext, useContext } from 'react';
/** Optional context only changes the overlay title; access is always decided server-side. */
export type DetailContextKind = 'referral' | 'draft' | 'reservation' | 'schedule' | 'history' | 'network';
export type DetailTarget = { kind: 'request' | 'trip'; id: string; context?: DetailContextKind };
export const RequestDetailContext = createContext<(target: DetailTarget) => void>(() => {});
export const useRequestDetails = () => useContext(RequestDetailContext);
