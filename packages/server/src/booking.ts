import { isCeid, type WebEntity } from '@sia/core';
import { z } from 'zod';
import { BrazeRestError, brazeRequest, brazeRestConfig, trackUsers } from './braze-rest';
import type { HandlerContext } from './handlers';

/**
 * POST /api/booking — server-side Braze writes that the browser SDK should not do:
 *  - `sia_next_trip` nested object attribute (users/track)
 *  - `sia_bookings` catalog item keyed by PNR (catalogs API)
 * The browser still logs the events (sia_booking_confirmed etc.) itself via the SDK.
 */
const IATA = z.string().regex(/^[A-Z]{3}$/);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BookingWrite = z.object({
  action: z.enum(['confirm', 'checkin', 'upgrade']),
  external_id: z.string().refine(isCeid, 'external_id must be a demo CEID'),
  trip: z.object({
    pnr: z.string().regex(/^(SQ|TR)\d{5}$/),
    origin_code: IATA,
    destination_code: IATA,
    cabin_class: z.enum(['economy', 'premium_economy', 'business', 'scootplus']),
    depart_date: DATE,
    return_date: DATE.optional(),
    booking_status: z.enum(['confirmed', 'cancelled', 'completed']),
    travel_party_size: z.number().int().min(1).max(9),
    checkin_status: z.enum(['not_open', 'open', 'completed']),
    meal_selected: z.boolean(),
    insurance_purchased: z.boolean(),
    fare_paid: z.number().nonnegative(),
    ancillaries_purchased: z.string(),
  }),
});
export type BookingWrite = z.infer<typeof BookingWrite>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const time = (d: string) => ({ $time: `${d}T00:00:00Z` });

export async function handleBooking(request: Request, ctx: HandlerContext): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const parsed = BookingWrite.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid booking payload', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
  const cfg = brazeRestConfig(ctx.env ?? process.env);
  if (!cfg) return json({ error: 'Braze REST is not configured on this deployment' }, 503);

  const { external_id, trip } = parsed.data;
  const entity: WebEntity = trip.pnr.startsWith('TR') ? 'TR' : 'SQ';
  const result: { next_trip: string; catalog: string } = { next_trip: 'pending', catalog: 'pending' };

  // 1) sia_next_trip — the single most relevant upcoming trip (Demo Data tab).
  try {
    await trackUsers(cfg, {
      attributes: [
        {
          external_id,
          sia_next_trip: {
            entity,
            pnr: trip.pnr,
            origin_code: trip.origin_code,
            destination_code: trip.destination_code,
            cabin_class: trip.cabin_class,
            depart_date: time(trip.depart_date),
            ...(trip.return_date ? { return_date: time(trip.return_date) } : {}),
            booking_status: trip.booking_status,
            travel_party_size: trip.travel_party_size,
            checkin_status: trip.checkin_status,
            meal_selected: trip.meal_selected,
            insurance_purchased: trip.insurance_purchased,
          },
        },
      ],
    });
    result.next_trip = 'written';
  } catch (e) {
    result.next_trip = e instanceof BrazeRestError ? `failed (${e.status})` : 'failed';
  }

  // 2) sia_bookings catalog item (the multi-trip ledger behind "Booked on Both SQ and Scoot").
  try {
    await brazeRequest(
      cfg,
      `/catalogs/sia_bookings/items/${trip.pnr}`,
      {
        items: [
          {
            external_id,
            entity,
            origin_code: trip.origin_code,
            destination_code: trip.destination_code,
            cabin_class: trip.cabin_class,
            depart_date: `${trip.depart_date}T00:00:00Z`,
            ...(trip.return_date ? { return_date: `${trip.return_date}T00:00:00Z` } : {}),
            booking_status: trip.booking_status,
            fare_paid: trip.fare_paid,
            ancillaries_purchased: trip.ancillaries_purchased,
            checkin_status: trip.checkin_status,
            meal_selected: trip.meal_selected,
          },
        ],
      },
      'PUT',
    );
    result.catalog = 'written';
  } catch (e) {
    // The catalog is created in Phase 5; until then this is expected to 404.
    result.catalog = e instanceof BrazeRestError ? (e.status === 404 ? 'skipped (catalog sia_bookings not created yet)' : `failed (${e.status})`) : 'failed';
  }

  const ok = result.next_trip === 'written';
  return json({ ok, ...result }, ok ? 200 : 502);
}
