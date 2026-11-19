import type { WebEntity } from '../entity';
import type { FareFamily } from './types';

/**
 * Fare families per entity. Multipliers are illustrative (applied to the cheapest economy
 * price Google Flights returns). SQ free-seat rules follow singaporeair-ancillaries.md §1:
 * Lite = all seats paid; Value/Standard = Standard seats free; Flexi = Standard + Forward Zone.
 */
export const FARE_FAMILIES: Record<WebEntity, FareFamily[]> = {
  SQ: [
    { code: 'Y_LITE', name: 'Economy Lite', cabin: 'economy', priceMultiplier: 1.0, freeSeats: [], features: ['Seat selection at a fee', 'No changes', '25kg baggage'] },
    { code: 'Y_VALUE', name: 'Economy Value', cabin: 'economy', priceMultiplier: 1.12, freeSeats: ['standard'], features: ['Free Standard seats', 'Changes for a fee', '30kg baggage'] },
    { code: 'Y_STANDARD', name: 'Economy Standard', cabin: 'economy', priceMultiplier: 1.25, freeSeats: ['standard'], features: ['Free Standard seats', 'Lower change fee', '30kg baggage'] },
    { code: 'Y_FLEXI', name: 'Economy Flexi', cabin: 'economy', priceMultiplier: 1.5, freeSeats: ['standard', 'forward_zone'], features: ['Free Standard + Forward Zone seats', 'Free changes', '35kg baggage'] },
    { code: 'W_STANDARD', name: 'Premium Economy Standard', cabin: 'premium_economy', priceMultiplier: 1.9, freeSeats: ['standard'], features: ['Free Standard seats', 'Book the Cook', '35kg baggage'] },
    { code: 'W_FLEXI', name: 'Premium Economy Flexi', cabin: 'premium_economy', priceMultiplier: 2.3, freeSeats: ['standard'], features: ['Free Standard seats', 'Free changes', 'Book the Cook'] },
    { code: 'J_STANDARD', name: 'Business Standard', cabin: 'business', priceMultiplier: 3.6, freeSeats: ['standard', 'forward_zone', 'extra_legroom'], features: ['All seats free', 'SilverKris Lounge*', 'Book the Cook'] },
    { code: 'J_FLEXI', name: 'Business Flexi', cabin: 'business', priceMultiplier: 4.4, freeSeats: ['standard', 'forward_zone', 'extra_legroom'], features: ['All seats free', 'Free changes and refunds', 'Book the Cook'] },
  ],
  TR: [
    { code: 'TR_ECONOMY', name: 'Economy', cabin: 'economy', priceMultiplier: 1.0, freeSeats: [], features: ['Cabin bag only', 'Add-ons a la carte'] },
    { code: 'TR_SCOOTPLUS', name: 'ScootPlus', cabin: 'scootplus', priceMultiplier: 1.8, freeSeats: ['scootplus'], aircraft: ['787'], features: ['38" pitch leather seats', '15kg cabin + 30kg checked bags', 'Priority check-in and boarding', '200MB Wi-Fi'] },
  ],
};

export const fareFamily = (entity: WebEntity, code: string) =>
  FARE_FAMILIES[entity].find((f) => f.code === code);

/** Round to a whole SGD amount (airline-style display). */
export const roundSgd = (n: number) => Math.round(n);

export function farePrice(basePriceSgd: number, family: FareFamily): number {
  return roundSgd(basePriceSgd * family.priceMultiplier);
}
