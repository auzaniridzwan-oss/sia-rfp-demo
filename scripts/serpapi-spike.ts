/**
 * Phase 0 destination spike (decision D4).
 *
 * For each primary route, query SerpAPI Google Flights once per airline (SQ, TR)
 * at +2, +4 and +8 weeks. A route passes when BOTH airlines return >= 2 itineraries
 * on every date. A failing primary is replaced by its fallback, which is then tested.
 * Successful responses are saved as fixtures for offline demos.
 *
 * Usage: pnpm spike:serpapi   (reads SERPAPI_KEY from the repo-root .env)
 * Cost: 18 searches for the 3 primaries (+6 per fallback tested). Existing fixtures
 * are reused, so re-runs cost nothing.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AIRLINE_IATA, DEMO_ORIGIN, DESTINATIONS, type Destination } from '../packages/data/src/destinations';

const KEY = process.env.SERPAPI_KEY;
if (!KEY) {
  console.error('SERPAPI_KEY is not set. Add it to the repo-root .env (see .env.example).');
  process.exit(1);
}

const FIXTURE_DIR = path.resolve('packages/data/fixtures/serpapi');
const WEEKS = [2, 4, 8];
// 2 per airline per date = at least two daily frequencies to choose from in the demo.
const MIN_ITINERARIES = 2;

interface Leg { airline?: string; flight_number?: string }
interface Itinerary { flights?: Leg[]; price?: number; total_duration?: number }
interface SerpResponse { best_flights?: Itinerary[]; other_flights?: Itinerary[]; error?: string }

const isoDate = (weeksAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + weeksAhead * 7);
  return d.toISOString().slice(0, 10);
};

async function search(dest: string, airline: string, date: string): Promise<SerpResponse> {
  const file = path.join(FIXTURE_DIR, `${airline}_${DEMO_ORIGIN.code}-${dest}_${date}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8')) as SerpResponse;

  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: DEMO_ORIGIN.code,
    arrival_id: dest,
    outbound_date: date,
    type: '2', // one-way is enough to prove the airline flies the route
    include_airlines: airline,
    currency: 'SGD',
    hl: 'en',
    gl: 'sg',
    api_key: KEY!,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const json = (await res.json()) as SerpResponse & { search_metadata?: unknown; search_parameters?: unknown };
  if (!res.ok || json.error) return { error: json.error ?? `HTTP ${res.status}` };

  // Keep only what the sites need; drop metadata (it can echo request details).
  const slim: SerpResponse = { best_flights: json.best_flights, other_flights: json.other_flights };
  await writeFile(file, JSON.stringify(slim, null, 2));
  return slim;
}

function summarise(r: SerpResponse, airline: string) {
  const all = [...(r.best_flights ?? []), ...(r.other_flights ?? [])];
  // Defence in depth: count only itineraries where every leg is the requested airline.
  const own = all.filter((it) => (it.flights ?? []).every((l) => (l.flight_number ?? '').startsWith(airline)));
  const nonstop = own.filter((it) => (it.flights ?? []).length === 1).length;
  const prices = own.map((it) => it.price).filter((p): p is number => typeof p === 'number');
  return { count: own.length, nonstop, minPrice: prices.length ? Math.min(...prices) : null };
}

async function testRoute(d: Destination) {
  const rows: string[] = [];
  let pass = true;
  for (const date of WEEKS.map(isoDate)) {
    for (const airline of Object.values(AIRLINE_IATA)) {
      const r = await search(d.code, airline, date);
      if (r.error) {
        rows.push(`  ${date} ${airline}: ERROR ${r.error}`);
        pass = false;
        continue;
      }
      const s = summarise(r, airline);
      if (s.count < MIN_ITINERARIES) pass = false;
      rows.push(`  ${date} ${airline}: ${s.count} itineraries (${s.nonstop} nonstop), from SGD ${s.minPrice ?? '-'}`);
    }
  }
  return { pass, rows };
}

await mkdir(FIXTURE_DIR, { recursive: true });
const results: Record<string, boolean> = {};

for (const primary of DESTINATIONS.filter((d) => d.role === 'primary')) {
  const { pass, rows } = await testRoute(primary);
  results[primary.code] = pass;
  console.log(`${pass ? 'PASS' : 'FAIL'} SIN-${primary.code} (${primary.city})\n${rows.join('\n')}`);
  if (!pass) {
    const fb = DESTINATIONS.find((d) => d.fallbackFor === primary.code);
    if (fb) {
      const r = await testRoute(fb);
      results[fb.code] = r.pass;
      console.log(`${r.pass ? 'PASS' : 'FAIL'} fallback SIN-${fb.code} (${fb.city})\n${r.rows.join('\n')}`);
    }
  }
}

console.log('\nSummary:', results);
console.log('Update `status` in packages/data/src/destinations.ts to match.');
