import { useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router-dom';
import { useSite } from '../site';
import { useAccount } from '../lib';
import { SignInDialog } from './SignInDialog';
import { BrazeDebug } from '../BrazeDebug';

export function Shell() {
  const site = useSite();
  const account = useAccount();
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-accent bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" aria-label={`${site.name} home`}>
            <img src={site.logo.src} alt={site.logo.alt} className="h-10 w-auto" />
          </Link>
          <nav className="label ml-auto hidden items-center gap-6 text-muted md:flex">
            {site.nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'text-heading' : 'hover:text-heading')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            {account.externalId ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden text-heading sm:inline">Hi, {account.firstName ?? 'traveller'}</span>
                <button className="text-link underline" onClick={() => void account.signOut()}>
                  Log out
                </button>
              </div>
            ) : (
              <button className="btn-primary px-4 py-2 text-sm" onClick={() => setSignInOpen(true)}>
                Log in / Sign up
              </button>
            )}
            <button className="md:hidden" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <span className="block h-0.5 w-6 bg-heading" />
              <span className="mt-1.5 block h-0.5 w-6 bg-heading" />
              <span className="mt-1.5 block h-0.5 w-6 bg-heading" />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="label grid gap-3 border-t border-border px-4 py-3 text-muted md:hidden">
            {site.nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMenuOpen(false)}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-heading text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {site.footer.columns.map((c) => (
            <div key={c.title}>
              <p className="label text-accent">{c.title}</p>
              <ul className="mt-3 space-y-2 text-sm opacity-80">
                {c.links.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-white/15 px-4 py-4 text-center text-xs opacity-70">{site.footer.legal}</p>
      </footer>

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} onSignedIn={account.remember} />
      <BrazeDebug />
      <ScrollRestoration />
    </div>
  );
}
