import { ALIAS_LABELS, ceidFromEmail, CONSENT_TOPICS, consentItem, type ConsentItem } from '@sia/core';
import { brazeRequest, trackUsers, type BrazeRestConfig } from './braze-rest';
import { handleConsent } from './consent';

/**
 * Seed the "Zara" demo persona (SIA Presentation Draft → Zara Data tables, Loops 1–3.A).
 * Safe to re-run: every write is an upsert, consent is re-set for all topics and
 * sia_next_trip is cleared, so this also resets Zara after a rehearsal.
 * Used by scripts/seed-zara.ts and the presenter panel (/api/admin).
 */
export async function seedZara(cfg: BrazeRestConfig, email = 'zara.tan@example.com'): Promise<{ ceid: string; email: string; log: string[] }> {
  const log: string[] = [];
  const ceid = await ceidFromEmail(email);
  const KRISFLYER = '8812340001';
  const t = (iso: string) => ({ $time: iso });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  log.push(`Seeding Zara → ${email} → ${ceid}`);

  // 1) Profile attributes ----------------------------------------------------------------
  await trackUsers(cfg, {
    attributes: [
      {
        external_id: ceid,
        _update_existing_only: false,
        first_name: 'Zara',
        last_name: 'Tan',
        email,
        home_city: 'Singapore',
        country: 'SG',
        krisflyer_number: KRISFLYER,
        sia_registered_entities: ['SQ', 'TR'],
        sia_last_search_origin: 'SIN',
        sia_last_search_destination: 'PER',
        sia_last_search_depart: '2026-12-10T09:15:00+08:00',
        sia_last_search_return: '2026-12-17T14:40:00+08:00',
        sia_preference_meals: 'No preference',
        sia_preference_seats: 'Window',
        sia_experiment_group: 'treatment',
        sia_processing_restricted: false,
        // Start state: no upcoming trip. Clearing it also resets Zara after a rehearsal.
        sia_next_trip: null,
        sia_loyalty: {
          tier: 'Blue',
          miles: 24850,
          miles_expiry: t('2026-12-05T00:00:00Z'),
          registration_date: t('2019-03-14T00:00:00Z'),
          last_activity_date: t('2026-08-20T00:00:00Z'),
          lifecycle_stage: 'lapsing',
        },
      },
    ],
    events: [
      {
        external_id: ceid,
        name: 'sia_booking_confirmed',
        time: '2026-06-20T10:00:00Z',
        properties: { entity: 'SQ', pnr: 'SQ91045', origin_code: 'SIN', destination_code: 'NRT', cabin_class: 'economy', depart_date: '2026-08-02T00:00:00Z', fare_paid: 980, ancillaries_purchased: 'seat' },
      },
      { external_id: ceid, name: 'sia_trip_completed', time: '2026-08-09T12:00:00Z', properties: { entity: 'SQ', pnr: 'SQ91045', destination_code: 'NRT' } },
      {
        external_id: ceid,
        name: 'sia_searched_flight',
        time: daysAgo(5),
        properties: { entity: 'TR', origin: 'Singapore', origin_code: 'SIN', destination: 'Perth', destination_code: 'PER', depart_date: '2026-12-10T00:00:00Z', return_date: '2026-12-17T00:00:00Z', trip_type: 'round_trip', cabin_class: 'economy', pax_count: 1 },
      },
      {
        external_id: ceid,
        name: 'sia_searched_flight',
        time: daysAgo(0.05),
        properties: { entity: 'SQ', origin: 'Singapore', origin_code: 'SIN', destination: 'Perth', destination_code: 'PER', depart_date: '2026-12-10T09:15:00+08:00', return_date: '2026-12-17T14:40:00+08:00', trip_type: 'round_trip', cabin_class: 'economy', pax_count: 1 },
      },
    ],
    purchases: [{ external_id: ceid, product_id: 'SQ_NRT_Y_STANDARD', currency: 'SGD', price: 980, time: '2026-06-20T10:00:00Z', properties: { entity: 'SQ', pnr: 'SQ91045' } }],
  });
  log.push('✓ attributes, sia_loyalty, past SQ trip, SQ + Scoot searches, purchase');

  // 2) Entity identifiers (one profile, every entity's id) ---------------------------------
  await brazeRequest(cfg, '/users/alias/new', {
    user_aliases: [
      { external_id: ceid, alias_name: `SQ-${ceid.slice(-8)}`, alias_label: ALIAS_LABELS.SQ },
      { external_id: ceid, alias_name: `TR-${ceid.slice(-8)}`, alias_label: ALIAS_LABELS.TR },
      { external_id: ceid, alias_name: KRISFLYER, alias_label: ALIAS_LABELS.krisflyer },
    ],
  });
  log.push('✓ aliases: sq_customer_id, tr_customer_id, krisflyer');

  // 3) Earlier SQ booking in the sia_bookings catalog ("Booked on Both" needs it) ----------
  await brazeRequest(
    cfg,
    '/catalogs/sia_bookings/items/SQ91045',
    {
      items: [
        { external_id: ceid, entity: 'SQ', origin_code: 'SIN', destination_code: 'NRT', cabin_class: 'economy', depart_date: '2026-08-02T00:00:00Z', return_date: '2026-08-09T00:00:00Z', booking_status: 'completed', fare_paid: 980, ancillaries_purchased: 'seat', checkin_status: 'completed', meal_selected: false },
      ],
    },
    'PUT',
  );
  log.push('✓ sia_bookings: SQ91045');

  // 4) Consent: every topic set explicitly, through the same backend the sites use ---------
  const ON: Partial<Record<string, ConsentItem['frequency']>> = {
    SQ_email_flight_status: 'as_needed',
    SQ_email_news: 'monthly',
    TR_email_flight_status: 'as_needed',
    TR_email_promotions: 'weekly',
    KRISPLUS_push_offers: 'as_needed',
  };
  const items = CONSENT_TOPICS.map((topic) => (ON[topic.id] ? consentItem(topic, 'opted_in', ON[topic.id]) : consentItem(topic, 'opted_out')));
  const res = await handleConsent(
    new Request('http://seed/api/consent', { method: 'POST', body: JSON.stringify({ external_id: ceid, items, source_system: 'registration' }) }),
    { entity: 'SQ', env: { BRAZE_REST_API_KEY: cfg.apiKey, BRAZE_REST_URL: cfg.baseUrl } },
  );
  const out = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Consent seed failed: ${JSON.stringify(out)}`);
  log.push(`✓ consent ${String(out.mode)}: ${items.filter((i) => i.status === 'opted_in').map((i) => i.id).join(', ')} on`);
  log.push(`  subscription groups: ${JSON.stringify(out.subscription_groups)}`);
  return { ceid, email, log };
}
