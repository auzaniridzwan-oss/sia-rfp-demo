import type { SdkActivity } from '@sia/core';
import { useBraze, useBrazeProfile, useExternalId, useSdkActivity, useSia } from '@sia/react';
import { useEffect, useState } from 'react';

/**
 * "Braze debug" overlay (docs/BUILD_PLAN.md §5) — v1: Identity, Events, Profile tabs.
 * Toggle with ?debug=true (remembered) or Shift+D. Deliberately neutral styling so it
 * reads as a presenter tool on both brands. Messaging + Presenter tabs land in Phase 6.
 */
type Tab = 'identity' | 'events' | 'profile';

const KIND_LABEL: Partial<Record<SdkActivity['kind'], string>> = { rest: 'REST' };

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
  const [tab, setTab] = useState<Tab>('events');
  if (!open) return null;
  return (
    <aside
      aria-label="Braze debug"
      className="fixed inset-x-2 bottom-2 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 font-mono text-[13px] text-slate-200 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:w-[440px]"
    >
      <header className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <span className="font-sans text-sm font-semibold text-white">Braze debug</span>
        <nav className="ml-2 flex gap-1" role="tablist">
          {(['identity', 'events', 'profile'] as Tab[]).map((t) => (
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
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1">
      <dt className="text-slate-400">{k}</dt>
      <dd className="break-all text-slate-100">{v ?? <span className="text-slate-500">—</span>}</dd>
    </div>
  );
}

function IdentityTab() {
  const { entity, ready } = useSia();
  const braze = useBraze();
  const externalId = useExternalId();
  return (
    <dl>
      <Row k="Site entity" v={entity} />
      <Row k="SDK" v={ready ? (braze.raw ? 'initialised' : 'failed') : 'starting…'} />
      <Row k="User state" v={externalId ? 'identified' : 'anonymous'} />
      <Row k="External ID (CEID)" v={externalId} />
      <Row k="Device ID" v={braze.deviceId} />
    </dl>
  );
}

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
            <span className={a.kind === 'rest' ? 'text-sky-300' : 'text-slate-400'}>{KIND_LABEL[a.kind] ?? a.kind}</span>
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

function ProfileTab() {
  const braze = useBraze();
  const externalId = useExternalId();
  const profile = useBrazeProfile(externalId);
  if (!externalId) return <p className="text-slate-400">Anonymous user. The live profile appears after sign-in.</p>;
  const refresh = async () => {
    await braze.flush();
    // Braze needs a moment to process the flushed batch before export reflects it.
    setTimeout(() => void profile.refetch(), 2500);
  };
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button onClick={refresh} className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600">
          Flush + refresh
        </button>
        <span className="text-slate-500">
          {profile.isFetching ? 'Loading…' : profile.dataUpdatedAt ? `Updated ${new Date(profile.dataUpdatedAt).toLocaleTimeString()}` : ''}
        </span>
      </div>
      {profile.error && <p className="text-rose-300">{String(profile.error.message)}</p>}
      {profile.data && !profile.data.found && <p className="text-slate-400">No Braze profile yet for this CEID (data may still be processing).</p>}
      {profile.data?.user && <pre className="overflow-x-auto text-[12px] text-slate-300">{JSON.stringify(profile.data.user, null, 2)}</pre>}
    </div>
  );
}
