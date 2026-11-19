import { bookingTotal, fareFamily } from '@sia/core';
import { useBooking, useSia } from '@sia/react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { cityName, longDate, sgd } from '../lib';
import { useSite } from '../site';

const STEPS = [
  { path: '/booking/flights', label: 'Flights' },
  { path: '/booking/passengers', label: 'Passengers' },
  { path: '/booking/extras', label: 'Extras' },
  { path: '/booking/seats', label: 'Seats' },
  { path: '/booking/payment', label: 'Payment' },
] as const;

/** Wraps every booking step: progress bar, page, and a sticky price summary. */
export function BookingLayout({ children, requires = 'search' }: { children: ReactNode; requires?: 'search' | 'flights' | 'passengers' }) {
  const site = useSite();
  const s = useBooking((x) => x);
  const { pathname } = useLocation();
  const flightsDone = s.outbound && (s.search?.tripType === 'one_way' || s.inbound);

  if (!s.search) return <Navigate to="/" replace />;
  if (requires !== 'search' && !flightsDone) return <Navigate to="/booking/flights" replace />;
  if (requires === 'passengers' && !s.passengers.length) return <Navigate to="/booking/passengers" replace />;

  const current = STEPS.findIndex((x) => x.path === pathname);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Booking progress">
        {STEPS.map((step, i) => (
          <li key={step.path} className={`flex items-center gap-2 ${i === current ? 'font-semibold text-heading' : i < current ? 'text-body' : 'text-muted'}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i <= current ? 'bg-cta text-cta-text' : 'bg-surface-alt text-muted'}`}>{i + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">{children}</div>
        <Summary />
      </div>
      {site.pricesNote && <p className="mt-6 text-xs text-muted">{site.pricesNote}</p>}
    </div>
  );
}

function Summary() {
  const { entity } = useSia();
  const s = useBooking((x) => x);
  if (!s.search) return null;
  const pax = s.passengers.length || s.search.paxCount;
  const rows: [string, number][] = [];
  for (const f of [s.outbound, s.inbound]) {
    if (f) rows.push([`${fareFamily(entity, f.fareFamily)?.name ?? f.fareFamily} × ${pax}`, f.priceSgd * pax]);
  }
  for (const [code, a] of Object.entries(s.ancillaries)) rows.push([code === 'BAGGAGE' ? `Extra baggage ${s.baggageKg}kg` : code.replace(/^(SQ|TR)_/, '').replace(/_/g, ' ').toLowerCase(), a.qty * a.priceSgd]);
  const seatTotal = s.seats.reduce((n, x) => n + x.priceSgd, 0);
  if (s.seats.length) rows.push([`Seats (${s.seats.length})`, seatTotal]);

  return (
    <aside className="h-fit rounded-card border border-border bg-surface p-5 lg:sticky lg:top-24">
      <h2 className="font-display text-xl text-heading">Your trip</h2>
      <p className="mt-2 text-sm">
        {cityName(s.search.from)} → {cityName(s.search.to)}
        {s.search.tripType === 'round_trip' ? ' (return)' : ''}
      </p>
      <p className="text-sm text-muted">
        {longDate(s.search.departDate)}
        {s.search.returnDate ? ` – ${longDate(s.search.returnDate)}` : ''} · {pax} passenger{pax > 1 ? 's' : ''}
      </p>
      {rows.length > 0 && (
        <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="capitalize text-muted">{k}</dt>
              <dd>{v === 0 ? 'Free' : sgd(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
        <span className="font-semibold">Total</span>
        <span className="font-display text-2xl text-heading">{sgd(bookingTotal(s))}</span>
      </div>
    </aside>
  );
}

export function StepActions({ back, next, nextLabel = 'Continue', disabled }: { back?: () => void; next: () => void; nextLabel?: string; disabled?: boolean }) {
  return (
    <div className="mt-8 flex justify-between gap-3">
      {back ? (
        <button type="button" className="btn-secondary" onClick={back}>
          Back
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="btn-primary" onClick={next} disabled={disabled}>
        {nextLabel}
      </button>
    </div>
  );
}
