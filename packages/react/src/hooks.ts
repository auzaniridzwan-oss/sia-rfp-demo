import type * as BrazeSdk from '@braze/web-sdk';
import type { BookingActions, BookingState, EventProps, LogEntry, SdkActivity, SdkEventName } from '@sia/core';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { useSia } from './context';

/** The site's BrazeClient. */
export function useBraze() {
  return useSia().braze;
}

/** Typed `track(event, props)` bound to the site's client. */
export function useTrack() {
  const braze = useBraze();
  return useCallback<typeof braze.track>((name, props) => braze.track(name, props), [braze]);
}

/** Log sia_page_viewed once per page change, after the SDK is ready (decision D7). */
export function usePageView(page: string) {
  const { braze, ready } = useSia();
  // Guards against React StrictMode's double effect run logging the same view twice.
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || logged.current === page) return;
    logged.current = page;
    braze.track('sia_page_viewed', { page });
  }, [braze, ready, page]);
}

/** Track an event once when a page/step mounts (StrictMode-safe, waits for the SDK). */
export function useTrackOnMount<E extends SdkEventName>(name: E, props: EventProps<E> | null) {
  const { braze, ready } = useSia();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current || !props) return;
    done.current = true;
    braze.track(name, props);
    // Props are read once at mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [braze, ready, name]);
}

/** Live list of SDK activity for the debug overlay. */
export function useSdkActivity(): readonly SdkActivity[] {
  const braze = useBraze();
  const [, force] = useState(0);
  useEffect(() => braze.subscribe(() => force((n) => n + 1)), [braze]);
  return braze.getActivity();
}

export function useLogEntries(): readonly LogEntry[] {
  const { logger } = useSia();
  const [, force] = useState(0);
  useEffect(() => logger.subscribe(() => force((n) => n + 1)), [logger]);
  return logger.getEntries();
}

/** Current external id (CEID) from storage; re-reads on identify / reset. */
export function useExternalId(): string | null {
  const braze = useBraze();
  return useSyncExternalStore(
    (cb) => braze.subscribe(cb),
    () => braze.externalId,
  );
}

/** Booking store selector. */
export function useBooking<T>(selector: (s: BookingState & BookingActions) => T): T {
  return useStore(useSia().booking, selector);
}

/**
 * Content Cards for this site. Cards are filtered by the `entity` and `placement`
 * key-value pairs set in the Braze composer (docs/BUILD_PLAN.md §2).
 */
export function useContentCards(placement: string) {
  const { braze, ready, entity } = useSia();
  const [cards, setCards] = useState<BrazeSdk.Card[]>([]);
  useEffect(() => {
    const sdk = braze.raw;
    if (!ready || !sdk) return;
    const pick = (all: BrazeSdk.Card[]) =>
      all.filter((c) => {
        const x = (c.extras ?? {}) as Record<string, string>;
        return (!x.entity || x.entity === entity) && (!x.placement || x.placement === placement);
      });
    setCards(pick(sdk.getCachedContentCards()?.cards ?? []));
    const sub = sdk.subscribeToContentCardsUpdates((cc) => setCards(pick(cc.cards)));
    sdk.requestContentCardsRefresh();
    return () => {
      if (sub) sdk.removeSubscription(sub);
    };
  }, [braze, ready, entity, placement]);

  const logImpressions = useCallback((shown: BrazeSdk.Card[]) => braze.raw?.logContentCardImpressions(shown), [braze]);
  const logClick = useCallback((card: BrazeSdk.Card) => braze.raw?.logContentCardClick(card), [braze]);
  return { cards, logImpressions, logClick };
}

/**
 * Render a Braze Banner placement into the returned ref. `hasBanner` is false until a
 * banner arrives, so callers can show their static fallback (hero carousel) meanwhile.
 */
export function useBanner<T extends HTMLElement = HTMLDivElement>(placementId: string) {
  const { braze, ready } = useSia();
  const ref = useRef<T>(null);
  const [hasBanner, setHasBanner] = useState(false);
  useEffect(() => {
    const sdk = braze.raw;
    if (!ready || !sdk) return;
    const render = () => {
      const banner = sdk.getBanner(placementId);
      const show = Boolean(banner && !banner.isControl && ref.current);
      if (show && ref.current) sdk.insertBanner(banner, ref.current);
      setHasBanner(show);
    };
    const sub = sdk.subscribeToBannersUpdates(render);
    sdk.requestBannersRefresh([placementId]);
    return () => {
      if (sub) sdk.removeSubscription(sub);
    };
  }, [braze, ready, placementId]);
  return { ref, hasBanner };
}

/** Live Braze profile via the REST export proxy (debug overlay). */
export function useBrazeProfile(externalId: string | null) {
  return useQuery({
    queryKey: ['braze-profile', externalId],
    enabled: Boolean(externalId),
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/braze/profile?external_id=${encodeURIComponent(externalId!)}`);
      const body = (await res.json().catch(() => ({}))) as { found?: boolean; user?: Record<string, unknown>; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
  });
}
