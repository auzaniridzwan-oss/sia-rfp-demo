import { useState } from 'react';
import { DEMO_ORIGIN, DESTINATIONS } from '@sia/data';
import { brand } from './brand.config';

/**
 * Phase 0 theme check page: proves the brand tokens, fonts and logo render.
 * Replaced by the real shell + home page in Phase 2/3.
 */
export function App() {
  const [logoFailed, setLogoFailed] = useState(false);
  const primary = DESTINATIONS.filter((d) => d.role === 'primary');

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-accent bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {logoFailed ? (
            <span className="font-display text-2xl font-bold text-heading">{brand.name}</span>
          ) : (
            <img
              src={brand.logo.src}
              alt={brand.logo.alt}
              className="h-10 w-auto"
              onError={() => setLogoFailed(true)}
            />
          )}
          <nav className="label hidden gap-6 text-muted sm:flex">
            <span>Book</span>
            <span>Manage</span>
            <span>Preferences</span>
          </nav>
        </div>
      </header>

      <section className="hero bg-heading px-4 pb-24 pt-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="label text-accent">{brand.entity} · Phase 0 theme check</p>
          <h1 className="mt-2 font-display text-4xl">{brand.hero.headline}</h1>
          <p className="mt-2 max-w-xl opacity-90">{brand.hero.subline}</p>
        </div>
      </section>

      <main className="mx-auto -mt-16 max-w-6xl px-4 pb-16">
        <div className="rounded-card bg-surface p-6 shadow-lg">
          <h2 className="font-display text-2xl text-heading">Demo routes</h2>
          <p className="mt-1 text-sm text-muted">
            From {DEMO_ORIGIN.city} ({DEMO_ORIGIN.code}). Validated by the SerpAPI spike in Phase 0.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {primary.map((d) => (
              <li key={d.code} className="rounded-input border border-border bg-surface-alt p-4">
                <span className="label text-muted">{d.country}</span>
                <p className="font-display text-xl text-heading">
                  {d.city} <span className="text-muted">({d.code})</span>
                </p>
                <p className="text-xs text-muted">Status: {d.status}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary">
              Search flights
            </button>
            <button type="button" className="btn-secondary">
              Manage booking
            </button>
            <a className="self-center text-link underline" href="#preferences">
              Communication preferences
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
