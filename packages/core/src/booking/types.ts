import type { WebEntity } from '../entity';
import type { Itinerary } from '../schemas/flights';

/** KrisFlyer tier values as used in sia_loyalty.tier (Demo Data tab). */
export type LoyaltyTier = 'Blue' | 'Silver' | 'Gold' | 'PPS';

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'scootplus';

/** Route length band; drives seat and baggage price bands. */
export type DistanceBand = 'short' | 'medium';

export type SeatType = 'standard' | 'forward_zone' | 'extra_legroom' | 'solo' | 'scootplus';

export type AncillaryCategory =
  | 'seat'
  | 'baggage'
  | 'meal'
  | 'insurance'
  | 'flex'
  | 'upgrade'
  | 'priority'
  | 'wifi'
  | 'retail'
  | 'bundle';

export type AncillaryTiming = 'booking_only' | 'post_booking' | 'onboard';

/**
 * One ancillary product (docs/BUILD_PLAN.md §2b). Sourced from the brand-asset Drive folder
 * (singaporeair-ancillaries.md / scoot-ancillaries.md). Prices are indicative (SQ, from
 * published bands) or illustrative (Scoot publishes none — decision D11).
 */
export interface AncillaryProduct {
  code: string;
  entity: WebEntity;
  category: AncillaryCategory;
  name: string;
  description: string;
  /** booking_only = can only be bought while booking; post_booking = booking or Manage Booking. */
  timing: AncillaryTiming;
  /** Cabins that may buy it. Empty = all. */
  cabins: CabinClass[];
  /** Only sold on these aircraft (substring match on the leg's aircraft name). Empty = any. */
  aircraft: string[];
  /** Minimum flight duration in minutes (e.g. Book the Cook > 90 min). */
  minDurationMin?: number;
  /** Requires a logged-in KrisFlyer member. */
  requiresKrisflyer?: boolean;
  /** Fixed price per booking, SGD. null = computed by rules (seats, baggage, upgrades). */
  priceSgd: number | null;
  priceBasis: 'indicative' | 'illustrative' | 'free' | 'computed';
  /** Shown but not purchasable (lounge, Wi-Fi entitlement, Kris+ perks). */
  infoOnly?: boolean;
  confidence: 'Certain' | 'Likely' | 'Guessing';
  sourceUrl: string;
}

export interface FareFamily {
  code: string;
  name: string;
  cabin: CabinClass;
  /** Multiplier on the itinerary's base economy price. Illustrative. */
  priceMultiplier: number;
  /** Seat types free with this fare (SQ rules). */
  freeSeats: SeatType[];
  /** Bullet points for the fare card. */
  features: string[];
  /** Scoot: aircraft required (ScootPlus is 787 only). */
  aircraft?: string[];
}

export interface Passenger {
  title: 'Mr' | 'Ms' | 'Mrs' | 'Mx';
  firstName: string;
  lastName: string;
  type: 'adult' | 'child';
}

export interface SelectedFlight {
  direction: 'outbound' | 'inbound';
  itinerary: Itinerary;
  fareFamily: string;
  cabin: CabinClass;
  priceSgd: number;
}

export interface SeatSelection {
  passengerIndex: number;
  direction: 'outbound' | 'inbound';
  seatNumber: string;
  seatType: SeatType;
  priceSgd: number;
  freeByRule: 'fare' | 'tier' | 'cabin' | 'none';
}

export interface BookingSearch {
  from: string;
  to: string;
  departDate: string;
  returnDate?: string;
  tripType: 'one_way' | 'round_trip';
  cabin: CabinClass;
  paxCount: number;
}

/** A confirmed booking kept in the browser for Manage Booking (no payment data). */
export interface SavedBooking {
  pnr: string;
  entity: WebEntity;
  createdAt: string;
  search: BookingSearch;
  outbound: SelectedFlight;
  inbound: SelectedFlight | null;
  passengers: Passenger[];
  ancillaries: Record<string, { qty: number; priceSgd: number }>;
  baggageKg: number;
  seats: SeatSelection[];
  totalSgd: number;
  checkinStatus: 'not_open' | 'open' | 'completed';
  externalId: string | null;
}
