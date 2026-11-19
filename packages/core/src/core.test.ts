import { describe, expect, it } from 'vitest';
import { ceidFromEmail, isCeid } from './braze/identity';
import { validateEvent } from './braze/events';
import { distanceBand, eligibleAncillaries, quoteBaggage, quoteSeat } from './booking/rules';
import { bookingTotal } from './booking/store';
import type { AncillaryProduct } from './booking/types';
import type { Itinerary } from './schemas/flights';

describe('ceidFromEmail', () => {
  it('is deterministic and case/whitespace-insensitive', async () => {
    const a = await ceidFromEmail('Zara.Tan@Gmail.com ');
    const b = await ceidFromEmail('zara.tan@gmail.com');
    expect(a).toBe(b);
    expect(a).toMatch(/^ceid_[0-9a-f]{16}$/);
    expect(isCeid(a)).toBe(true);
  });
  it('prefixes example.com addresses as test users', async () => {
    expect(await ceidFromEmail('qa+sq@example.com')).toMatch(/^ceid_test_[0-9a-f]{16}$/);
  });
});

describe('validateEvent', () => {
  const search = {
    origin: 'Singapore', origin_code: 'SIN', destination: 'Perth', destination_code: 'PER',
    depart_date: new Date('2026-12-10'), trip_type: 'round_trip', cabin_class: 'economy', pax_count: 1,
  };
  it('adds the site entity', () => {
    const r = validateEvent('sia_searched_flight', search, 'SQ');
    expect(r.ok && r.props.entity).toBe('SQ');
  });
  it('keeps an explicit entity (e.g. Scoot consent changed on the SQ site)', () => {
    const r = validateEvent('sia_consent_updated', { entity: 'TR', channel: 'email', communication_nature: 'promotions', new_status: 'opted_out', source_system: 'preference_center' }, 'SQ');
    expect(r.ok && r.props.entity).toBe('TR');
  });
  it('rejects unknown properties and wrong types', () => {
    const r = validateEvent('sia_searched_flight', { ...search, email: 'x@y.z', pax_count: 0 }, 'SQ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(' ')).toMatch(/pax_count|Unrecognized key/);
  });
  it('rejects string dates (Braze needs Date objects for time properties)', () => {
    expect(validateEvent('sia_searched_flight', { ...search, depart_date: '2026-12-10' }, 'SQ').ok).toBe(false);
  });
});

describe('quoteSeat (SQ rules)', () => {
  const base = { entity: 'SQ' as const, band: 'medium' as const };
  it('Lite pays for every seat', () => {
    expect(quoteSeat({ ...base, seatType: 'standard', fareCode: 'Y_LITE' })).toMatchObject({ priceSgd: 35, freeByRule: 'none' });
  });
  it('Value gets Standard free, Forward Zone paid', () => {
    expect(quoteSeat({ ...base, seatType: 'standard', fareCode: 'Y_VALUE' }).freeByRule).toBe('fare');
    expect(quoteSeat({ ...base, seatType: 'forward_zone', fareCode: 'Y_VALUE' }).priceSgd).toBe(65);
  });
  it('Flexi gets Forward Zone free but Extra Legroom stays paid', () => {
    expect(quoteSeat({ ...base, seatType: 'forward_zone', fareCode: 'Y_FLEXI' }).priceSgd).toBe(0);
    expect(quoteSeat({ ...base, seatType: 'extra_legroom', fareCode: 'Y_FLEXI' }).priceSgd).toBe(120);
  });
  it('Gold tier: Forward Zone free on Lite, Extra Legroom 50% off', () => {
    expect(quoteSeat({ ...base, seatType: 'forward_zone', fareCode: 'Y_LITE', tier: 'Gold' })).toMatchObject({ priceSgd: 0, freeByRule: 'tier' });
    expect(quoteSeat({ ...base, seatType: 'extra_legroom', fareCode: 'Y_LITE', tier: 'Gold' }).priceSgd).toBe(60);
  });
  it('Business: everything free', () => {
    expect(quoteSeat({ ...base, seatType: 'extra_legroom', fareCode: 'J_STANDARD' }).freeByRule).toBe('cabin');
  });
  it('Scoot ignores KrisFlyer tier', () => {
    expect(quoteSeat({ entity: 'TR', band: 'short', seatType: 'standard', fareCode: 'TR_ECONOMY', tier: 'PPS' })).toMatchObject({ priceSgd: 12, freeByRule: 'none' });
  });
});

describe('quoteBaggage', () => {
  it('SQ discount scales with tier and timing', () => {
    expect(quoteBaggage({ entity: 'SQ', kg: 10, band: 'short', hoursToDeparture: 100 }).discountPct).toBe(25);
    expect(quoteBaggage({ entity: 'SQ', kg: 10, band: 'short', hoursToDeparture: 100, tier: 'PPS' }).discountPct).toBe(45);
    expect(quoteBaggage({ entity: 'SQ', kg: 10, band: 'short', hoursToDeparture: 24, tier: 'Gold' }).discountPct).toBe(20);
    expect(quoteBaggage({ entity: 'SQ', kg: 10, band: 'short', hoursToDeparture: 3 }).discountPct).toBe(0);
  });
});

describe('eligibleAncillaries', () => {
  const it787: Itinerary = {
    id: 'x', stops: 0, layovers: [], totalDurationMin: 300, basePriceSgd: 200, co2Kg: null,
    legs: [{ flightNumber: 'TR 16', airline: 'Scoot', aircraft: 'Boeing 787', from: { code: 'SIN', name: '', time: '' }, to: { code: 'PER', name: '', time: '' }, durationMin: 300, legroom: null, overnight: false }],
  };
  const a320 = { ...it787, legs: [{ ...it787.legs[0]!, aircraft: 'Airbus A320' }] };
  const p = (over: Partial<AncillaryProduct>): AncillaryProduct => ({
    code: 'P', entity: 'TR', category: 'wifi', name: 'P', description: '', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 1, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: '', ...over,
  });
  it('hides booking-only products in Manage Booking', () => {
    expect(eligibleAncillaries([p({ timing: 'booking_only' })], { stage: 'manage', cabin: 'economy', itinerary: it787, hasKrisflyer: false })[0]!.eligible).toBe(false);
  });
  it('gates 787-only products by aircraft', () => {
    const wifi = p({ aircraft: ['787'] });
    expect(eligibleAncillaries([wifi], { stage: 'booking', cabin: 'economy', itinerary: it787, hasKrisflyer: false })[0]!.eligible).toBe(true);
    expect(eligibleAncillaries([wifi], { stage: 'booking', cabin: 'economy', itinerary: a320, hasKrisflyer: false })[0]!.eligible).toBe(false);
  });
});

describe('misc', () => {
  it('distance bands', () => {
    expect(distanceBand('SIN', 'BKK')).toBe('short');
    expect(distanceBand('SIN', 'NRT')).toBe('medium');
  });
  it('bookingTotal multiplies fares by passengers', () => {
    const total = bookingTotal({
      search: null, inbound: null, pnr: null, step: 'payment', baggageKg: 0,
      outbound: { direction: 'outbound', itinerary: {} as Itinerary, fareFamily: 'Y_LITE', cabin: 'economy', priceSgd: 300 },
      passengers: [{ title: 'Ms', firstName: 'Z', lastName: 'T', type: 'adult' }, { title: 'Mr', firstName: 'A', lastName: 'T', type: 'adult' }],
      ancillaries: { TR_MEAL: { qty: 2, priceSgd: 15 } },
      seats: [{ passengerIndex: 0, direction: 'outbound', seatNumber: '12A', seatType: 'standard', priceSgd: 20, freeByRule: 'none' }],
    });
    expect(total).toBe(600 + 30 + 20);
  });
});

describe('Scoot Fare Bundle', () => {
  it('makes a standard seat free', () => {
    expect(quoteSeat({ entity: 'TR', band: 'medium', seatType: 'standard', fareCode: 'TR_ECONOMY', bundle: true })).toMatchObject({ priceSgd: 0, freeByRule: 'fare' });
    expect(quoteSeat({ entity: 'TR', band: 'medium', seatType: 'standard', fareCode: 'TR_ECONOMY' }).priceSgd).toBe(20);
  });
});

describe('subscriptionGroupStates', async () => {
  const { subscriptionGroupStates } = await import('./schemas/consent');
  const state = new Map([
    ['SQ_email_news', { status: 'opted_in' as const }],
    ['SQ_email_promotions', { status: 'opted_out' as const }],
    ['TR_email_news', { status: 'opted_out' as const }],
    ['TR_email_promotions', { status: 'opted_out' as const }],
  ]);
  it('subscribes a group when any mapped topic is opted in', () => {
    const r = subscriptionGroupStates(state, ['SQ_email_promotions', 'TR_email_promotions']);
    expect(r.map((x) => [x.group.name, x.subscribed])).toEqual([
      ['Singapore Airlines (SQ) Email Marketing', true],
      ['Scoot (TR) Email Marketing', false],
    ]);
  });
  it('ignores changes that touch no mapped group', () => {
    expect(subscriptionGroupStates(state, ['SQ_push_flight_status'])).toEqual([]);
  });
});
