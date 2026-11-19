import type { FlightLeg, FlightSearchQuery, FlightSearchResponse, Itinerary } from '@sia/core';
import { SERPAPI_FIXTURES, type FixtureEntry, type SerpApiFixture } from '@sia/data/fixtures';

interface RawLeg {
  departure_airport?: { id?: string; name?: string; time?: string };
  arrival_airport?: { id?: string; name?: string; time?: string };
  duration?: number;
  airplane?: string;
  airline?: string;
  flight_number?: string;
  legroom?: string;
  overnight?: boolean;
}
interface RawItinerary {
  flights?: RawLeg[];
  layovers?: { duration?: number; name?: string; id?: string }[];
  total_duration?: number;
  price?: number;
  carbon_emissions?: { this_flight?: number };
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; response: FlightSearchResponse }>();

/** Normalise SerpAPI itineraries, keeping only those where EVERY leg is the requested airline. */
export function normaliseItineraries(data: SerpApiFixture, airline: string): Itinerary[] {
  const raw = [...(data.best_flights ?? []), ...(data.other_flights ?? [])] as RawItinerary[];
  const seen = new Set<string>();
  const out: Itinerary[] = [];
  for (const it of raw) {
    const flights = it.flights ?? [];
    if (!flights.length) continue;
    if (!flights.every((l) => (l.flight_number ?? '').replace(/\s/g, '').startsWith(airline))) continue;
    const legs: FlightLeg[] = flights.map((l) => ({
      flightNumber: (l.flight_number ?? '').trim(),
      airline: l.airline ?? airline,
      aircraft: l.airplane ?? null,
      from: { code: l.departure_airport?.id ?? '', name: l.departure_airport?.name ?? '', time: l.departure_airport?.time ?? '' },
      to: { code: l.arrival_airport?.id ?? '', name: l.arrival_airport?.name ?? '', time: l.arrival_airport?.time ?? '' },
      durationMin: l.duration ?? 0,
      legroom: l.legroom ?? null,
      overnight: Boolean(l.overnight),
    }));
    const id = `${legs.map((l) => l.flightNumber.replace(/\s/g, '')).join('-')}_${legs[0]!.from.time.replace(/\D/g, '')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      legs,
      layovers: (it.layovers ?? []).map((l) => ({ code: l.id ?? '', name: l.name ?? '', durationMin: l.duration ?? 0 })),
      totalDurationMin: it.total_duration ?? legs.reduce((s, l) => s + l.durationMin, 0),
      stops: legs.length - 1,
      basePriceSgd: typeof it.price === 'number' ? it.price : null,
      co2Kg: it.carbon_emissions?.this_flight ? Math.round(it.carbon_emissions.this_flight / 1000) : null,
    });
  }
  return out.sort((a, b) => a.legs[0]!.from.time.localeCompare(b.legs[0]!.from.time));
}

// ------------------------------------------------------------------ fixture fallback

const DAY = 86_400_000;
const parse = (t: string) => Date.parse(`${t.replace(' ', 'T')}:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

function nearest(entries: FixtureEntry[], date: string): FixtureEntry | undefined {
  return [...entries].sort((x, y) => Math.abs(dayDiff(x.date, date)) - Math.abs(dayDiff(y.date, date)))[0];
}

function shiftItinerary(it: Itinerary, days: number): Itinerary {
  const shift = (t: string) => (t ? fmt(parse(t) + days * DAY) : t);
  const legs = it.legs.map((l) => ({ ...l, from: { ...l.from, time: shift(l.from.time) }, to: { ...l.to, time: shift(l.to.time) } }));
  return { ...it, legs, id: `${it.id.split('_')[0]}_${legs[0]!.from.time.replace(/\D/g, '')}` };
}

/**
 * Build a return-direction itinerary from an outbound one: legs reversed, airports swapped,
 * same durations and layovers, departing at the same time of day on `date`. Times are
 * approximate (time zones ignored) — only used when no real return data is available.
 */
function mirrorItinerary(it: Itinerary, date: string): Itinerary {
  const reversed = [...it.legs].reverse();
  const layovers = [...it.layovers].reverse();
  let t = parse(`${date} ${it.legs[0]!.from.time.slice(11) || '09:00'}`);
  const legs = reversed.map((l, i) => {
    const dep = t;
    const arr = dep + l.durationMin * 60_000;
    t = arr + (layovers[i]?.durationMin ?? 0) * 60_000;
    return { ...l, from: { ...l.to, time: fmt(dep) }, to: { ...l.from, time: fmt(arr) } };
  });
  return { ...it, legs, id: `${legs.map((l) => l.flightNumber.replace(/\s/g, '')).join('-')}R_${legs[0]!.from.time.replace(/\D/g, '')}` };
}

export function fixtureResponse(query: FlightSearchQuery, airline: string, note: string): FlightSearchResponse | null {
  const base = { query, airline, source: 'fixture' as const, fetchedAt: new Date().toISOString() };
  const direct = SERPAPI_FIXTURES.filter((f) => f.airline === airline && f.from === query.from && f.to === query.to);
  const pick = nearest(direct, query.date);
  if (pick) {
    const days = dayDiff(query.date, pick.date);
    return { ...base, itineraries: normaliseItineraries(pick.data, airline).map((it) => shiftItinerary(it, days)), note };
  }
  const reverse = SERPAPI_FIXTURES.filter((f) => f.airline === airline && f.from === query.to && f.to === query.from);
  const rev = nearest(reverse, query.date);
  if (rev) {
    return { ...base, itineraries: normaliseItineraries(rev.data, airline).map((it) => mirrorItinerary(it, query.date)), note: `${note} Return times are approximate.` };
  }
  return null;
}

// ------------------------------------------------------------------ live search

export async function searchFlights(query: FlightSearchQuery, airline: string, apiKey: string | undefined): Promise<FlightSearchResponse> {
  const key = `${airline}|${query.from}|${query.to}|${query.date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.response, source: 'cache' };

  const fallback = (why: string): FlightSearchResponse => {
    const fx = fixtureResponse(query, airline, `Offline data (${why}).`);
    if (fx) return fx;
    return { query, airline, source: 'fixture', fetchedAt: new Date().toISOString(), itineraries: [], note: `No flights available (${why}).` };
  };

  if (!apiKey) return fallback('SERPAPI_KEY not configured');

  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: query.from,
    arrival_id: query.to,
    outbound_date: query.date,
    type: '2',
    travel_class: '1',
    adults: '1',
    include_airlines: airline,
    currency: 'SGD',
    hl: 'en',
    gl: 'sg',
    api_key: apiKey,
  });
  try {
    // Stay well inside the function time limit so a slow SerpAPI falls back to fixtures
    // instead of the function being killed (which leaves the results page spinning).
    const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(8_000) });
    const json = (await res.json()) as SerpApiFixture & { error?: string };
    if (!res.ok || json.error) return fallback(json.error ?? `SerpAPI HTTP ${res.status}`);
    const itineraries = normaliseItineraries(json, airline);
    if (!itineraries.length) return fallback('no live results');
    const response: FlightSearchResponse = { query, airline, source: 'live', fetchedAt: new Date().toISOString(), itineraries };
    cache.set(key, { at: Date.now(), response });
    return response;
  } catch (e) {
    return fallback(e instanceof Error ? e.message : 'network error');
  }
}
