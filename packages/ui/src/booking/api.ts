import { ANCILLARIES, ancillary } from '@sia/data';
import type { BrazeClient, SavedBooking } from '@sia/core';

/** Comma list of ancillary categories bought, e.g. "seat,baggage,insurance" (Demo Data format). */
export function ancillaryCategories(b: Pick<SavedBooking, 'ancillaries' | 'seats'>): string {
  const cats = new Set<string>();
  if (b.seats.some((x) => x.priceSgd > 0)) cats.add('seat');
  for (const code of Object.keys(b.ancillaries)) cats.add(code === 'BAGGAGE' ? 'baggage' : (ancillary(code)?.category ?? 'other'));
  return [...cats].join(',');
}

const MEAL_CODES = new Set([...ANCILLARIES.SQ, ...ANCILLARIES.TR].filter((p) => p.category === 'meal').map((p) => p.code));
const INSURANCE_CODES = new Set([...ANCILLARIES.SQ, ...ANCILLARIES.TR].filter((p) => p.category === 'insurance').map((p) => p.code));

/**
 * Ask the site's server to write sia_next_trip and the sia_bookings catalog item for a
 * signed-in user, and record the outcome in the debug overlay's activity stream.
 */
export async function syncBooking(braze: BrazeClient, b: SavedBooking, action: 'confirm' | 'checkin' | 'upgrade') {
  if (!b.externalId) return;
  const codes = Object.keys(b.ancillaries);
  const body = {
    action,
    external_id: b.externalId,
    trip: {
      pnr: b.pnr,
      origin_code: b.search.from,
      destination_code: b.search.to,
      cabin_class: b.outbound.cabin,
      depart_date: b.search.departDate,
      ...(b.search.returnDate ? { return_date: b.search.returnDate } : {}),
      booking_status: 'confirmed',
      travel_party_size: b.passengers.length,
      checkin_status: b.checkinStatus,
      meal_selected: codes.some((c) => MEAL_CODES.has(c)),
      insurance_purchased: codes.some((c) => INSURANCE_CODES.has(c)),
      fare_paid: b.totalSgd,
      ancillaries_purchased: ancillaryCategories(b),
    },
  };
  try {
    const res = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    braze.noteRest(`booking ${action}: sia_next_trip + sia_bookings`, res.ok ? 'sent' : 'failed', { request: body.trip, response: out });
  } catch (e) {
    braze.noteRest(`booking ${action}`, 'failed', body.trip, String(e));
  }
}
