import { ceidFromEmail } from '@sia/core';
import { usePageView } from '@sia/react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSite } from '../site';
import { lookupProfile, useSignIn } from './identity';

/** Demo login: email only (no passwords in this demo). Unknown emails go to registration. */
export function LoginPage() {
  usePageView('login');
  const site = useSite();
  const signIn = useSignIn();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const found = await lookupProfile(await ceidFromEmail(email));
    if (found.exists === false) {
      navigate('/register', { state: { email, from, notFound: true } });
      return;
    }
    await signIn({ email, source: 'login' });
    navigate(from, { replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="font-display text-4xl text-heading">Log in</h1>
      <p className="mt-2 text-muted">Use your {site.loyaltyName} account — one login for Singapore Airlines, Scoot and Kris+.</p>
      <form onSubmit={(e) => void submit(e)} className="mt-8 grid gap-4 rounded-card border border-border bg-surface p-6">
        <label className="grid gap-1 text-sm">
          <span className="label text-muted">Email</span>
          <input required type="email" autoComplete="email" className="rounded-input border border-border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <p className="text-xs text-muted">Demo only: no password needed. Use an @example.com address for test users.</p>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
      <p className="mt-6 text-sm">
        New here?{' '}
        <Link to="/register" state={{ from }} className="text-link underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
