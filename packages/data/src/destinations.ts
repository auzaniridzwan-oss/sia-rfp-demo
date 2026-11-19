/**
 * Demo route list (decision D4). Origin is fixed to Changi; every destination must be
 * served by both SQ and TR so SerpAPI returns real flights on both sites.
 * `status` comes from the Phase 0 SerpAPI spike (scripts/serpapi-spike.ts, run 2026-11-19 for
 * departures on 2026-12-03, 2026-12-17 and 2027-01-14; results saved in fixtures/serpapi):
 *   PER  SQ 4 nonstop/day, TR 2 nonstop/day  -> validated
 *   NRT  SQ 2 nonstop/day, TR 3/day (1 nonstop, 2 via TPE/BKK) -> validated
 *   BKK  SQ 6-7 nonstop/day, TR 6 nonstop/day -> validated
 *   KIX  TR only 1/day -> rejected as fallback (too few Scoot options)
 *   SYD  not tested (no primary failed)
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
  { code: 'PER', city: 'Perth', country: 'Australia', role: 'primary', status: 'validated' },
  { code: 'NRT', city: 'Tokyo (Narita)', country: 'Japan', role: 'primary', status: 'validated' },
  { code: 'BKK', city: 'Bangkok', country: 'Thailand', role: 'primary', status: 'validated' },
  { code: 'KIX', city: 'Osaka', country: 'Japan', role: 'fallback', fallbackFor: 'NRT', status: 'rejected' },
  { code: 'SYD', city: 'Sydney', country: 'Australia', role: 'fallback', fallbackFor: 'BKK', status: 'proposed' },
];

/** Airline IATA codes passed to SerpAPI `include_airlines`. */
export const AIRLINE_IATA = { SQ: 'SQ', TR: 'TR' } as const;
