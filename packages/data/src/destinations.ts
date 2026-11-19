/**
 * Demo route list (decision D4). Origin is fixed to Changi; every destination must be
 * served by both SQ and TR so SerpAPI returns real flights on both sites.
 * `status` is updated from the Phase 0 SerpAPI spike (scripts/serpapi-spike.ts).
 */
export const DEMO_ORIGIN = { code: 'SIN', city: 'Singapore' } as const;

export interface Destination {
  code: string;
  city: string;
  country: string;
  role: 'primary' | 'fallback';
  /** Primary destination this one replaces if the spike fails it. */
  fallbackFor?: string;
  status: 'proposed' | 'validated' | 'rejected';
}

export const DESTINATIONS: Destination[] = [
  { code: 'PER', city: 'Perth', country: 'Australia', role: 'primary', status: 'proposed' },
  { code: 'NRT', city: 'Tokyo (Narita)', country: 'Japan', role: 'primary', status: 'proposed' },
  { code: 'BKK', city: 'Bangkok', country: 'Thailand', role: 'primary', status: 'proposed' },
  { code: 'KIX', city: 'Osaka', country: 'Japan', role: 'fallback', fallbackFor: 'NRT', status: 'proposed' },
  { code: 'SYD', city: 'Sydney', country: 'Australia', role: 'fallback', fallbackFor: 'BKK', status: 'proposed' },
];

/** Airline IATA codes passed to SerpAPI `include_airlines`. */
export const AIRLINE_IATA = { SQ: 'SQ', TR: 'TR' } as const;
