import type { WebEntity } from '../entity';
import type { Itinerary } from '../schemas/flights';
import { fareFamily, roundSgd } from './fares';
import type { AncillaryProduct, CabinClass, DistanceBand, LoyaltyTier, SeatType } from './types';

/** Destinations in the "short" price band (under ~4h from SIN). Everything else is "medium". */
const SHORT_HAUL = new Set(['BKK', 'KUL', 'CGK', 'DPS', 'HKT']);

export function distanceBand(from: string, to: string): DistanceBand {
  return SHORT_HAUL.has(to) || SHORT_HAUL.has(from) ? 'short' : 'medium';
}

/** True if every leg of the itinerary is flown by an aircraft matching one of `types`. */
export function aircraftMatches(itinerary: Itinerary, types: string[]): boolean {
  if (types.length === 0) return true;
  return itinerary.legs.every((l) => types.some((t) => (l.aircraft ?? '').includes(t)));
}

// ---------------------------------------------------------------- seats

/** Seat prices per passenger per flight, SGD. SQ = indicative USD bands × 1.35; Scoot = illustrative. */
const SEAT_PRICES: Record<WebEntity, Partial<Record<SeatType, Record<DistanceBand, number>>>> = {
  SQ: {
    standard: { short: 15, medium: 35 },
    forward_zone: { short: 30, medium: 65 },
    extra_legroom: { short: 60, medium: 120 },
    solo: { short: 225, medium: 225 },
  },
  TR: {
    // scoot-ancillaries.md lists a single paid "seat selection" product (no named tiers).
    standard: { short: 12, medium: 20 },
    scootplus: { short: 0, medium: 0 },
  },
};

/** Premium Economy uses its own Extra Legroom band. */
const SQ_PY_EXTRA_LEGROOM: Record<DistanceBand, number> = { short: 90, medium: 140 };

export interface SeatQuote {
  priceSgd: number;
  listPriceSgd: number;
  freeByRule: 'fare' | 'tier' | 'cabin' | 'none';
  /** Human-readable reason, e.g. "Free with Economy Flexi". */
  reason?: string;
}

/**
 * Price one seat. SQ rules (singaporeair-ancillaries.md §1, mock interpretation):
 * - Business and above: all seats free.
 * - Fare family freeSeats (Value/Standard: Standard; Flexi: Standard + Forward Zone).
 * - KrisFlyer tier: Silver → Standard free; Gold/PPS → Standard + Forward Zone free and
 *   Extra Legroom 50% off. Extra Legroom is otherwise always paid.
 * Scoot: flat a-la-carte prices, no tier rules (scoot-ancillaries.md "What's NOT offered").
 */
export function quoteSeat(args: {
  entity: WebEntity;
  seatType: SeatType;
  fareCode: string;
  band: DistanceBand;
  tier?: LoyaltyTier | null;
  /** Scoot Fare Bundle bought: a standard seat is included. */
  bundle?: boolean;
}): SeatQuote {
  const { entity, seatType, fareCode, band, tier, bundle } = args;
  const fare = fareFamily(entity, fareCode);
  const cabin: CabinClass = fare?.cabin ?? 'economy';

  let list = SEAT_PRICES[entity][seatType]?.[band] ?? 0;
  if (entity === 'SQ' && cabin === 'premium_economy' && seatType === 'extra_legroom') list = SQ_PY_EXTRA_LEGROOM[band];

  if (entity === 'SQ' && cabin === 'business') {
    return { priceSgd: 0, listPriceSgd: list, freeByRule: 'cabin', reason: 'Included in Business' };
  }
  if (entity === 'TR' && bundle && seatType === 'standard') {
    return { priceSgd: 0, listPriceSgd: list, freeByRule: 'fare', reason: 'Included in your Fare Bundle' };
  }
  if (fare?.freeSeats.includes(seatType)) {
    return { priceSgd: 0, listPriceSgd: list, freeByRule: 'fare', reason: `Free with ${fare.name}` };
  }
  if (entity === 'SQ' && tier) {
    const tierFree: Record<LoyaltyTier, SeatType[]> = {
      Blue: [],
      Silver: ['standard'],
      Gold: ['standard', 'forward_zone'],
      PPS: ['standard', 'forward_zone'],
    };
    if (tierFree[tier].includes(seatType)) {
      return { priceSgd: 0, listPriceSgd: list, freeByRule: 'tier', reason: `Free for KrisFlyer ${tier}` };
    }
    if (seatType === 'extra_legroom' && (tier === 'Gold' || tier === 'PPS')) {
      return { priceSgd: roundSgd(list * 0.5), listPriceSgd: list, freeByRule: 'tier', reason: `50% off for KrisFlyer ${tier}` };
    }
  }
  return { priceSgd: list, listPriceSgd: list, freeByRule: 'none' };
}

// ---------------------------------------------------------------- baggage

/** SQ prepaid baggage discount by tier (singaporeair-ancillaries.md §4): ≥48h / 6–48h before departure. */
const SQ_BAG_DISCOUNT: Record<LoyaltyTier | 'none', { early: number; late: number }> = {
  none: { early: 0.25, late: 0.1 },
  Blue: { early: 0.25, late: 0.1 },
  Silver: { early: 0.3, late: 0.15 },
  Gold: { early: 0.35, late: 0.2 },
  PPS: { early: 0.45, late: 0.3 },
};

/** Airport (undiscounted) rate per kg, SGD. Indicative for SQ; illustrative for Scoot. */
const BAG_RATE_PER_KG: Record<WebEntity, Record<DistanceBand, number>> = {
  SQ: { short: 12, medium: 28 },
  TR: { short: 3, medium: 4.5 },
};

export interface BaggageQuote {
  kg: number;
  priceSgd: number;
  listPriceSgd: number;
  discountPct: number;
  reason?: string;
}

export function quoteBaggage(args: {
  entity: WebEntity;
  kg: number;
  band: DistanceBand;
  hoursToDeparture: number;
  tier?: LoyaltyTier | null;
}): BaggageQuote {
  const { entity, kg, band, hoursToDeparture, tier } = args;
  const list = roundSgd(kg * BAG_RATE_PER_KG[entity][band]);
  if (entity === 'TR') {
    // Scoot: one flat pre-purchase price, cheaper than at the airport; no tier gating.
    const price = roundSgd(list * 0.8);
    return { kg, priceSgd: price, listPriceSgd: list, discountPct: 20, reason: 'Pre-purchase price' };
  }
  if (hoursToDeparture < 6) return { kg, priceSgd: list, listPriceSgd: list, discountPct: 0, reason: 'Airport rate' };
  const d = SQ_BAG_DISCOUNT[tier ?? 'none'];
  const pct = hoursToDeparture >= 48 ? d.early : d.late;
  return {
    kg,
    priceSgd: roundSgd(list * (1 - pct)),
    listPriceSgd: list,
    discountPct: Math.round(pct * 100),
    reason: tier ? `${Math.round(pct * 100)}% off for KrisFlyer ${tier}` : `${Math.round(pct * 100)}% off prepaid`,
  };
}

// ---------------------------------------------------------------- eligibility

export interface AncillaryContext {
  stage: 'booking' | 'manage';
  cabin: CabinClass;
  itinerary: Itinerary;
  hasKrisflyer: boolean;
}

/** Products this passenger can see at this stage, with the reason any are hidden. */
export function eligibleAncillaries(
  products: AncillaryProduct[],
  ctx: AncillaryContext,
): { product: AncillaryProduct; eligible: boolean; reason?: string }[] {
  return products.map((product) => {
    if (ctx.stage === 'manage' && product.timing === 'booking_only') {
      return { product, eligible: false, reason: 'Only available while booking' };
    }
    if (product.cabins.length && !product.cabins.includes(ctx.cabin)) {
      return { product, eligible: false, reason: 'Not available in this cabin' };
    }
    if (!aircraftMatches(ctx.itinerary, product.aircraft)) {
      return { product, eligible: false, reason: `Only on ${product.aircraft.join('/')} aircraft` };
    }
    if (product.minDurationMin && ctx.itinerary.totalDurationMin < product.minDurationMin) {
      return { product, eligible: false, reason: 'Flight too short' };
    }
    if (product.requiresKrisflyer && !ctx.hasKrisflyer) {
      return { product, eligible: false, reason: 'KrisFlyer members only' };
    }
    return { product, eligible: true };
  });
}

/** Demo PNR: entity prefix + 5 digits, e.g. TR48217. */
export function generatePnr(entity: WebEntity, random: () => number = Math.random): string {
  return `${entity}${String(Math.floor(random() * 90000) + 10000)}`;
}
