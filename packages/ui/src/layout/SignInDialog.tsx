import * as Dialog from '@radix-ui/react-dialog';
import { ceidFromEmail, SDK_ATTRIBUTES } from '@sia/core';
import { useBraze, useTrack } from '@sia/react';
import { useState, type FormEvent } from 'react';
import { useSite } from '../site';

/**
 * Demo sign-in (Phase 2). Identifies the visitor by CEID so bookings land on a known
 * profile. Phase 4 replaces this with full registration, consent capture and preferences.
 */
export function SignInDialog({
  open,
  onOpenChange,
  onSignedIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSignedIn: (firstName: string) => void;
}) {
  const site = useSite();
  const braze = useBraze();
  const track = useTrack();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [krisflyer, setKrisflyer] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ceid = await ceidFromEmail(email);
    const isNew = braze.externalId !== ceid;
    braze.identify(ceid, { email: email.trim(), firstName: firstName.trim() });
    if (krisflyer.trim()) braze.setAttribute(SDK_ATTRIBUTES.krisflyerNumber, krisflyer.trim());
    if (isNew) track('sia_registration_completed', { has_krisflyer: Boolean(krisflyer.trim()), registration_source: 'header_sign_in' });
    onSignedIn(firstName.trim() || 'traveller');
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-6 shadow-2xl">
          <Dialog.Title className="font-display text-2xl text-heading">Log in or sign up</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            One {site.loyaltyName} identity across Singapore Airlines, Scoot and Kris+.
          </Dialog.Description>
          <form className="mt-5 grid gap-4" onSubmit={(e) => void submit(e)}>
            <label className="grid gap-1 text-sm">
              <span className="label text-muted">Email</span>
              <input required type="email" autoComplete="email" className="rounded-input border border-border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="label text-muted">First name</span>
              <input required autoComplete="given-name" className="rounded-input border border-border px-3 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="label text-muted">{site.loyaltyName} number (optional)</span>
              <input inputMode="numeric" pattern="\d{10}" title="10 digits" className="rounded-input border border-border px-3 py-2" value={krisflyer} onChange={(e) => setKrisflyer(e.target.value)} />
            </label>
            <p className="text-xs text-muted">Demo only. Use an @example.com address for test users.</p>
            <div className="flex justify-end gap-3">
              <Dialog.Close className="btn-secondary px-4 py-2 text-sm">Cancel</Dialog.Close>
              <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={busy}>
                Continue
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
