import type { WebEntity } from '@sia/core';

/** Everything that makes this app "Scoot" rather than Singapore Airlines. */
export const brand = {
  entity: 'TR' satisfies WebEntity,
  name: 'Scoot',
  logo: { src: '/logo-scoot.png', alt: 'Scoot' },
  hero: {
    headline: 'Get outta here!',
    subline: 'Search real Scoot flights from Changi.',
  },
  braze: {
    sdkKey: import.meta.env.VITE_BRAZE_SDK_KEY ?? 'e771b7af-769d-4148-8e8a-9a0a1cc7e67c',
    sdkUrl: import.meta.env.VITE_BRAZE_SDK_URL ?? 'sdk.iad-03.braze.com',
  },
} as const;
