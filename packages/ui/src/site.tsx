import type { CabinClass, WebEntity } from '@sia/core';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * Everything brand-specific the shared pages need. Each app passes its own SiteConfig;
 * the components only read from here and from the semantic theme tokens.
 */
export interface HeroSlide {
  title: string;
  subtitle: string;
  image?: string;
  /** Destination code the slide's CTA pre-fills in the search widget. */
  destination?: string;
}

export interface PromoCard {
  id: string;
  title: string;
  body: string;
  image?: string;
  cta: string;
  destination?: string;
}

export interface SiteConfig {
  entity: WebEntity;
  name: string;
  logo: { src: string; alt: string };
  nav: { label: string; to: string }[];
  hero: { bannerPlacement: string; slides: HeroSlide[] };
  promo: { placement: string; heading: string; fallback: PromoCard[] };
  /** Cabins offered in the search widget, in display order. */
  cabins: { value: CabinClass; label: string }[];
  /** Optional accent per cabin for fare headers (SQ cabin-class colours). */
  cabinColors?: Partial<Record<CabinClass, string>>;
  destinationImages: Record<string, string>;
  /** Small print under prices, e.g. Scoot's "illustrative prices" note (decision D11). */
  pricesNote?: string;
  footer: { columns: { title: string; links: string[] }[]; legal: string };
  loyaltyName: string;
  /**
   * Braze subscription group IDs per consent item id (e.g. TR_email_promotions → uuid).
   * Groups are created in the Braze dashboard; unmapped items are skipped.
   */
  subscriptionGroups?: Partial<Record<string, string>>;
}

const SiteContext = createContext<SiteConfig | null>(null);

export function SiteProvider({ config, children }: { config: SiteConfig; children: ReactNode }) {
  return <SiteContext.Provider value={config}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteConfig {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>');
  return ctx;
}
