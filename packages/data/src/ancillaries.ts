import type { AncillaryProduct, WebEntity } from '@sia/core';

/**
 * Ancillary catalogues (docs/BUILD_PLAN.md §2b), from singaporeair-ancillaries.md and
 * scoot-ancillaries.md (compiled 2026-11-19). Seat, baggage and upgrade prices are computed
 * by @sia/core rules (priceSgd: null). Scoot publishes no prices: every Scoot price here is
 * illustrative (decision D11) and the UI must say so.
 */

const SQ_ADDONS = 'https://www.singaporeair.com/en_UK/au/plan-travel/local-promotions/australia/add-ons/';
const SQ_SEATS = 'https://milelion.com/2025/12/22/guide-singapore-airlines-seat-selection-fees/';
const SQ_BAGGAGE = 'https://www.singaporeair.com/en_UK/hk/travel-info/baggage/additional-baggage-charges/';
const SQ_WIFI = 'https://singaporeair.com/en_UK/nz/faq/onboard-experience/wi-fi';
const SQ_UPGRADES = 'https://www.singaporeair.com/en_UK/at/plan-travel/yourbooking/cabin-upgrades/';
const SQ_LOUNGE = 'https://www.singaporeair.com/flying-withus/before-the-flight/lounges/silverkris/';
const TR_ADDONS = 'https://www.flyscoot.com/en/manage/add-to-your-trip/all-travel-add-ons';
const TR_SCOOTPLUS = 'https://www.flyscoot.com/en/fly-scoot/onboard/scootbiz';

const SQ: AncillaryProduct[] = [
  { code: 'SQ_SEAT_STD', entity: 'SQ', category: 'seat', name: 'Standard seat', description: 'Choose your seat in advance.', timing: 'post_booking', cabins: ['economy', 'premium_economy'], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Likely', sourceUrl: SQ_SEATS },
  { code: 'SQ_SEAT_FWD', entity: 'SQ', category: 'seat', name: 'Forward Zone seat', description: 'Seats near the front of the cabin, so you can get off sooner.', timing: 'post_booking', cabins: ['economy'], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Likely', sourceUrl: SQ_SEATS },
  { code: 'SQ_SEAT_XLEG', entity: 'SQ', category: 'seat', name: 'Extra Legroom seat', description: 'Exit-row seat with more legroom. Always paid.', timing: 'post_booking', cabins: ['economy', 'premium_economy'], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Likely', sourceUrl: SQ_SEATS },
  { code: 'SQ_SEAT_PY_SOLO', entity: 'SQ', category: 'seat', name: 'Solo seat', description: 'Single Premium Economy seat (A350-900ULR only).', timing: 'post_booking', cabins: ['premium_economy'], aircraft: ['A350'], priceSgd: null, priceBasis: 'computed', confidence: 'Likely', sourceUrl: SQ_SEATS },
  { code: 'SQ_BAG_KG', entity: 'SQ', category: 'baggage', name: 'Additional baggage', description: 'Pre-purchase extra kg. 25% off when bought 48h or more before departure, more for KrisFlyer elite members.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Certain', sourceUrl: SQ_BAGGAGE },
  { code: 'SQ_BOOK_THE_COOK', entity: 'SQ', category: 'meal', name: 'Book the Cook', description: 'Pre-order your main course up to 24 hours before departure.', timing: 'post_booking', cabins: ['premium_economy', 'business'], aircraft: [], minDurationMin: 90, priceSgd: 0, priceBasis: 'free', confidence: 'Certain', sourceUrl: SQ_ADDONS },
  { code: 'SQ_SPECIAL_MEAL', entity: 'SQ', category: 'meal', name: 'Special meal', description: 'Vegetarian, religious, medical or child meals at no extra charge.', timing: 'post_booking', cabins: ['economy'], aircraft: [], priceSgd: 0, priceBasis: 'free', confidence: 'Certain', sourceUrl: SQ_ADDONS },
  { code: 'SQ_INSURANCE', entity: 'SQ', category: 'insurance', name: 'Travel insurance', description: 'Cover for trip cancellation, delays and medical emergencies.', timing: 'booking_only', cabins: [], aircraft: [], priceSgd: 38, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: SQ_ADDONS },
  { code: 'SQ_WIFI', entity: 'SQ', category: 'wifi', name: 'Onboard Wi-Fi', description: 'Free unlimited Wi-Fi on 1 device for KrisFlyer members; unlimited for Business and PPS Club.', timing: 'onboard', cabins: [], aircraft: [], requiresKrisflyer: true, priceSgd: 0, priceBasis: 'free', infoOnly: true, confidence: 'Certain', sourceUrl: SQ_WIFI },
  { code: 'SQ_MYSQUPGRADE', entity: 'SQ', category: 'upgrade', name: 'mySQupgrade', description: 'Instant cash upgrade to the next cabin, confirmed immediately.', timing: 'post_booking', cabins: ['economy', 'premium_economy'], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Likely', sourceUrl: SQ_UPGRADES },
  { code: 'SQ_MILES_UPGRADE', entity: 'SQ', category: 'upgrade', name: 'Upgrade with KrisFlyer miles', description: 'Redeem miles plus a cash co-pay to upgrade your ticket.', timing: 'post_booking', cabins: ['economy', 'premium_economy'], aircraft: [], requiresKrisflyer: true, priceSgd: null, priceBasis: 'computed', confidence: 'Likely', sourceUrl: SQ_UPGRADES },
  { code: 'SQ_KRISSHOP', entity: 'SQ', category: 'retail', name: 'KrisShop pre-order', description: 'Duty-free shopping delivered on board or collected before departure.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 0, priceBasis: 'free', infoOnly: true, confidence: 'Likely', sourceUrl: SQ_ADDONS },
  { code: 'SQ_LOUNGE_INFO', entity: 'SQ', category: 'retail', name: 'SilverKris Lounge', description: 'Check your lounge eligibility (depends on cabin and status).', timing: 'onboard', cabins: [], aircraft: [], priceSgd: 0, priceBasis: 'free', infoOnly: true, confidence: 'Guessing', sourceUrl: SQ_LOUNGE },
];

const TR: AncillaryProduct[] = [
  { code: 'TR_BUNDLE', entity: 'TR', category: 'bundle', name: 'Fare Bundle', description: 'Checked baggage, a seat and flexibility in one package. Only while booking.', timing: 'booking_only', cabins: ['economy'], aircraft: [], priceSgd: 65, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_FLEX', entity: 'TR', category: 'flex', name: 'Flexible Ticket', description: 'Unlimited flight changes or a refundable fare. Only while booking.', timing: 'booking_only', cabins: [], aircraft: [], priceSgd: 45, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_CANCEL', entity: 'TR', category: 'flex', name: 'Cancel Your Trip', description: 'Cancel for a refund. Add while booking or within 24 hours after.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 25, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_BAG', entity: 'TR', category: 'baggage', name: 'Checked baggage', description: 'Pre-purchase checked baggage; cheaper than at the airport.', timing: 'post_booking', cabins: ['economy'], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_SEAT', entity: 'TR', category: 'seat', name: 'Seat selection', description: 'Choose your own seat.', timing: 'post_booking', cabins: ['economy'], aircraft: [], priceSgd: null, priceBasis: 'computed', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_MEAL', entity: 'TR', category: 'meal', name: 'Scoot Café meal', description: 'Pre-order a hot meal or light bites.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 15, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_SCOOTSURANCE', entity: 'TR', category: 'insurance', name: 'Scootsurance', description: 'Travel insurance for trip disruptions.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 22, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_BOARDMEFIRST', entity: 'TR', category: 'priority', name: 'BoardMeFirst', description: 'Early check-in and priority boarding.', timing: 'post_booking', cabins: ['economy'], aircraft: [], priceSgd: 15, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_SCOOTPLUS', entity: 'TR', category: 'upgrade', name: 'ScootPlus upgrade', description: '38" pitch, 30kg checked baggage, priority and 200MB Wi-Fi. Upgrade now or place a bid.', timing: 'post_booking', cabins: ['economy'], aircraft: ['787'], priceSgd: null, priceBasis: 'computed', confidence: 'Certain', sourceUrl: TR_SCOOTPLUS },
  { code: 'TR_WIFI', entity: 'TR', category: 'wifi', name: 'Wi-Fi plan', description: 'Onboard Wi-Fi (Boeing 787 only).', timing: 'onboard', cabins: ['economy'], aircraft: ['787'], priceSgd: 14, priceBasis: 'illustrative', confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_KRISSHOP', entity: 'TR', category: 'retail', name: 'KrisShop', description: 'Duty-free shopping, collected before departure.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 0, priceBasis: 'free', infoOnly: true, confidence: 'Certain', sourceUrl: TR_ADDONS },
  { code: 'TR_SNOOZE_KIT', entity: 'TR', category: 'retail', name: 'Snooze Kit', description: 'Comfort kit for the flight.', timing: 'post_booking', cabins: [], aircraft: [], priceSgd: 18, priceBasis: 'illustrative', confidence: 'Guessing', sourceUrl: TR_ADDONS },
];

export const ANCILLARIES: Record<WebEntity, AncillaryProduct[]> = { SQ, TR };

export const ancillary = (code: string) => [...SQ, ...TR].find((p) => p.code === code);
