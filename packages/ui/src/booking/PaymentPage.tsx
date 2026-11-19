import { bookingTotal, generatePnr, SDK_ATTRIBUTES, type SavedBooking } from '@sia/core';
import { useBooking, useBraze, usePageView, useSia, useTrack, useTrackOnMount } from '@sia/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { sgd, useSavedBookings, utcDate } from '../lib';
import { ancillaryCategories, syncBooking } from './api';
import { BookingLayout } from './BookingLayout';

/**
 * Mock payment. Nothing leaves the browser. Only published test card numbers are accepted,
 * so nobody can type a real card into a demo site.
 */
const TEST_CARDS: Record<string, 'approve' | 'decline'> = {
  '4242424242424242': 'approve',
  '5555555555554444': 'approve',
  '4000000000000002': 'decline',
};

export function PaymentPage() {
  usePageView('payment');
  const { entity } = useSia();
  const braze = useBraze();
  const track = useTrack();
  const navigate = useNavigate();
  const s = useBooking((x) => x);
  const { save } = useSavedBookings();
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12/30');
  const [cvc, setCvc] = useState('123');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'declined' | 'invalid'>('idle');
  const total = bookingTotal(s);

  useTrackOnMount('sia_booking_step_viewed', s.search ? { step: 'payment', destination_code: s.search.to } : null);

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    const outcome = TEST_CARDS[card.replace(/\s/g, '')];
    if (!outcome) return setStatus('invalid');
    setStatus('verifying');
    await new Promise((r) => setTimeout(r, 1500)); // simulated 3-D Secure
    if (outcome === 'decline') {
      track('sia_payment_failed', { reason: 'card_declined', fare_amount: total });
      return setStatus('declined');
    }

    const search = s.search!;
    const outbound = s.outbound!;
    const pnr = generatePnr(entity);
    const saved: SavedBooking = {
      pnr,
      entity,
      createdAt: new Date().toISOString(),
      search,
      outbound,
      inbound: s.inbound,
      passengers: s.passengers,
      ancillaries: s.ancillaries,
      baggageKg: s.baggageKg,
      seats: s.seats,
      totalSgd: total,
      checkinStatus: 'not_open',
      externalId: braze.externalId,
    };

    track('sia_booking_confirmed', {
      pnr,
      origin_code: search.from,
      destination_code: search.to,
      cabin_class: outbound.cabin,
      depart_date: utcDate(search.departDate),
      ...(search.returnDate ? { return_date: utcDate(search.returnDate) } : {}),
      fare_paid: total,
      ancillaries_purchased: ancillaryCategories(saved),
    });
    braze.logPurchase(`${entity}_${search.to}_${outbound.fareFamily}`, total, { pnr, cabin_class: outbound.cabin, destination_code: search.to });
    const seatType = s.seats[0]?.seatType;
    if (seatType) braze.setAttribute(SDK_ATTRIBUTES.preferenceSeats, seatType);
    save(saved);
    void syncBooking(braze, saved, 'confirm');
    s.confirm(pnr);
    navigate('/booking/confirmation', { replace: true });
  };

  const field = 'rounded-input border border-border bg-surface px-3 py-2';
  return (
    <BookingLayout requires="passengers">
      <h1 className="font-display text-3xl text-heading">Payment</h1>
      <form onSubmit={(e) => void pay(e)} className="mt-6 max-w-lg rounded-card border border-border bg-surface p-6">
        <p className="mb-4 rounded-input bg-surface-alt px-3 py-2 text-xs">
          Demo checkout — no money moves. Test cards: <code>4242 4242 4242 4242</code> (approved), <code>4000 0000 0000 0002</code> (declined).
        </p>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Card number</span>
          <input className={field} inputMode="numeric" autoComplete="off" value={card} onChange={(e) => setCard(e.target.value)} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Expiry</span>
            <input className={field} autoComplete="off" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">CVC</span>
            <input className={field} autoComplete="off" value={cvc} onChange={(e) => setCvc(e.target.value)} />
          </label>
        </div>
        {status === 'invalid' && <p className="mt-3 text-sm text-error">This demo only accepts the test card numbers above.</p>}
        {status === 'declined' && <p className="mt-3 text-sm text-error">Payment declined by the issuer. Try another card.</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/booking/seats')}>
            Back
          </button>
          <button type="submit" className="btn-primary" disabled={status === 'verifying'}>
            {status === 'verifying' ? 'Verifying with your bank…' : `Pay ${sgd(total)}`}
          </button>
        </div>
      </form>
    </BookingLayout>
  );
}
