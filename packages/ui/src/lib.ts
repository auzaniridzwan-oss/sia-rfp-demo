import type { BookingSearch, LoyaltyTier, SavedBooking } from '@sia/core';
import { DESTINATIONS, DEMO_ORIGIN } from '@sia/data';
import { useBrazeProfile, useExternalId, useSia } from '@sia/react';
import { useCallback, useEffect, useState } from 'react';

export const sgd = (n: number) => `SGD ${n.toLocaleString('en-SG', { maximumFractionDigits: 0 })}`;

/** "2026-12-10 09:15" → "09:15" */
export const hhmm = (t: string) => t.slice(11, 16);

export const duration = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;

export const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const isoInDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export const utcDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

const CITY: Record<string, string> = Object.fromEntries([[DEMO_ORIGIN.code, DEMO_ORIGIN.city], ...DESTINATIONS.map((d) => [d.code, d.city])]);
export const cityName = (code: string) => CITY[code] ?? code;

export const demoDestinations = () => DESTINATIONS.filter((d) => d.role === 'primary' && d.status === 'validated');

/** Hours from now until the outbound departure (for baggage discount timing). */
export const hoursUntil = (search: BookingSearch) => (Date.parse(`${search.departDate}T00:00:00Z`) - Date.now()) / 3_600_000;

/**
 * KrisFlyer status read live from the Braze profile (sia_loyalty.tier, krisflyer_number).
 * This is what lets a Braze-side attribute change re-price seats and baggage on the site.
 */
export function useLoyalty(): { tier: LoyaltyTier | null; krisflyerNumber: string | null; hasKrisflyer: boolean } {
  const externalId = useExternalId();
  const { data } = useBrazeProfile(externalId);
  const attrs = (data?.user?.custom_attributes ?? {}) as { sia_loyalty?: { tier?: string }; krisflyer_number?: string };
  const tier = (['Blue', 'Silver', 'Gold', 'PPS'] as const).find((t) => t === attrs.sia_loyalty?.tier) ?? null;
  const krisflyerNumber = attrs.krisflyer_number ?? null;
  return { tier, krisflyerNumber, hasKrisflyer: Boolean(krisflyerNumber || tier) };
}

/** Demo account info kept in the browser (display name only). */
export function useAccount() {
  const { storage, braze } = useSia();
  const externalId = useExternalId();
  const [firstName, setFirstName] = useState<string | null>(() => storage.get<string>('first_name'));
  useEffect(() => {
    if (!externalId) setFirstName(null);
  }, [externalId]);
  const remember = useCallback(
    (name: string) => {
      storage.set('first_name', name);
      setFirstName(name);
    },
    [storage],
  );
  const signOut = useCallback(async () => {
    storage.remove('first_name');
    setFirstName(null);
    await braze.signOut();
  }, [storage, braze]);
  return { externalId, firstName, remember, signOut };
}

/** Confirmed bookings stored in this browser for Manage Booking. */
export function useSavedBookings() {
  const { storage } = useSia();
  const [bookings, setBookings] = useState<SavedBooking[]>(() => storage.get<SavedBooking[]>('bookings') ?? []);
  const save = useCallback(
    (b: SavedBooking) => {
      const next = [b, ...(storage.get<SavedBooking[]>('bookings') ?? []).filter((x) => x.pnr !== b.pnr)];
      storage.set('bookings', next);
      setBookings(next);
    },
    [storage],
  );
  return { bookings, save };
}
