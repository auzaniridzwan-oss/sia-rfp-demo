import { BrazeClient, Logger, createBookingStore, createStorage, type WebEntity } from '@sia/core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SiaContext } from './context';

export interface BrazeProviderConfig {
  entity: WebEntity;
  apiKey: string;
  baseUrl: string;
  sdkLogging?: boolean;
}

/**
 * App-wide services for one site: Braze client, logger, namespaced storage and the
 * booking store. Initialises the Braze SDK once on mount.
 */
export function BrazeProvider({ config, children }: { config: BrazeProviderConfig; children: ReactNode }) {
  const services = useMemo(() => {
    const logger = new Logger();
    const storage = createStorage(config.entity);
    const braze = new BrazeClient({ ...config, logger, storage });
    const booking = createBookingStore(config.entity);
    return { logger, storage, braze, booking };
    // Config is static per site; never re-create the SDK client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void services.braze.init().then(() => alive && setReady(true));
    const onError = (e: ErrorEvent) => {
      services.logger.error('window', e.message);
      services.braze.track('sia_app_error', { message: String(e.message).slice(0, 200) });
    };
    window.addEventListener('error', onError);
    return () => {
      alive = false;
      window.removeEventListener('error', onError);
    };
  }, [services]);

  const value = useMemo(() => ({ entity: config.entity, ready, ...services }), [config.entity, ready, services]);
  return <SiaContext.Provider value={value}>{children}</SiaContext.Provider>;
}
