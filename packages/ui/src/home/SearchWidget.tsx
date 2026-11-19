import { SDK_ATTRIBUTES, type BookingSearch, type CabinClass } from '@sia/core';
import { DEMO_ORIGIN } from '@sia/data';
import { useBooking, useBraze, useTrack } from '@sia/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cityName, demoDestinations, isoInDays, utcDate } from '../lib';
import { useSite } from '../site';

/** Booking widget overlapping the hero. Origin is fixed to Changi (demo scope). */
export function SearchWidget({ presetDestination }: { presetDestination?: string }) {
  const site = useSite();
  const braze = useBraze();
  const track = useTrack();
  const navigate = useNavigate();
  const setSearch = useBooking((s) => s.setSearch);
  const previous = useBooking((s) => s.search);
  const destinations = demoDestinations();

  const [tripType, setTripType] = useState<BookingSearch['tripType']>(previous?.tripType ?? 'round_trip');
  const [to, setTo] = useState(previous?.to ?? destinations[0]?.code ?? 'PER');
  const [departDate, setDepart] = useState(previous && previous.departDate >= isoInDays(1) ? previous.departDate : isoInDays(21));
  const [returnDate, setReturn] = useState(previous?.returnDate && previous.returnDate > departDate ? previous.returnDate : isoInDays(28));
  const [paxCount, setPax] = useState(previous?.paxCount ?? 1);
  const [cabin, setCabin] = useState<CabinClass>(previous?.cabin ?? site.cabins[0]!.value);

  useEffect(() => {
    if (presetDestination) setTo(presetDestination);
  }, [presetDestination]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const search: BookingSearch = {
      from: DEMO_ORIGIN.code,
      to,
      departDate,
      returnDate: tripType === 'round_trip' ? returnDate : undefined,
      tripType,
      cabin,
      paxCount,
    };
    track('sia_searched_flight', {
      origin: DEMO_ORIGIN.city,
      origin_code: DEMO_ORIGIN.code,
      destination: cityName(to),
      destination_code: to,
      depart_date: utcDate(departDate),
      ...(search.returnDate ? { return_date: utcDate(search.returnDate) } : {}),
      trip_type: tripType,
      cabin_class: cabin,
      pax_count: paxCount,
    });
    braze.setAttribute(SDK_ATTRIBUTES.lastSearchOrigin, DEMO_ORIGIN.code);
    braze.setAttribute(SDK_ATTRIBUTES.lastSearchDestination, to);
    braze.setAttribute(SDK_ATTRIBUTES.lastSearchDepart, utcDate(departDate));
    braze.setAttribute(SDK_ATTRIBUTES.lastSearchReturn, search.returnDate ? utcDate(search.returnDate) : null);
    setSearch(search);
    navigate('/booking/flights');
  };

  const field = 'rounded-input border border-border bg-surface px-3 py-2.5 text-body';
  return (
    <form onSubmit={submit} className="rounded-card bg-surface p-5 shadow-xl sm:p-6" aria-label="Search flights">
      <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Trip type">
        {(['round_trip', 'one_way'] as const).map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="trip" checked={tripType === t} onChange={() => setTripType(t)} className="accent-[var(--color-cta-bg)]" />
            {t === 'round_trip' ? 'Return' : 'One-way'}
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.1fr_1fr_1fr_1fr_0.8fr_1fr_auto]">
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">From</span>
          <input className={`${field} text-muted`} value={`${DEMO_ORIGIN.city} (${DEMO_ORIGIN.code})`} readOnly aria-readonly />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">To</span>
          <select className={field} value={to} onChange={(e) => setTo(e.target.value)}>
            {destinations.map((d) => (
              <option key={d.code} value={d.code}>
                {d.city} ({d.code})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Depart</span>
          <input
            type="date"
            required
            className={field}
            min={isoInDays(1)}
            max={isoInDays(320)}
            value={departDate}
            onChange={(e) => {
              setDepart(e.target.value);
              if (returnDate <= e.target.value) setReturn(new Date(Date.parse(e.target.value) + 7 * 86_400_000).toISOString().slice(0, 10));
            }}
          />
        </label>
        <label className={`grid gap-1 text-sm ${tripType === 'one_way' ? 'opacity-40' : ''}`}>
          <span className="label text-muted">Return</span>
          <input type="date" className={field} disabled={tripType === 'one_way'} min={departDate} max={isoInDays(330)} value={returnDate} onChange={(e) => setReturn(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Passengers</span>
          <select className={field} value={paxCount} onChange={(e) => setPax(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} adult{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Class</span>
          <select className={field} value={cabin} onChange={(e) => setCabin(e.target.value as CabinClass)}>
            {site.cabins.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary self-end sm:col-span-2 lg:col-span-2 xl:col-span-1">
          Search
        </button>
      </div>
    </form>
  );
}
