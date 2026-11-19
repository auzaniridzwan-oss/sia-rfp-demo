import { CONSENT_TOPICS, consentItem, ENTITY_LABEL, type ConsentItem } from '@sia/core';
import { useBraze, useBrazeProfile, useExternalId, usePageView, useSia } from '@sia/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

const FREQUENCIES: ConsentItem['frequency'][] = ['as_needed', 'daily', 'weekly', 'monthly'];
const FREQ_LABEL: Record<ConsentItem['frequency'], string> = { as_needed: 'As needed', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const ENTITY_ORDER = (own: string) => (['SQ', 'TR', 'KRISPLUS'] as const).slice().sort((a, b) => (a === own ? -1 : b === own ? 1 : 0));

/**
 * Group Preference Centre (Loop 2, Show 2): one page for Singapore Airlines, Scoot and
 * Kris+, by entity × channel × communication nature, with frequency. Saving sends only the
 * changed items to /api/consent, which `$update`s each one in sia_consent by id and logs
 * sia_consent_updated — no marketer touches the profile.
 */
export function PreferencesPage() {
  usePageView('preferences');
  const { entity } = useSia();
  const braze = useBraze();
  const externalId = useExternalId();
  const profile = useBrazeProfile(externalId);
  const queryClient = useQueryClient();

  const stored = useMemo(() => {
    const raw = (profile.data?.user?.custom_attributes as { sia_consent?: ConsentItem[] } | undefined)?.sia_consent;
    return new Map((Array.isArray(raw) ? raw : []).map((i) => [i.id, i]));
  }, [profile.data]);
  const restricted = Boolean((profile.data?.user?.custom_attributes as { sia_processing_restricted?: boolean } | undefined)?.sia_processing_restricted);

  const [draft, setDraft] = useState<Record<string, ConsentItem>>({});
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-sync from Braze only when sia_consent itself changes (the profile refetches often as
  // events land), and never overwrite a toggle the user has changed but not yet saved.
  const consentKey = JSON.stringify([...stored.values()]);
  const baseline = useRef<Record<string, ConsentItem>>({});
  useEffect(() => {
    const fresh = Object.fromEntries(CONSENT_TOPICS.map((t) => [t.id, stored.get(t.id) ?? consentItem(t, 'opted_out')]));
    const previousBaseline = baseline.current; // read now: the updater below runs later
    setDraft((prev) => {
      const next = { ...fresh };
      for (const t of CONSENT_TOPICS) {
        const p = prev[t.id];
        const b = previousBaseline[t.id];
        if (p && b && (p.status !== b.status || p.frequency !== b.frequency)) next[t.id] = p;
      }
      return next;
    });
    baseline.current = fresh;
    // consentKey captures every relevant change to `stored`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentKey]);

  if (!externalId) return <Navigate to="/login" state={{ from: '/preferences' }} replace />;

  const changed = CONSENT_TOPICS.map((t) => draft[t.id]).filter((d): d is ConsentItem => {
    if (!d) return false;
    const s = stored.get(d.id);
    return !s || s.status !== d.status || s.frequency !== d.frequency;
  });

  const save = async (items: ConsentItem[], restrict?: boolean) => {
    if (!items.length && restrict === undefined) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_id: externalId, items: items.length ? items : [draft[CONSENT_TOPICS[0]!.id]], source_system: 'preference_center', ...(restrict !== undefined ? { restrict_processing: restrict } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { changed?: string[]; events_logged?: number; mode?: string; error?: string; subscription_groups?: string[] | string };
      braze.noteRest('consent (preference centre): sia_consent $update + sia_consent_updated', res.ok ? 'sent' : 'failed', body);
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setStatus({ tone: 'ok', text: `Saved. ${body.events_logged ?? 0} change${body.events_logged === 1 ? '' : 's'} recorded across the SIA Group.` });
      if (Array.isArray(body.subscription_groups) && body.subscription_groups.length) {
        braze.noteRest('v2/subscription/status/set', 'sent', body.subscription_groups);
      }
      // Braze export lags the write by a few seconds: update the cached profile now so the
      // toggles don't flip back, then re-read once Braze has processed it.
      queryClient.setQueryData(['braze-profile', externalId], (old: { user?: { custom_attributes?: Record<string, unknown> } } | undefined) => {
        if (!old?.user) return old;
        const merged = new Map(stored);
        for (const i of items) merged.set(i.id, i);
        const attrs = { ...old.user.custom_attributes, sia_consent: [...merged.values()], ...(restrict !== undefined ? { sia_processing_restricted: restrict } : {}) };
        return { ...old, user: { ...old.user, custom_attributes: attrs } };
      });
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['braze-profile'] }), 15000);
    } catch (e) {
      setStatus({ tone: 'error', text: `Could not save: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const objectToAll = () => {
    const items = CONSENT_TOPICS.filter((t) => !t.service).map((t) => ({ ...draft[t.id]!, status: 'opted_out' as const }));
    setDraft((d) => ({ ...d, ...Object.fromEntries(items.map((i) => [i.id, i])) }));
    void save(items, true);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-4xl text-heading">Communication preferences</h1>
      <p className="mt-2 max-w-2xl text-muted">One place for Singapore Airlines, Scoot and Kris+. Changes apply across the SIA Group straight away.</p>
      {restricted && <p className="mt-4 rounded-input bg-accent-soft px-3 py-2 text-sm">You've asked us to restrict marketing use of your data. Service messages about your trips continue.</p>}
      {profile.isLoading && <p className="mt-6 text-muted">Loading your preferences…</p>}

      <div className="mt-8 space-y-6">
        {ENTITY_ORDER(entity).map((ent) => (
          <section key={ent} className="rounded-card border border-border bg-surface">
            <h2 className="border-b border-border px-6 py-4 font-display text-xl text-heading">{ENTITY_LABEL[ent]}</h2>
            <ul className="divide-y divide-border">
              {CONSENT_TOPICS.filter((t) => t.entity === ent).map((t) => {
                const d = draft[t.id];
                if (!d) return null;
                const on = d.status === 'opted_in';
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                    <div className="min-w-[200px] flex-1">
                      <p className="font-semibold">
                        {t.label} <span className="label ml-1 text-[10px] text-muted">{t.channel}</span>
                      </p>
                      <p className="text-sm text-muted">{t.description}</p>
                    </div>
                    <select
                      aria-label={`${t.label} frequency`}
                      disabled={!on}
                      className="rounded-input border border-border bg-surface px-2 py-1.5 text-sm disabled:opacity-40"
                      value={d.frequency}
                      onChange={(e) => setDraft((x) => ({ ...x, [t.id]: { ...d, frequency: e.target.value as ConsentItem['frequency'] } }))}
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {FREQ_LABEL[f]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${ENTITY_LABEL[ent]} ${t.label}`}
                      onClick={() => setDraft((x) => ({ ...x, [t.id]: { ...d, status: on ? 'opted_out' : 'opted_in' } }))}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-cta' : 'bg-border'}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 mt-8 flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-lg">
        <button className="btn-primary" disabled={busy || changed.length === 0} onClick={() => void save(changed)}>
          {busy ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length > 1 ? 's' : ''}` : 'No changes'}
        </button>
        {status && (
          <span role="status" className={`text-sm ${status.tone === 'ok' ? 'text-success' : 'text-error'}`}>
            {status.text}
          </span>
        )}
        <button className="ml-auto text-sm text-link underline" disabled={busy} onClick={objectToAll}>
          Stop all marketing (right to object)
        </button>
      </div>
    </div>
  );
}
