import { z } from 'zod';

const IATA = z.string().regex(/^[A-Z]{3}$/, 'IATA airport code');
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

/** Query for one direction of travel. A return trip is two one-way searches. */
export const FlightSearchQuery = z.object({
  from: IATA,
  to: IATA,
  date: ISO_DATE,
});
export type FlightSearchQuery = z.infer<typeof FlightSearchQuery>;

export const AirportTime = z.object({
  code: z.string(),
  name: z.string(),
  /** Local time, "YYYY-MM-DD HH:mm" as returned by Google Flights. */
  time: z.string(),
});

export const FlightLeg = z.object({
  flightNumber: z.string(),
  airline: z.string(),
  aircraft: z.string().nullable(),
  from: AirportTime,
  to: AirportTime,
  durationMin: z.number(),
  legroom: z.string().nullable(),
  overnight: z.boolean(),
});
export type FlightLeg = z.infer<typeof FlightLeg>;

export const Itinerary = z.object({
  /** Stable id built from flight numbers + departure time. */
  id: z.string(),
  legs: z.array(FlightLeg).min(1),
  layovers: z.array(z.object({ code: z.string(), name: z.string(), durationMin: z.number() })),
  totalDurationMin: z.number(),
  stops: z.number(),
  /** Lowest economy price Google Flights shows, SGD. Fare families are priced from this. */
  basePriceSgd: z.number().nullable(),
  co2Kg: z.number().nullable(),
});
export type Itinerary = z.infer<typeof Itinerary>;

export const FlightSearchResponse = z.object({
  query: FlightSearchQuery,
  airline: z.string(),
  /** live = SerpAPI now; cache = SerpAPI earlier this instance; fixture = offline Phase 0 data. */
  source: z.enum(['live', 'cache', 'fixture']),
  fetchedAt: z.string(),
  itineraries: z.array(Itinerary),
  note: z.string().optional(),
});
export type FlightSearchResponse = z.infer<typeof FlightSearchResponse>;
