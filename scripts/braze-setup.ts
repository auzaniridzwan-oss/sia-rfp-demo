/**
 * Phase 5 workspace setup (idempotent): creates the two Demo Data catalogs and loads the
 * ancillary offers generated from the same data the sites use (packages/data/ancillaries).
 *
 *   sia_bookings          — one item per booking (PNR); written live by /api/booking
 *   sia_ancillary_offers  — offers for Loop 3.B Connected Content / Catalog Liquid
 *
 * Usage: pnpm braze:setup   (reads BRAZE_REST_API_KEY / BRAZE_REST_URL from .env)
 */
import { ANCILLARIES } from '../packages/data/src/ancillaries';
import { BrazeRestError, brazeRequest, brazeRestConfig } from '../packages/server/src/braze-rest';

const cfg = brazeRestConfig();
if (!cfg) {
  console.error('BRAZE_REST_API_KEY / BRAZE_REST_URL missing in .env');
  process.exit(1);
}

type FieldType = 'string' | 'number' | 'boolean' | 'time';
const CATALOGS: { name: string; description: string; fields: [string, FieldType][] }[] = [
  {
    name: 'sia_bookings',
    description: 'SIA Group demo: every booking across SQ and Scoot, keyed by PNR (Demo Data tab, Sections 6 and 8).',
    fields: [
      ['id', 'string'],
      ['external_id', 'string'],
      ['entity', 'string'],
      ['origin_code', 'string'],
      ['destination_code', 'string'],
      ['cabin_class', 'string'],
      ['depart_date', 'time'],
      ['return_date', 'time'],
      ['booking_status', 'string'],
      ['fare_paid', 'number'],
      ['ancillaries_purchased', 'string'],
      ['checkin_status', 'string'],
      ['meal_selected', 'boolean'],
    ],
  },
  {
    name: 'sia_ancillary_offers',
    description: 'SIA Group demo: ancillary and partner offers by entity, destination and cabin (Demo Data tab, Section 8). title/description added for message copy.',
    fields: [
      ['id', 'string'],
      ['entity', 'string'],
      ['offer_type', 'string'],
      ['title', 'string'],
      ['description', 'string'],
      ['destination_eligibility', 'string'],
      ['cabin_class_eligibility', 'string'],
      ['offer_value', 'number'],
      ['valid_until', 'time'],
    ],
  },
];

const OFFER_TYPE: Record<string, string> = {
  SQ_MYSQUPGRADE: 'mysqupgrade',
  SQ_MILES_UPGRADE: 'miles_upgrade',
  SQ_BOOK_THE_COOK: 'book_the_cook',
  SQ_BAG_KG: 'extra_baggage',
  SQ_INSURANCE: 'travel_insurance',
  SQ_SEAT_FWD: 'seat_forward_zone',
  SQ_SEAT_XLEG: 'seat_extra_legroom',
  TR_SCOOTPLUS: 'scootplus_upgrade',
  TR_BOARDMEFIRST: 'boardmefirst',
  TR_BAG: 'extra_baggage',
  TR_MEAL: 'meal',
  TR_SCOOTSURANCE: 'travel_insurance',
  TR_WIFI: 'wifi',
  TR_SEAT: 'seat',
  TR_SNOOZE_KIT: 'snooze_kit',
};

/** Typical value (SGD) for computed-price products, so every offer carries a number. */
const TYPICAL: Record<string, number> = {
  SQ_MYSQUPGRADE: 250,
  SQ_MILES_UPGRADE: 120,
  SQ_BAG_KG: 150,
  SQ_SEAT_FWD: 65,
  SQ_SEAT_XLEG: 120,
  TR_SCOOTPLUS: 120,
  TR_BAG: 36,
  TR_SEAT: 20,
};

const VALID_UNTIL = '2027-03-31T23:59:59Z';

function offers() {
  const fromProducts = [...ANCILLARIES.SQ, ...ANCILLARIES.TR]
    .filter((p) => OFFER_TYPE[p.code])
    .map((p) => ({
      id: p.code,
      entity: p.entity,
      offer_type: OFFER_TYPE[p.code]!,
      title: p.name,
      description: p.description,
      destination_eligibility: 'ANY',
      cabin_class_eligibility: p.cabins.length ? p.cabins.join(',') : 'ANY',
      offer_value: p.priceSgd ?? TYPICAL[p.code] ?? 0,
      valid_until: VALID_UNTIL,
    }));
  // Kris+ partner offers — Loop 1 step 5 ("skincare picks for her trip") and Loop 3.B.
  const krisPlus = [
    { id: 'KP_PER_SKINCARE', destination: 'PER', title: 'Travel-size skincare picks for Perth', description: 'SGD 20 off sun care and skincare at Kris+ partners before your Perth trip.', value: 20 },
    { id: 'KP_NRT_DINING', destination: 'NRT', title: 'Japanese dining in Singapore', description: 'Get in the mood for Tokyo: 15% cashback at Japanese restaurants on Kris+.', value: 15 },
    { id: 'KP_BKK_SPA', destination: 'BKK', title: 'Pre-trip spa deal', description: 'Unwind before Bangkok: SGD 25 off spa treatments on Kris+.', value: 25 },
    { id: 'KP_ANY_CASHBACK', destination: 'ANY', title: 'Double Kris+ rewards', description: 'Earn double KrisPay miles at 1,700+ Kris+ outlets this month.', value: 2 },
  ].map((k) => ({
    id: k.id,
    entity: 'KRISPLUS',
    offer_type: 'kris_plus_voucher',
    title: k.title,
    description: k.description,
    destination_eligibility: k.destination,
    cabin_class_eligibility: 'ANY',
    offer_value: k.value,
    valid_until: VALID_UNTIL,
  }));
  return [...fromProducts, ...krisPlus];
}

const existing = await brazeRequest<{ catalogs: { name: string; num_items?: number }[] }>(cfg, '/catalogs', undefined, 'GET');
const names = new Set(existing.catalogs.map((c) => c.name));

for (const c of CATALOGS) {
  if (names.has(c.name)) {
    console.log(`= catalog ${c.name} already exists`);
    continue;
  }
  await brazeRequest(cfg, '/catalogs', {
    catalogs: [{ name: c.name, description: c.description, fields: c.fields.map(([name, type]) => ({ name, type })) }],
  });
  console.log(`+ created catalog ${c.name} (${c.fields.length} fields)`);
}

// Upsert offers (PUT replaces items with the same id; batches of 50).
const items = offers();
for (let i = 0; i < items.length; i += 50) {
  try {
    await brazeRequest(cfg, '/catalogs/sia_ancillary_offers/items', { items: items.slice(i, i + 50) }, 'PUT');
  } catch (e) {
    console.error('Offer upload failed:', e instanceof BrazeRestError ? e.body : e);
    process.exit(1);
  }
}
console.log(`+ upserted ${items.length} sia_ancillary_offers items`);
