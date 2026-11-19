import { isCeid } from '@sia/core';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { BrazeRestError, brazeRequest, brazeRestConfig, exportUser, trackUsers } from './braze-rest';
import type { HandlerContext } from './handlers';
import { seedZara } from './seed';

/**
 * POST /api/admin — presenter-panel actions (docs/BUILD_PLAN.md §5), guarded by the
 * DEMO_ADMIN_TOKEN env var sent as `x-demo-admin-token`. Disabled when the var is unset.
 *
 *  - seed_zara      reset the Zara persona to the start of the demo
 *  - set_tier       change sia_loyalty.tier and log sia_loyalty_tier_changed (Loop 3.A)
 *  - complete_trip  log sia_trip_completed for sia_next_trip and mark it completed (Loop 3.B)
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const AdminRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('seed_zara') }),
  z.object({ action: z.literal('set_tier'), external_id: z.string().refine(isCeid), tier: z.enum(['Blue', 'Silver', 'Gold', 'PPS']) }),
  z.object({ action: z.literal('complete_trip'), external_id: z.string().refine(isCeid) }),
]);

function tokenOk(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleAdmin(request: Request, ctx: HandlerContext): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const env = ctx.env ?? process.env;
  const expected = env.DEMO_ADMIN_TOKEN;
  if (!expected) return json({ error: 'Presenter actions are disabled (DEMO_ADMIN_TOKEN not set)' }, 503);
  if (!tokenOk(request.headers.get('x-demo-admin-token'), expected)) return json({ error: 'Invalid presenter token' }, 401);
  const cfg = brazeRestConfig(env);
  if (!cfg) return json({ error: 'Braze REST is not configured on this deployment' }, 503);

  const parsed = AdminRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid admin payload', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
  const req = parsed.data;

  try {
    if (req.action === 'seed_zara') {
      const r = await seedZara(cfg, env.DEMO_PERSONA_EMAIL ?? undefined);
      return json({ ok: true, ...r });
    }

    const user = await exportUser(cfg, req.external_id);
    if (!user) return json({ error: 'No Braze profile for this CEID yet' }, 404);
    const attrs = (user.custom_attributes ?? {}) as { sia_loyalty?: { tier?: string }; sia_next_trip?: { pnr?: string; entity?: string; destination_code?: string } };
    const now = new Date().toISOString();

    if (req.action === 'set_tier') {
      const previous = attrs.sia_loyalty?.tier ?? 'Blue';
      await trackUsers(cfg, {
        attributes: [{ external_id: req.external_id, _merge_objects: true, sia_loyalty: { tier: req.tier, lifecycle_stage: 'active', last_activity_date: { $time: now } } }],
        events: [{ external_id: req.external_id, name: 'sia_loyalty_tier_changed', time: now, properties: { entity: 'SQ', previous_tier: previous, new_tier: req.tier, change_date: now } }],
      });
      return json({ ok: true, previous_tier: previous, new_tier: req.tier });
    }

    // complete_trip
    const trip = attrs.sia_next_trip;
    if (!trip?.pnr) return json({ error: 'This profile has no sia_next_trip to complete' }, 409);
    await trackUsers(cfg, {
      attributes: [{ external_id: req.external_id, _merge_objects: true, sia_next_trip: { booking_status: 'completed', checkin_status: 'completed' } }],
      events: [{ external_id: req.external_id, name: 'sia_trip_completed', time: now, properties: { entity: trip.entity ?? 'SQ', pnr: trip.pnr, destination_code: trip.destination_code ?? '' } }],
    });
    let catalog = 'updated';
    try {
      await brazeRequest(cfg, `/catalogs/sia_bookings/items/${trip.pnr}`, { items: [{ booking_status: 'completed', checkin_status: 'completed' }] }, 'PATCH');
    } catch (e) {
      catalog = e instanceof BrazeRestError ? `skipped (${e.status})` : 'skipped';
    }
    return json({ ok: true, pnr: trip.pnr, catalog });
  } catch (e) {
    return json(e instanceof BrazeRestError ? { error: 'Braze REST error', status: e.status, detail: e.body.slice(0, 300) } : { error: String(e) }, 502);
  }
}
