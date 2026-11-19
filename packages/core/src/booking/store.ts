import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import type { WebEntity } from '../entity';
import type { BookingSearch, Passenger, SeatSelection, SelectedFlight } from './types';

export type BookingStep = 'search' | 'results' | 'passenger' | 'ancillaries' | 'seats' | 'payment' | 'confirmation';

export interface BookingState {
  search: BookingSearch | null;
  outbound: SelectedFlight | null;
  inbound: SelectedFlight | null;
  passengers: Passenger[];
  /** product code → quantity (baggage stores kg in `baggageKg` instead). */
  ancillaries: Record<string, { qty: number; priceSgd: number }>;
  baggageKg: number;
  seats: SeatSelection[];
  pnr: string | null;
  step: BookingStep;
}

export interface BookingActions {
  setSearch(search: BookingSearch): void;
  selectFlight(flight: SelectedFlight): void;
  setPassengers(p: Passenger[]): void;
  setAncillary(code: string, qty: number, priceSgd: number): void;
  setBaggage(kg: number, priceSgd: number): void;
  setSeat(seat: SeatSelection): void;
  goTo(step: BookingStep): void;
  confirm(pnr: string): void;
  reset(): void;
}

const initial: BookingState = {
  search: null,
  outbound: null,
  inbound: null,
  passengers: [],
  ancillaries: {},
  baggageKg: 0,
  seats: [],
  pnr: null,
  step: 'search',
};

/**
 * Booking flow state, persisted to sessionStorage per entity so a refresh mid-booking
 * keeps the user's place (and the SQ and Scoot flows never share state).
 */
export function createBookingStore(entity: WebEntity) {
  return createStore<BookingState & BookingActions>()(
    persist(
      (set) => ({
        ...initial,
        setSearch: (search) => set({ ...initial, search, step: 'results' }),
        selectFlight: (flight) =>
          set(flight.direction === 'outbound' ? { outbound: flight, inbound: null, seats: [] } : { inbound: flight }),
        setPassengers: (passengers) => set({ passengers }),
        setAncillary: (code, qty, priceSgd) =>
          set((s) => {
            const next = { ...s.ancillaries };
            if (qty <= 0) delete next[code];
            else next[code] = { qty, priceSgd };
            return { ancillaries: next };
          }),
        setBaggage: (kg, priceSgd) =>
          set((s) => {
            const next = { ...s.ancillaries };
            if (kg <= 0) delete next.BAGGAGE;
            else next.BAGGAGE = { qty: 1, priceSgd };
            return { baggageKg: kg, ancillaries: next };
          }),
        setSeat: (seat) =>
          set((s) => ({
            seats: [
              ...s.seats.filter((x) => !(x.passengerIndex === seat.passengerIndex && x.direction === seat.direction)),
              seat,
            ],
          })),
        goTo: (step) => set({ step }),
        confirm: (pnr) => set({ pnr, step: 'confirmation' }),
        reset: () => set(initial),
      }),
      {
        name: `sia_${entity.toLowerCase()}_booking`,
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
      },
    ),
  );
}

export type BookingStore = ReturnType<typeof createBookingStore>;

/** Fare + ancillaries + seats, SGD, all passengers. */
export function bookingTotal(s: BookingState): number {
  const pax = Math.max(1, s.passengers.length || s.search?.paxCount || 1);
  const fares = ((s.outbound?.priceSgd ?? 0) + (s.inbound?.priceSgd ?? 0)) * pax;
  const extras = Object.values(s.ancillaries).reduce((sum, a) => sum + a.qty * a.priceSgd, 0);
  const seats = s.seats.reduce((sum, x) => sum + x.priceSgd, 0);
  return fares + extras + seats;
}
