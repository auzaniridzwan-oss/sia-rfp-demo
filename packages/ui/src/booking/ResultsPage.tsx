import { aircraftMatches, FARE_FAMILIES, farePrice, searchFlights, type CabinClass, type FareFamily, type Itinerary } from '@sia/core';
import { useBooking, usePageView, useSia, useTrack } from '@sia/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cityName, duration, hhmm, longDate, utcDate } from '../lib';
import { useSite } from '../site';
import { BookingLayout } from './BookingLayout';

export function ResultsPage() {
  usePageView('flight_results');
  const search = useBooking((s) => s.search);
  const outbound = useBooking((s) => s.outbound);
  const inbound = useBooking((s) => s.inbound);
  const navigate = useNavigate();
  const needInbound = search?.tripType === 'round_trip';
  // Next leg still to choose (null once all legs are picked); "Change" re-opens a leg.
  const next = !outbound ? 'outbound' : needInbound && !inbound ? 'inbound' : null;
  const [editing, setEditing] = useState<'outbound' | 'inbound' | null>(null);
  const showing = editing ?? next;

  return (
    <BookingLayout>
      {search && (
        <>
          {(['outbound', 'inbound'] as const)
            .filter((d) => d === 'outbound' || needInbound)
            .map((d) => {
              const chosen = d === 'outbound' ? outbound : inbound;
              if (showing === d) return <FlightList key={d} direction={d} onPicked={() => setEditing(null)} />;
              if (!chosen) return null;
              return (
                <div key={d} className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4 text-sm">
                  <span className="label text-muted">{d === 'outbound' ? 'Depart' : 'Return'}</span>
                  <span className="font-semibold text-heading">{chosen.itinerary.legs.map((l) => l.flightNumber).join(' + ')}</span>
                  <span>
                    {hhmm(chosen.itinerary.legs[0]!.from.time)} → {hhmm(chosen.itinerary.legs.at(-1)!.to.time)}
                  </span>
                  <button className="ml-auto text-link underline" onClick={() => setEditing(d)}>
                    Change
                  </button>
                </div>
              );
            })}
          {!showing && (
            <div className="mt-6 flex justify-end">
              <button className="btn-primary" onClick={() => navigate('/booking/passengers')}>
                Continue to passengers
              </button>
            </div>
          )}
        </>
      )}
    </BookingLayout>
  );
}

function FlightList({ direction, onPicked }: { direction: 'outbound' | 'inbound'; onPicked: () => void }) {
  const site = useSite();
  const { entity } = useSia();
  const track = useTrack();
  const search = useBooking((s) => s.search)!;
  const selectFlight = useBooking((s) => s.selectFlight);
  const query = direction === 'outbound' ? { from: search.from, to: search.to, date: search.departDate } : { from: search.to, to: search.from, date: search.returnDate! };
  const [cabin, setCabin] = useState<CabinClass>(search.cabin);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['flights', entity, query.from, query.to, query.date],
    queryFn: ({ signal }) => searchFlights(query, signal),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const families = FARE_FAMILIES[entity].filter((f) => f.cabin === cabin);

  const pick = (it: Itinerary, fam: FareFamily, price: number) => {
    selectFlight({ direction, itinerary: it, fareFamily: fam.code, cabin: fam.cabin, priceSgd: price });
    track('sia_selected_flight', {
      direction,
      destination_code: query.to,
      depart_date: utcDate(query.date),
      flight_number: it.legs.map((l) => l.flightNumber).join('+'),
      fare_family: fam.code,
      cabin_class: fam.cabin,
      fare_amount: price,
      currency: 'SGD',
    });
    onPicked();
  };

  return (
    <section>
      <header className="mb-4">
        <p className="label text-muted">{direction === 'outbound' ? 'Select your departing flight' : 'Select your return flight'}</p>
        <h1 className="font-display text-3xl text-heading">
          {cityName(query.from)} to {cityName(query.to)}
        </h1>
        <p className="text-sm text-muted">{longDate(query.date)}</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Cabin class">
        {site.cabins.map((c) => (
          <button
            key={c.value}
            role="tab"
            aria-selected={cabin === c.value}
            onClick={() => setCabin(c.value)}
            className={`rounded-button border px-4 py-2 text-sm font-semibold ${cabin === c.value ? 'border-cta bg-cta text-cta-text' : 'border-border text-body hover:border-heading'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-10 text-center text-muted">Searching live {site.name} flights…</p>}
      {error && (
        <div className="rounded-card border border-border bg-surface p-5 text-sm">
          <p className="text-error">We couldn't load flights just now.</p>
          <button className="btn-secondary mt-3 px-4 py-2 text-sm" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      )}
      {data && (
        <>
          {data.source === 'fixture' && <p className="mb-3 rounded-input bg-accent-soft px-3 py-2 text-xs">{data.note ?? 'Showing offline flight data.'}</p>}
          {data.itineraries.length === 0 && <p className="py-10 text-center text-muted">No {site.name} flights on this date. Try another date.</p>}
          <ul className="space-y-4">
            {data.itineraries
              .filter((it) => it.basePriceSgd)
              .map((it) => {
                const fams = families.filter((f) => !f.aircraft || aircraftMatches(it, f.aircraft));
                return (
                  <li key={it.id} className="overflow-hidden rounded-card border border-border bg-surface">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                      <div>
                        <p className="font-display text-2xl text-heading">
                          {hhmm(it.legs[0]!.from.time)} <span className="text-muted">→</span> {hhmm(it.legs.at(-1)!.to.time)}
                        </p>
                        <p className="text-xs text-muted">
                          {it.legs[0]!.from.code} – {it.legs.at(-1)!.to.code}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p>{duration(it.totalDurationMin)}</p>
                        <p className="text-muted">{it.stops === 0 ? 'Nonstop' : `${it.stops} stop via ${it.layovers.map((l) => l.code).join(', ')}`}</p>
                      </div>
                      <div className="text-sm text-muted">
                        <p>{it.legs.map((l) => l.flightNumber).join(' + ')}</p>
                        <p>{[...new Set(it.legs.map((l) => l.aircraft))].join(', ')}</p>
                      </div>
                    </div>
                    {fams.length ? (
                      <div className="grid border-t border-border sm:grid-flow-col sm:auto-cols-fr">
                        {fams.map((f) => {
                          const price = farePrice(it.basePriceSgd!, f);
                          return (
                            <button
                              key={f.code}
                              onClick={() => pick(it, f, price)}
                              className="group border-t border-border p-4 text-left transition-colors first:border-t-0 hover:bg-surface-alt sm:border-l sm:border-t-0 sm:first:border-l-0"
                            >
                              <span className="mb-2 block h-1 w-10 rounded-full" style={{ background: site.cabinColors?.[f.cabin] ?? 'var(--color-accent)' }} />
                              <span className="block text-sm font-semibold">{f.name}</span>
                              <span className="block font-display text-xl text-heading">SGD {price}</span>
                              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                                {f.features.map((x) => (
                                  <li key={x}>{x}</li>
                                ))}
                              </ul>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="border-t border-border p-4 text-sm text-muted">Not available in this cabin on this aircraft.</p>
                    )}
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </section>
  );
}
