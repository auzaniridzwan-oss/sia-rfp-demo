import { distanceBand, generateSeatMap, quoteSeat, SEAT_TYPE_LABEL, type Seat, type SeatType } from '@sia/core';
import { useBooking, usePageView, useTrackOnMount, useSia, useTrack } from '@sia/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sgd, useLoyalty } from '../lib';
import { BookingLayout, StepActions } from './BookingLayout';

const TYPE_STYLE: Record<SeatType, string> = {
  standard: 'bg-surface-alt border-border',
  forward_zone: 'bg-[#e5f0ff] border-[#2275d3]',
  extra_legroom: 'bg-[#fff5e5] border-[#ff9f00]',
  solo: 'bg-[#f3e8ff] border-[#6f42c1]',
  scootplus: 'bg-accent-soft border-heading',
};

export function SeatsPage() {
  usePageView('seats');
  const { entity } = useSia();
  const track = useTrack();
  const navigate = useNavigate();
  const loyalty = useLoyalty();
  const s = useBooking((x) => x);
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [paxIndex, setPaxIndex] = useState(0);

  useTrackOnMount('sia_booking_step_viewed', s.search ? { step: 'seats', destination_code: s.search.to } : null);

  const flight = direction === 'outbound' ? s.outbound : s.inbound;
  const map = useMemo(
    () => (flight ? generateSeatMap({ entity, cabin: flight.cabin, aircraft: flight.itinerary.legs[0]!.aircraft, seed: flight.itinerary.id }) : null),
    [entity, flight],
  );
  if (!s.search || !flight || !map) return <BookingLayout requires="passengers">{null}</BookingLayout>;

  const band = distanceBand(s.search.from, s.search.to);
  const quote = (type: SeatType) => quoteSeat({ entity, seatType: type, fareCode: flight.fareFamily, band, tier: loyalty.tier, bundle: Boolean(s.ancillaries.TR_BUNDLE) });
  const taken = new Map(s.seats.filter((x) => x.direction === direction).map((x) => [x.seatNumber, x.passengerIndex]));
  const pax = s.passengers;

  const choose = (seat: Seat) => {
    const q = quote(seat.type);
    s.setSeat({ passengerIndex: paxIndex, direction, seatNumber: seat.id, seatType: seat.type, priceSgd: q.priceSgd, freeByRule: q.freeByRule });
    track('sia_selected_seat', { seat_type: seat.type, seat_number: seat.id, price: q.priceSgd, free_by_rule: q.freeByRule });
    if (paxIndex < pax.length - 1) setPaxIndex(paxIndex + 1);
  };

  return (
    <BookingLayout requires="passengers">
      <h1 className="font-display text-3xl text-heading">Choose your seats</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['outbound', 'inbound'] as const)
          .filter((d) => d === 'outbound' || s.inbound)
          .map((d) => (
            <button key={d} onClick={() => setDirection(d)} className={`rounded-button border px-4 py-2 text-sm ${direction === d ? 'border-cta bg-cta text-cta-text' : 'border-border'}`}>
              {d === 'outbound' ? `${s.search!.from} → ${s.search!.to}` : `${s.search!.to} → ${s.search!.from}`}
            </button>
          ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {pax.map((p, i) => {
          const seat = s.seats.find((x) => x.direction === direction && x.passengerIndex === i);
          return (
            <button key={i} onClick={() => setPaxIndex(i)} className={`rounded-input border px-3 py-1.5 ${paxIndex === i ? 'border-heading font-semibold' : 'border-border'}`}>
              {p.firstName || `Passenger ${i + 1}`}: {seat?.seatNumber ?? '—'}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-4 text-xs">
        {map.legend.map((t) => {
          const q = quote(t);
          return (
            <li key={t} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded border ${TYPE_STYLE[t]}`} />
              {SEAT_TYPE_LABEL[t]} · {q.priceSgd === 0 ? 'Free' : sgd(q.priceSgd)}
              {q.reason && <span className="text-muted">({q.reason})</span>}
            </li>
          );
        })}
        <li className="flex items-center gap-2">
          <span className="grid h-4 w-4 place-items-center text-muted">×</span> Taken
        </li>
      </ul>

      <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface p-4">
        <table className="mx-auto border-separate border-spacing-1 text-xs" aria-label="Seat map">
          <thead>
            <tr>
              <th />
              {map.layout.map((c, i) => (
                <th key={i} className="w-8 text-muted">
                  {c === '|' ? '' : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {map.rows.map((row) => {
              let n = 0;
              return (
                <tr key={row.number}>
                  <th className="pr-2 text-right font-normal text-muted">{row.number}</th>
                  {map.layout.map((c, i) => {
                    if (c === '|') return <td key={i} className="w-4" />;
                    const seat = row.seats[n++]!;
                    const mine = taken.get(seat.id);
                    const disabled = seat.occupied || (mine !== undefined && mine !== paxIndex);
                    return (
                      <td key={i}>
                        <button
                          disabled={disabled}
                          onClick={() => choose(seat)}
                          aria-label={`Seat ${seat.id}, ${SEAT_TYPE_LABEL[seat.type]}${seat.occupied ? ', taken' : ''}`}
                          className={`h-8 w-8 rounded border text-[10px] ${
                            seat.occupied ? 'cursor-not-allowed border-transparent bg-transparent text-muted' : mine !== undefined ? 'border-cta bg-cta font-bold text-cta-text' : `${TYPE_STYLE[seat.type]} hover:ring-2 hover:ring-heading`
                          }`}
                        >
                          {mine !== undefined ? mine + 1 : seat.occupied ? '×' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StepActions back={() => navigate('/booking/extras')} next={() => navigate('/booking/payment')} nextLabel={s.seats.length ? 'Continue to payment' : 'Skip seats'} />
    </BookingLayout>
  );
}
