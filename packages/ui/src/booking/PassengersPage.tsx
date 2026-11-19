import type { Passenger } from '@sia/core';
import { useBooking, usePageView, useTrackOnMount } from '@sia/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../lib';
import { BookingLayout } from './BookingLayout';

export function PassengersPage() {
  usePageView('passengers');
  const navigate = useNavigate();
  const account = useAccount();
  const search = useBooking((s) => s.search);
  const saved = useBooking((s) => s.passengers);
  const setPassengers = useBooking((s) => s.setPassengers);
  const count = search?.paxCount ?? 1;
  const [pax, setPax] = useState<Passenger[]>(() =>
    Array.from({ length: count }, (_, i) => saved[i] ?? { title: 'Ms', firstName: i === 0 ? (account.firstName ?? '') : '', lastName: '', type: 'adult' }),
  );

  useTrackOnMount('sia_booking_step_viewed', search ? { step: 'passenger', destination_code: search.to } : null);

  const update = (i: number, patch: Partial<Passenger>) => setPax((p) => p.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPassengers(pax.map((p) => ({ ...p, firstName: p.firstName.trim(), lastName: p.lastName.trim() })));
    navigate('/booking/extras');
  };
  const field = 'rounded-input border border-border bg-surface px-3 py-2';

  return (
    <BookingLayout requires="flights">
      <h1 className="font-display text-3xl text-heading">Passenger details</h1>
      <p className="mt-1 text-sm text-muted">Enter names exactly as they appear on each passport. Demo only — use made-up names.</p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        {pax.map((p, i) => (
          <fieldset key={i} className="rounded-card border border-border bg-surface p-5">
            <legend className="label px-1 text-muted">Adult {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
              <label className="grid gap-1 text-sm">
                <span className="label text-muted">Title</span>
                <select className={field} value={p.title} onChange={(e) => update(i, { title: e.target.value as Passenger['title'] })}>
                  {(['Ms', 'Mrs', 'Mr', 'Mx'] as const).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="label text-muted">Given name</span>
                <input required className={field} value={p.firstName} onChange={(e) => update(i, { firstName: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="label text-muted">Family name</span>
                <input required className={field} value={p.lastName} onChange={(e) => update(i, { lastName: e.target.value })} />
              </label>
            </div>
          </fieldset>
        ))}
        <div className="flex justify-between">
          <button type="button" className="btn-secondary" onClick={() => navigate('/booking/flights')}>
            Back
          </button>
          <button type="submit" className="btn-primary">
            Continue to extras
          </button>
        </div>
      </form>
    </BookingLayout>
  );
}
