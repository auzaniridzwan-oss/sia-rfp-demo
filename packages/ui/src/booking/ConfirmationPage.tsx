import { fareFamily } from '@sia/core';
import { useExternalId, usePageView, useSia } from '@sia/react';
import { Link, Navigate } from 'react-router-dom';
import { useBooking } from '@sia/react';
import { cityName, hhmm, longDate, sgd, useSavedBookings } from '../lib';

export function ConfirmationPage() {
  usePageView('confirmation');
  const { entity } = useSia();
  const pnr = useBooking((s) => s.pnr);
  const reset = useBooking((s) => s.reset);
  const externalId = useExternalId();
  const { bookings } = useSavedBookings();
  const b = bookings.find((x) => x.pnr === pnr);
  if (!b) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="label text-success">Booking confirmed</p>
      <h1 className="mt-1 font-display text-4xl text-heading">You're going to {cityName(b.search.to)}</h1>
      <p className="mt-3 text-lg">
        Booking reference <strong className="font-display text-2xl tracking-wider text-heading">{b.pnr}</strong>
      </p>
      <div className="mt-8 space-y-3">
        {[b.outbound, b.inbound].filter(Boolean).map((f) => (
          <div key={f!.direction} className="rounded-card border border-border bg-surface p-5">
            <p className="label text-muted">{f!.direction === 'outbound' ? 'Depart' : 'Return'}</p>
            <p className="font-display text-xl text-heading">
              {f!.itinerary.legs[0]!.from.code} {hhmm(f!.itinerary.legs[0]!.from.time)} → {f!.itinerary.legs.at(-1)!.to.code} {hhmm(f!.itinerary.legs.at(-1)!.to.time)}
            </p>
            <p className="text-sm text-muted">
              {longDate(f!.itinerary.legs[0]!.from.time)} · {f!.itinerary.legs.map((l) => l.flightNumber).join(' + ')} · {fareFamily(entity, f!.fareFamily)?.name}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-lg">
        Total paid <strong>{sgd(b.totalSgd)}</strong>
      </p>
      {!externalId && <p className="mt-4 rounded-input bg-accent-soft px-3 py-2 text-sm">Log in to save this trip to your profile and get trip updates.</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/manage" className="btn-primary">
          Manage booking
        </Link>
        <Link to="/" className="btn-secondary" onClick={reset}>
          Book another trip
        </Link>
      </div>
    </div>
  );
}
