import type * as BrazeSdk from '@braze/web-sdk';
import type { SdkActivity } from '@sia/core';
import { useBooking, useBraze, useBrazeProfile, useExternalId, useSdkActivity, useSia } from '@sia/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/**
 * "Braze debug" overlay (docs/BUILD_PLAN.md §5). Toggle with ?debug=true (remembered) or
 * Shift+D. Neutral styling so it reads as a presenter tool on both brands.
 *
 *  Identity   CEID, device, anonymous/identified, aliases from the live profile
 *  Events     every SDK call and server (REST) write, with payloads
 *  Profile    live Braze profile; refreshes itself after activity and flashes what changed
 *  Messaging  Content Cards, Banners and in-app messages this browser received
 *  Presenter  reset Zara, change KrisFlyer tier, complete trip, reset this browser
 */
type Tab = 'identity' | 'events' | 'profile' | 'messaging' | 'presenter';
const TABS: Tab[] = ['identity', 'events', 'profile', 'messaging', 'presenter'];

const KIND_LABEL: Partial<Record<SdkActivity['kind'], string>> = { rest: 'REST', message: 'MSG' };

const STATUS_STYLE: Record<SdkActivity['status'], string> = {
  sent: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-amber-500/15 text-amber-300',
  failed: 'bg-rose-500/15 text-rose-300',
};

function useDebugToggle(): [boolean, (v: boolean) => void] {
  const { storage } = useSia();
  const [open, setOpen] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('debug');
    if (q === 'true') storage.set('debug', true);
    if (q === 'false') storage.set('debug', false);
    return storage.get<boolean>('debug') ?? false;
  });
  const set = (v: boolean) => {
    storage.set('debug', v);
    setOpen(v);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.shiftKey && e.key.toLowerCase() === 'd') set(!open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return [open, set];
}

export function BrazeDebug() {
  const [open, setOpen] = useDebugToggle();
  const { storage } = useSia();
  const [tab, setTabState] = useState<Tab>(() => storage.get<Tab>('debug_tab') ?? 'events');
  const setTab = (t: Tab) => {
    storage.set('debug_tab', t);
    setTabState(t);
  };
  if (!open) return null;
  return (
    <aside
      aria-label="Braze debug"
      className="fixed inset-x-2 bottom-2 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 font-mono text-[13px] text-slate-200 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:w-[500px]"
    >
      <header className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <span className="font-sans text-sm font-semibold text-white">Braze</span>
        <nav className="flex flex-wrap gap-0.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 capitalize ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <button onClick={() => setOpen(false)} className="ml-auto rounded px-2 py-1 text-slate-400 hover:text-white" aria-label="Close Braze debug">
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'identity' && <IdentityTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'profile' && <ProfileTab />}
        {tab === 'messaging' && <MessagingTab />}
        {tab === 'presenter' && <PresenterTab />}
      </div>
    </aside>
  );
}

function Row({ k, v, flash }: { k: string; v: React.ReactNode; flash?: boolean }) {
  return (
    <div className={`grid grid-cols-[150px_1fr] gap-2 rounded px-1 py-1 transition-colors duration-700 ${flash ? 'bg-amber-400/25' : ''}`}>
      <dt className="text-slate-400">{k}</dt>
      <dd className="break-all text-slate-100">{v ?? <span className="text-slate-500">—</span>}</dd>
    </div>
  );
}

const show = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

// ---------------------------------------------------------------- identity

function IdentityTab() {
  const { entity, ready } = useSia();
  const braze = useBraze();
  const externalId = useExternalId();
  const profile = useBrazeProfile(externalId);
  const aliases = (profile.data?.user?.user_aliases as { alias_name: string; alias_label: string }[] | undefined) ?? [];
  const registered = (profile.data?.user?.custom_attributes as { sia_registered_entities?: string[] } | undefined)?.sia_registered_entities;
  return (
    <dl>
      <Row k="Site entity" v={entity} />
      <Row k="SDK" v={ready ? (braze.raw ? 'initialised' : 'failed') : 'starting…'} />
      <Row k="User state" v={externalId ? 'identified' : 'anonymous'} />
      <Row k="External ID (CEID)" v={externalId} />
      <Row k="Device ID" v={braze.deviceId} />
      <Row k="Registered with" v={registered?.join(', ')} />
      {aliases.map((a) => (
        <Row key={a.alias_label + a.alias_name} k={`alias: ${a.alias_label}`} v={a.alias_name} />
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- events

function EventsTab() {
  const activity = useSdkActivity();
  const [selected, setSelected] = useState<number | null>(null);
  if (!activity.length) return <p className="text-slate-400">No SDK activity yet.</p>;
  return (
    <ol className="space-y-1">
      {[...activity].reverse().map((a) => (
        <li key={a.id} className="rounded border border-slate-800">
          <button className="flex w-full items-center gap-2 px-2 py-1 text-left" onClick={() => setSelected(selected === a.id ? null : a.id)}>
            <span className="text-slate-500">{new Date(a.ts).toLocaleTimeString()}</span>
            <span className={a.kind === 'rest' ? 'text-sky-300' : a.kind === 'message' ? 'text-fuchsia-300' : 'text-slate-400'}>{KIND_LABEL[a.kind] ?? a.kind}</span>
            <span className="truncate text-white">{a.name}</span>
            <span className={`ml-auto rounded px-1.5 text-[11px] ${STATUS_STYLE[a.status]}`}>{a.status}</span>
          </button>
          {selected === a.id && (
            <pre className="overflow-x-auto border-t border-slate-800 px-2 py-1 text-[12px] text-slate-300">
              {a.detail ? `${a.detail}\n\n` : ''}
              {JSON.stringify(a.payload ?? null, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- profile

/** Changed keys between two snapshots (for the highlight flash). */
function diffKeys(prev: Record<string, unknown> | null, next: Record<string, unknown>): Set<string> {
  if (!prev) return new Set();
  return new Set(Object.keys(next).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k])));
}

function ProfileTab() {
  const braze = useBraze();
  const externalId = useExternalId();
  const profile = useBrazeProfile(externalId);
  const activity = useSdkActivity();
  const [auto, setAuto] = useState(true);
  const [raw, setRaw] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const prev = useRef<Record<string, unknown> | null>(null);

  const user = profile.data?.user as Record<string, unknown> | undefined;
  const attrs = (user?.custom_attributes ?? {}) as Record<string, unknown>;
  const events = (user?.custom_events ?? []) as { name: string; count: number; last: string }[];
  const snapshot = { ...attrs, ...Object.fromEntries(events.map((e) => [`event:${e.name}`, e.count])), first_name: user?.first_name, email: user?.email };

  // Flash rows that changed since the previous snapshot.
  const key = JSON.stringify(snapshot);
  useEffect(() => {
    if (!user) return;
    const changed = diffKeys(prev.current, snapshot);
    prev.current = snapshot;
    if (changed.size) {
      setFlash(changed);
      const t = setTimeout(() => setFlash(new Set()), 3500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-refresh: a few seconds after new SDK/REST activity, flush and re-read the profile.
  const lastActivity = activity.at(-1)?.id ?? 0;
  useEffect(() => {
    if (!auto || !externalId || !lastActivity) return;
    const t = setTimeout(async () => {
      await braze.flush();
      setTimeout(() => void profile.refetch(), 2500);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastActivity, auto, externalId]);

  if (!externalId) return <p className="text-slate-400">Anonymous user. The live profile appears after sign-in.</p>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <button
          onClick={async () => {
            await braze.flush();
            setTimeout(() => void profile.refetch(), 2500);
          }}
          className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600"
        >
          Refresh
        </button>
        <label className="flex items-center gap-1 text-slate-400">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} /> raw
        </label>
        <span className="ml-auto text-slate-500">{profile.isFetching ? 'Loading…' : profile.dataUpdatedAt ? new Date(profile.dataUpdatedAt).toLocaleTimeString() : ''}</span>
      </div>
      {profile.error && <p className="text-rose-300">{String(profile.error.message)}</p>}
      {profile.data && !profile.data.found && <p className="text-slate-400">No Braze profile yet for this CEID (data may still be processing).</p>}
      {user &&
        (raw ? (
          <pre className="overflow-x-auto text-[12px] text-slate-300">{JSON.stringify(user, null, 2)}</pre>
        ) : (
          <>
            <dl>
              <Row k="first_name" v={show(user.first_name)} flash={flash.has('first_name')} />
              <Row k="email" v={show(user.email)} flash={flash.has('email')} />
              {Object.keys(attrs)
                .sort()
                .map((k) => (
                  <Row key={k} k={k} v={k === 'sia_consent' ? <ConsentMini items={attrs[k]} /> : show(attrs[k])} flash={flash.has(k)} />
                ))}
            </dl>
            <p className="mt-3 text-slate-400">Custom events</p>
            <dl>
              {events.map((e) => (
                <Row key={e.name} k={e.name} v={`${e.count} · last ${new Date(e.last).toLocaleString()}`} flash={flash.has(`event:${e.name}`)} />
              ))}
            </dl>
          </>
        ))}
    </div>
  );
}

function ConsentMini({ items }: { items: unknown }) {
  if (!Array.isArray(items)) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {(items as { id: string; status: string }[]).map((i) => (
        <span key={i.id} className={`rounded px-1 text-[11px] ${i.status === 'opted_in' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-400 line-through'}`}>
          {i.id}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- messaging

function MessagingTab() {
  const { braze, ready } = useSia();
  const activity = useSdkActivity();
  const [cards, setCards] = useState<BrazeSdk.Card[]>([]);
  const [banners, setBanners] = useState<Record<string, BrazeSdk.Banner | null>>({});

  useEffect(() => {
    const sdk = braze.raw;
    if (!ready || !sdk) return;
    setCards(sdk.getCachedContentCards()?.cards ?? []);
    setBanners(sdk.getAllBanners() ?? {});
    const a = sdk.subscribeToContentCardsUpdates((cc) => setCards(cc.cards));
    const b = sdk.subscribeToBannersUpdates((all) => setBanners({ ...all }));
    return () => {
      if (a) sdk.removeSubscription(a);
      if (b) sdk.removeSubscription(b);
    };
  }, [braze, ready]);

  const iams = activity.filter((x) => x.kind === 'message');
  const refresh = () => {
    braze.raw?.requestContentCardsRefresh();
    braze.raw?.requestBannersRefresh(Object.keys(banners).length ? Object.keys(banners) : ['sq_home_hero', 'tr_home_hero']);
  };
  return (
    <div className="space-y-4">
      <button onClick={refresh} className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600">
        Refresh cards and banners
      </button>
      <section>
        <p className="text-slate-400">Content Cards ({cards.length})</p>
        {cards.length === 0 && <p className="text-slate-500">None for this user.</p>}
        <ul className="space-y-1">
          {cards.map((c) => {
            const x = c as unknown as { id?: string; title?: string; extras?: Record<string, string>; pinned?: boolean };
            return (
              <li key={x.id} className="rounded border border-slate-800 px-2 py-1">
                <span className="text-white">{x.title || '(no title)'}</span>{' '}
                <span className="text-slate-500">{JSON.stringify(x.extras ?? {})}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <p className="text-slate-400">Banners</p>
        {Object.keys(banners).length === 0 && <p className="text-slate-500">No banner placements returned.</p>}
        {Object.entries(banners).map(([placement, b]) => (
          <Row key={placement} k={placement} v={b ? (b.isControl ? 'control group' : `banner ${b.id}`) : 'none'} />
        ))}
      </section>
      <section>
        <p className="text-slate-400">In-app messages this session ({iams.length})</p>
        {iams.map((m) => (
          <pre key={m.id} className="overflow-x-auto rounded border border-slate-800 px-2 py-1 text-[12px]">
            {new Date(m.ts).toLocaleTimeString()} {JSON.stringify(m.payload)}
          </pre>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- presenter

function PresenterTab() {
  const { braze, storage } = useSia();
  const externalId = useExternalId();
  const resetBooking = useBooking((s) => s.reset);
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => storage.get<string>('presenter_token') ?? '');
  const [tier, setTier] = useState<'Blue' | 'Silver' | 'Gold' | 'PPS'>('Gold');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const admin = async (body: Record<string, unknown>, label: string) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-admin-token': token }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      braze.noteRest(`presenter: ${label}`, res.ok ? 'sent' : 'failed', out);
      setResult(res.ok ? `✓ ${label}` : `✗ ${String(out.error ?? res.status)}`);
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['braze-profile'] }), 3000);
    } catch (e) {
      setResult(`✗ ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const resetBrowser = async () => {
    resetBooking();
    storage.clear();
    storage.set('debug', true);
    if (token) storage.set('presenter_token', token);
    await braze.signOut();
    window.location.assign('/');
  };

  const btn = 'rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600 disabled:opacity-40';
  return (
    <div className="space-y-4">
      <label className="grid gap-1">
        <span className="text-slate-400">Presenter token (DEMO_ADMIN_TOKEN)</span>
        <input
          type="password"
          autoComplete="off"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            storage.set('presenter_token', e.target.value);
          }}
        />
      </label>

      <section className="space-y-2">
        <p className="text-slate-400">Demo persona</p>
        <button className={btn} disabled={busy || !token} onClick={() => void admin({ action: 'seed_zara' }, 'reset Zara to demo start')}>
          Reset Zara (re-seed)
        </button>
      </section>

      <section className="space-y-2">
        <p className="text-slate-400">Signed-in user {externalId ? <code>{externalId}</code> : '(none)'}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded border border-slate-700 bg-slate-800 px-1 py-1" value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
            {(['Blue', 'Silver', 'Gold', 'PPS'] as const).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button className={btn} disabled={busy || !token || !externalId} onClick={() => void admin({ action: 'set_tier', external_id: externalId, tier }, `KrisFlyer tier → ${tier}`)}>
            Set KrisFlyer tier
          </button>
        </div>
        <button className={btn} disabled={busy || !token || !externalId} onClick={() => void admin({ action: 'complete_trip', external_id: externalId }, 'complete next trip')}>
          Complete next trip (sia_trip_completed)
        </button>
      </section>

      <section className="space-y-2">
        <p className="text-slate-400">This browser</p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => void braze.flush()}>
            Flush SDK
          </button>
          <button className={btn} onClick={() => void resetBrowser()}>
            Reset this browser (log out + clear site data)
          </button>
        </div>
      </section>
      {result && <p className={result.startsWith('✓') ? 'text-emerald-300' : 'text-rose-300'}>{result}</p>}
    </div>
  );
}
