import type { BookingStore, BrazeClient, Logger, Storage, WebEntity } from '@sia/core';
import { createContext, useContext } from 'react';

export interface SiaContextValue {
  entity: WebEntity;
  braze: BrazeClient;
  logger: Logger;
  storage: Storage;
  booking: BookingStore;
  ready: boolean;
}

export const SiaContext = createContext<SiaContextValue | null>(null);

export function useSia(): SiaContextValue {
  const ctx = useContext(SiaContext);
  if (!ctx) throw new Error('useSia must be used inside <BrazeProvider>');
  return ctx;
}
