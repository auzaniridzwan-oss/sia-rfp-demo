import type { WebEntity } from '@sia/core';

/** Everything that makes this app "Singapore Airlines" rather than Scoot. */
export const brand = {
  entity: 'SQ' satisfies WebEntity,
  name: 'Singapore Airlines',
  logo: { src: '/logo-sia.png', alt: 'Singapore Airlines' },
  hero: {
    headline: 'A great way to fly',
    subline: 'Search real Singapore Airlines flights from Changi.',
  },
  braze: {
    sdkKey: import.meta.env.VITE_BRAZE_SDK_KEY ?? '5289a0ce-f873-450c-a1df-1a412ea78a44',
    sdkUrl: import.meta.env.VITE_BRAZE_SDK_URL ?? 'sdk.iad-03.braze.com',
  },
} as const;
