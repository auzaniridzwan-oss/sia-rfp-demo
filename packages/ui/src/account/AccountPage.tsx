import { SDK_ATTRIBUTES } from '@sia/core';
import { useBraze, useBrazeProfile, useExternalId, usePageView } from '@sia/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAccount } from '../lib';
import { useSite } from '../site';

const MEALS = ['No preference', 'Vegetarian', 'Vegan', 'Hindu', 'Muslim', 'Kosher', 'Gluten-free', 'Child meal'];
const SEATS = ['No preference', 'Window', 'Aisle'];

/** Profile and travel preferences (SDK attributes). Consent lives on /preferences. */
export function AccountPage() {
  usePageView('account');
  const site = useSite();
  const braze = useBraze();
  const externalId = useExternalId();
  const account = useAccount();
  const profile = useBrazeProfile(externalId);
  const attrs = (profile.data?.user?.custom_attributes ?? {}) as Record<string, unknown>;
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', krisflyer: '', meal: MEALS[0]!, seat: SEATS[0]! });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile.data?.user) return;
    setForm((f) => ({
      ...f,
      firstName: (profile.data!.user!.first_name as string) ?? f.firstName,
      krisflyer: (attrs.krisflyer_number as string) ?? f.krisflyer,
      meal: (attrs.sia_preference_meals as string) ?? f.meal,
      seat: (attrs.sia_preference_seats as string) ?? f.seat,
    }));
    // Populate once when the profile arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  if (!externalId) return <Navigate to="/login" state={{ from: '/account' }} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const user = braze.raw?.getUser();
    if (form.firstName) user?.setFirstName(form.firstName.trim());
    if (form.lastName) user?.setLastName(form.lastName.trim());
    if (form.phone) user?.setPhoneNumber(form.phone.trim());
    braze.noteRest('profile fields (SDK): first/last name, phone', 'sent', { fields: ['first_name', form.lastName && 'last_name', form.phone && 'phone'].filter(Boolean) });
    if (form.krisflyer) braze.setAttribute(SDK_ATTRIBUTES.krisflyerNumber, form.krisflyer.trim());
    braze.setAttribute(SDK_ATTRIBUTES.preferenceMeals, form.meal);
    braze.setAttribute(SDK_ATTRIBUTES.preferenceSeats, form.seat);
    account.remember(form.firstName.trim() || 'traveller');
    void braze.flush();
    setSaved(true);
  };

  const field = 'rounded-input border border-border bg-surface px-3 py-2';
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-4xl text-heading">My account</h1>
      <p className="mt-2 text-sm text-muted">
        Signed in as <code>{externalId}</code>. Communication choices are under <Link to="/preferences" className="text-link underline">Preferences</Link>.
      </p>
      <form onSubmit={submit} className="mt-8 grid gap-6">
        <section className="grid gap-4 rounded-card border border-border bg-surface p-6 sm:grid-cols-2">
          <h2 className="font-display text-xl text-heading sm:col-span-2">Profile</h2>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">First name</span>
            <input className={field} value={form.firstName} onChange={set('firstName')} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Last name</span>
            <input className={field} value={form.lastName} onChange={set('lastName')} placeholder="Unchanged" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Mobile</span>
            <input type="tel" pattern="\+\d{8,15}" className={field} value={form.phone} onChange={set('phone')} placeholder="Unchanged" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">{site.loyaltyName} number</span>
            <input inputMode="numeric" pattern="\d{10}" className={field} value={form.krisflyer} onChange={set('krisflyer')} />
          </label>
        </section>
        <section className="grid gap-4 rounded-card border border-border bg-surface p-6 sm:grid-cols-2">
          <h2 className="font-display text-xl text-heading sm:col-span-2">Travel preferences</h2>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Meal</span>
            <select className={field} value={form.meal} onChange={set('meal')}>
              {MEALS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="label text-muted">Seat</span>
            <select className={field} value={form.seat} onChange={set('seat')}>
              {SEATS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </section>
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary">
            Save
          </button>
          {saved && (
            <span role="status" className="text-sm text-success">
              Saved to your profile.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
