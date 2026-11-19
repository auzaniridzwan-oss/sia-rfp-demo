import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DEMO_ORIGIN, DESTINATIONS } from '@sia/data';
import { ceidFromEmail, searchFlights, SDK_ATTRIBUTES, type FlightSearchResponse } from '@sia/core';
import { useBraze, useExternalId, usePageView, useTrack } from '@sia/react';
import { brand } from './brand.config';

/**
 * Phase 1 harness: proves theme, Braze SDK, identity, event catalog, SerpAPI proxy and the
 * debug overlay end to end. Replaced by the real shell + booking flow in Phase 2/3.
 */
export function App() {
  usePageView('home');
  const [logoFailed, setLogoFailed] = useState(false);
  const primary = DESTINATIONS.filter((d) => d.role === 'primary' && d.status === 'validated');

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-accent bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {logoFailed ? (
            <span className="font-display text-2xl font-bold text-heading">{brand.name}</span>
          ) : (
            <img src={brand.logo.src} alt={brand.logo.alt} className="h-10 w-auto" onError={() => setLogoFailed(true)} />
          )}
          <nav className="label hidden gap-6 text-muted sm:flex">
            <span>Book</span>
            <span>Manage</span>
            <span>Preferences</span>
          </nav>
        </div>
      </header>

      <section className="bg-heading px-4 pb-24 pt-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="label text-accent">{brand.entity} · Phase 1 test harness</p>
          <h1 className="mt-2 font-display text-4xl">{brand.hero.headline}</h1>
          <p className="mt-2 max-w-xl opacity-90">{brand.hero.subline}</p>
        </div>
      </section>

      <main className="mx-auto -mt-16 grid max-w-6xl gap-6 px-4 pb-16">
        <IdentityCard />
        <SearchCard destinations={primary.map((d) => ({ code: d.code, city: d.city }))} />
        <p className="text-sm text-muted">
          Open the Braze debug panel with <kbd>Shift</kbd>+<kbd>D</kbd> or <code>?debug=true</code>.
        </p>
      </main>
    </div>
  );
}

function IdentityCard() {
  const braze = useBraze();
  const externalId = useExternalId();
  const [email, setEmail] = useState(`qa+${brand.entity.toLowerCase()}@example.com`);
  const [name, setName] = useState('Test');

  const signIn = async () => {
    const ceid = await ceidFromEmail(email);
    braze.identify(ceid, { email, firstName: name });
  };

  return (
    <section className="rounded-card bg-surface p-6 shadow-lg">
      <h2 className="font-display text-2xl text-heading">Test identity</h2>
      <p className="mt-1 text-sm text-muted">
        Any <code>@example.com</code> address becomes a <code>ceid_test_</code> user. The same email on both sites lands on one Braze profile.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Email</span>
          <input className="rounded-input border border-border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">First name</span>
          <input className="rounded-input border border-border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" onClick={() => void signIn()}>
          Sign in
        </button>
      </div>
      <p className="mt-3 text-sm">
        Current user: <code>{externalId ?? 'anonymous'}</code>
      </p>
    </section>
  );
}

const isoInDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function SearchCard({ destinations }: { destinations: { code: string; city: string }[] }) {
  const braze = useBraze();
  const track = useTrack();
  const [to, setTo] = useState(destinations[0]?.code ?? 'PER');
  const [date, setDate] = useState(isoInDays(21));

  const search = useMutation<FlightSearchResponse>({
    mutationFn: () => searchFlights({ from: DEMO_ORIGIN.code, to, date }),
    onMutate: () => {
      const dest = destinations.find((d) => d.code === to);
      track('sia_searched_flight', {
        origin: DEMO_ORIGIN.city,
        origin_code: DEMO_ORIGIN.code,
        destination: dest?.city ?? to,
        destination_code: to,
        depart_date: new Date(`${date}T00:00:00Z`),
        trip_type: 'one_way',
        cabin_class: 'economy',
        pax_count: 1,
      });
      braze.setAttribute(SDK_ATTRIBUTES.lastSearchOrigin, DEMO_ORIGIN.code);
      braze.setAttribute(SDK_ATTRIBUTES.lastSearchDestination, to);
      braze.setAttribute(SDK_ATTRIBUTES.lastSearchDepart, new Date(`${date}T00:00:00Z`));
    },
  });

  return (
    <section className="rounded-card bg-surface p-6 shadow-lg">
      <h2 className="font-display text-2xl text-heading">Flight search (SerpAPI proxy)</h2>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">To</span>
          <select className="rounded-input border border-border px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)}>
            {destinations.map((d) => (
              <option key={d.code} value={d.code}>
                {d.city} ({d.code})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Depart</span>
          <input type="date" className="rounded-input border border-border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={search.isPending} onClick={() => search.mutate()}>
          {search.isPending ? 'Searching…' : 'Search flights'}
        </button>
      </div>
      {search.error && <p className="mt-3 text-error">{search.error.message}</p>}
      {search.data && (
        <div className="mt-4">
          <p className="text-sm text-muted">
            {search.data.itineraries.length} {brand.name} itineraries · source: <strong>{search.data.source}</strong>
            {search.data.note ? ` · ${search.data.note}` : ''}
          </p>
          <ul className="mt-2 divide-y divide-border rounded-input border border-border">
            {search.data.itineraries.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <span className="font-semibold text-heading">{it.legs.map((l) => l.flightNumber).join(' + ')}</span>
                <span>
                  {it.legs[0]!.from.time.slice(11)} → {it.legs[it.legs.length - 1]!.to.time.slice(11)}
                </span>
                <span className="text-muted">{it.stops === 0 ? 'Nonstop' : `${it.stops} stop`}</span>
                <span className="text-muted">{it.legs[0]!.aircraft}</span>
                <span className="ml-auto font-semibold">{it.basePriceSgd ? `SGD ${it.basePriceSgd}` : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
