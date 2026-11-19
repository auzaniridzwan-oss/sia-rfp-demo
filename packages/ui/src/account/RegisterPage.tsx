import { CHANNEL_LABEL, CONSENT_TOPICS, consentItem, ENTITY_LABEL, listJoin } from '@sia/core';
import { usePageView, useSia } from '@sia/react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSite } from '../site';
import { useSignIn } from './identity';

/**
 * Registration with consent capture. Only this site's entity is asked directly; other
 * group entities are one explicit opt-in. Marketing is never pre-ticked; service messages
 * (flight status) are.
 */
export function RegisterPage() {
  usePageView('register');
  const site = useSite();
  const { entity } = useSia();
  const signIn = useSignIn();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as { email?: string; from?: string; notFound?: boolean };
  const ownTopics = CONSENT_TOPICS.filter((t) => t.entity === entity);
  const others = (Object.keys(ENTITY_LABEL) as (keyof typeof ENTITY_LABEL)[]).filter((e) => e !== entity);

  const [form, setForm] = useState({ email: state.email ?? '', firstName: '', lastName: '', phone: '', krisflyer: '' });
  const [own, setOwn] = useState<Record<string, boolean>>(() => Object.fromEntries(ownTopics.map((t) => [t.id, t.service])));
  const [group, setGroup] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const consent = CONSENT_TOPICS.map((t) => {
      if (t.entity === entity) return consentItem(t, own[t.id] ? 'opted_in' : 'opted_out');
      // Group opt-in covers other entities' marketing (news / promotions / offers), not their service channels.
      return consentItem(t, group && !t.service && t.channel === 'email' ? 'opted_in' : 'opted_out');
    });
    await signIn({
      email: form.email,
      profile: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), ...(form.phone.trim() ? { phone: form.phone.trim() } : {}) },
      krisflyerNumber: form.krisflyer.trim() || undefined,
      consent,
      source: 'register',
    });
    navigate(state.from ?? '/', { replace: true });
  };

  const field = 'rounded-input border border-border px-3 py-2';
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-display text-4xl text-heading">Create your account</h1>
      {state.notFound && <p className="mt-3 rounded-input bg-accent-soft px-3 py-2 text-sm">We couldn't find an account for that email. Sign up below.</p>}
      <form onSubmit={(e) => void submit(e)} className="mt-8 grid gap-6">
        <section className="grid gap-4 rounded-card border border-border bg-surface p-6 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="label text-muted">Email</span>
            <input required type="email" autoComplete="email" className={field} value={form.email} onChange={set('email')} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">First name</span>
            <input required autoComplete="given-name" className={field} value={form.firstName} onChange={set('firstName')} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Last name</span>
            <input required autoComplete="family-name" className={field} value={form.lastName} onChange={set('lastName')} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Mobile (optional)</span>
            <input type="tel" placeholder="+6591234567" pattern="\+\d{8,15}" title="International format, e.g. +6591234567" className={field} value={form.phone} onChange={set('phone')} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">{site.loyaltyName} number (optional)</span>
            <input inputMode="numeric" pattern="\d{10}" title="10 digits" className={field} value={form.krisflyer} onChange={set('krisflyer')} />
          </label>
        </section>

        <section className="rounded-card border border-border bg-surface p-6">
          <h2 className="font-display text-xl text-heading">What should {site.name} send you?</h2>
          <ul className="mt-4 space-y-3">
            {ownTopics.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-cta-bg)]" checked={own[t.id] ?? false} onChange={(e) => setOwn((o) => ({ ...o, [t.id]: e.target.checked }))} />
                  <span>
                    <span className="block font-semibold">
                      {t.label} <span className="font-normal text-muted">· {CHANNEL_LABEL[t.channel]}</span>
                    </span>
                    <span className="block text-sm text-muted">{t.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-border pt-5">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-cta-bg)]" checked={group} onChange={(e) => setGroup(e.target.checked)} />
            <span>
              <span className="block font-semibold">Also hear from {listJoin(others.map((e) => ENTITY_LABEL[e]))}</span>
              <span className="block text-sm text-muted">News and offers by email from the rest of the SIA Group. Change this any time in Preferences.</span>
            </span>
          </label>
        </section>

        <p className="text-xs text-muted">Demo only — use made-up details and an @example.com email for test users.</p>
        <button type="submit" className="btn-primary justify-self-start" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
