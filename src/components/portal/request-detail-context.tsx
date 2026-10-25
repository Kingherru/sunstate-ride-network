import { createContext, useContext } from 'react';
export type DetailTarget = { kind: 'request' | 'trip'; id: string };
export const RequestDetailContext = createContext<(target: DetailTarget) => void>(() => {});
export const useRequestDetails = () => useContext(RequestDetailContext);