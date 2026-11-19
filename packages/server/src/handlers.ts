import { FlightSearchQuery, isCeid, type WebEntity } from '@sia/core';
import { DEMO_ORIGIN, DESTINATIONS } from '@sia/data';
import { BrazeRestError, brazeRestConfig, exportUser, maskEmail } from './braze-rest';
import { searchFlights } from './serpapi';

/**
 * Framework-agnostic handlers using the Web Request/Response API. Vercel functions in each
 * app (apps/*\/api) bind the entity; scripts/dev-api.ts serves them locally.
 */
export interface HandlerContext {
  entity: WebEntity;
  env?: Record<string, string | undefined>;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const ALLOWED_AIRPORTS = new Set([DEMO_ORIGIN.code, ...DESTINATIONS.filter((d) => d.status === 'validated').map((d) => d.code)]);
const MAX_DAYS_AHEAD = 330;

/** GET /api/flights?from=SIN&to=PER&date=2026-12-10 */
export async function handleFlights(request: Request, ctx: HandlerContext): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(request.url);
  const parsed = FlightSearchQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: 'Invalid query', issues: parsed.error.issues.map((i) => i.message) }, 400);
  const q = parsed.data;

  if (!ALLOWED_AIRPORTS.has(q.from) || !ALLOWED_AIRPORTS.has(q.to) || q.from === q.to || ![q.from, q.to].includes(DEMO_ORIGIN.code)) {
    return json({ error: `Route ${q.from}-${q.to} is not part of the demo` }, 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  const days = (Date.parse(q.date) - Date.parse(today)) / 86_400_000;
  if (days < 0 || days > MAX_DAYS_AHEAD) return json({ error: `Date must be between today and ${MAX_DAYS_AHEAD} days ahead` }, 400);

  const env = ctx.env ?? process.env;
  const result = await searchFlights(q, ctx.entity, env.SERPAPI_KEY);
  // Short CDN cache on live results keeps repeated demo searches off the SerpAPI quota.
  return json(result, 200, result.source === 'fixture' ? {} : { 'Cache-Control': 'public, s-maxage=1800' });
}

/**
 * GET /api/braze/profile?external_id=ceid_… — live Braze profile for the debug overlay.
 * Only CEID-shaped ids are accepted, the email is masked, and phone / last name are never
 * exported, so this public endpoint cannot be used to read arbitrary profiles' PII.
 */
export async function handleBrazeProfile(request: Request, ctx: HandlerContext): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const id = new URL(request.url).searchParams.get('external_id') ?? '';
  if (!isCeid(id)) return json({ error: 'external_id must be a demo CEID (ceid_…)' }, 400);
  const cfg = brazeRestConfig(ctx.env ?? process.env);
  if (!cfg) return json({ error: 'Braze REST is not configured on this deployment' }, 503);
  try {
    const user = await exportUser(cfg, id);
    if (!user) return json({ found: false, external_id: id });
    if (typeof user.email === 'string') user.email = maskEmail(user.email);
    return json({ found: true, user });
  } catch (e) {
    if (e instanceof BrazeRestError) return json({ error: 'Braze REST error', status: e.status }, e.status === 429 ? 429 : 502);
    return json({ error: 'Braze REST request failed' }, 502);
  }
}

/** GET /api/health — what is configured (never the values). */
export function handleHealth(_request: Request, ctx: HandlerContext): Response {
  const env = ctx.env ?? process.env;
  return json({
    ok: true,
    entity: ctx.entity,
    serpapi: Boolean(env.SERPAPI_KEY),
    brazeRest: Boolean(brazeRestConfig(env)),
    presenter: Boolean(env.DEMO_ADMIN_TOKEN),
    routes: [...ALLOWED_AIRPORTS],
  });
}
